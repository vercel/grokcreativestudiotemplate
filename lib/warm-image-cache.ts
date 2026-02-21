import type { CompactItem } from "@/lib/compact-manifest";

/**
 * Pre-warm the /_next/image CDN cache for viewport images.
 *
 * When called from after(), this runs AFTER the response is sent
 * so it never blocks the user. The fetches trigger Vercel's image
 * optimization pipeline — once optimized, the result is CDN-cached
 * for 1 year (minimumCacheTTL in next.config).
 *
 * Timing advantage: after() starts ~50ms before the browser's first
 * image request. For images that take ~100-300ms to optimize, some
 * may already be cached by the time the browser asks for them.
 * At minimum, the NEXT visitor gets guaranteed CDN HITs.
 */

const WARM_SIZES = [
  { w: 828, q: 75 }, // desktop 2x DPR (1920×0.2×2=768 → picks 828)
  { w: 640, q: 75 }, // mobile/tablet 2x DPR
  { w: 384, q: 75 }, // desktop 1x DPR (1920×0.2=384)
];

const VIEWPORT_COUNT = 20;

export async function warmViewportImages(
  items: { image_url?: string | null }[],
) {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) return;

  const urls: string[] = [];
  let n = 0;
  for (const item of items) {
    if (n >= VIEWPORT_COUNT) break;
    if (!item.image_url) continue;
    for (const { w, q } of WARM_SIZES) {
      urls.push(
        `https://${host}/_next/image?url=${encodeURIComponent(item.image_url)}&w=${w}&q=${q}`,
      );
    }
    n++;
  }

  // Fire all warmup requests concurrently. allSettled so one failure
  // doesn't abort the rest. Accept header ensures AVIF is generated
  // (matching what browsers send).
  await Promise.allSettled(
    urls.map((url) =>
      fetch(url, { headers: { Accept: "image/avif,image/webp,*/*" } }),
    ),
  );
}

/** Warm from compact tuples — reads item[3] (image_url) directly */
export async function warmFromCompact(items: CompactItem[]) {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) return;

  const urls: string[] = [];
  let n = 0;
  for (const item of items) {
    if (n >= VIEWPORT_COUNT) break;
    const imageUrl = item[3];
    if (!imageUrl) continue;
    for (const { w, q } of WARM_SIZES) {
      urls.push(
        `https://${host}/_next/image?url=${encodeURIComponent(imageUrl)}&w=${w}&q=${q}`,
      );
    }
    n++;
  }

  await Promise.allSettled(
    urls.map((url) =>
      fetch(url, { headers: { Accept: "image/avif,image/webp,*/*" } }),
    ),
  );
}
