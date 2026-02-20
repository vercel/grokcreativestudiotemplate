import { preload } from "react-dom";
import type { CompactItem } from "@/lib/compact-manifest";

/**
 * Preload above-fold explore images by emitting
 * <link rel="preload" as="image" imagesrcset="..." imagesizes="...">
 * directly in the server HTML.
 *
 * This makes the browser start downloading optimized images BEFORE
 * React hydrates — saving ~200-400ms vs waiting for next/image's
 * <Image priority> which only fires after hydration.
 *
 * The srcSet matches exactly what next/image generates for these images
 * (same widths from next.config deviceSizes + imageSizes, same quality).
 *
 * Two tiers (matching explore-grid.tsx quality + priority):
 *  - Items 0-4:  q=75, fetchPriority "high" — first row, downloads before CSS/JS
 *  - Items 5-19: q=75, fetchPriority "auto" — rest of viewport, eager loading
 *
 * All viewport-visible images are preloaded so none show blur placeholders.
 * Only 5 get fetchPriority="high" to avoid bandwidth competition at top priority.
 */

// Matches next.config.mjs: deviceSizes + imageSizes, sorted
const WIDTHS = [128, 256, 384, 640, 750, 828, 1080, 1200, 1920];
const SIZES = "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw";
const QUALITY_HIGH = 75; // viewport quality
const HIGH_PRIORITY_COUNT = 5; // first row on desktop (5 cols)
const TOTAL_COUNT = 20; // ~4 rows on desktop, covers full viewport

/** Preload from compact tuples — reads item[3] (image_url) directly */
export function preloadFromCompact(items: CompactItem[]) {
  let n = 0;
  for (const item of items) {
    if (n >= TOTAL_COUNT) break;
    const imageUrl = item[3];
    if (!imageUrl) continue;
    const srcSet = WIDTHS
      .map((w) => `/_next/image?url=${encodeURIComponent(imageUrl)}&w=${w}&q=${QUALITY_HIGH} ${w}w`)
      .join(", ");
    preload(imageUrl, {
      as: "image",
      imageSrcSet: srcSet,
      imageSizes: SIZES,
      ...(n < HIGH_PRIORITY_COUNT ? { fetchPriority: "high" as const } : {}),
    });
    n++;
  }
}
