import type { ExploreRow, ExplorePage } from "./explore-queries";

/**
 * Compact manifest format: array-of-tuples for minimal RSC payload.
 *
 * Tuple indices:
 *   0: id, 1: aspect_ratio, 2: color, 3: image_url, 4: video_url,
 *   5: mode, 6: prompt (truncated 120 chars), 7: user_id, 8: user_name, 9: blurDataURL,
 *   10: mux_playback_id
 */
export type CompactItem = [
  string,        // 0: id
  string,        // 1: aspect_ratio ("16:9")
  string | null, // 2: color
  string,        // 3: image_url
  string | null, // 4: video_url
  string,        // 5: mode
  string,        // 6: prompt (truncated 120 chars)
  string,        // 7: user_id
  string | null, // 8: user_name
  string | null, // 9: blurDataURL
  string | null, // 10: mux_playback_id
];

export interface CompactManifest {
  items: CompactItem[];
  nextCursor: string | null;
}

export function toCompact(items: ExploreRow[]): CompactItem[] {
  return items.map((item) => [
    item.id,
    item.aspect_ratio,
    item.color ?? null,
    item.image_url,
    item.video_url ?? null,
    item.mode,
    item.prompt.length > 120 ? item.prompt.slice(0, 117) + "…" : item.prompt,
    item.user_id,
    item.user_name ?? null,
    item.blurDataURL ?? null,
    item.mux_playback_id ?? null,
  ]);
}

export function fromCompact(compact: CompactItem[]): ExploreRow[] {
  return compact.map((t) => ({
    id: t[0],
    aspect_ratio: t[1],
    color: t[2],
    image_url: t[3],
    video_url: t[4],
    mux_playback_id: t[10] ?? null,
    mode: t[5],
    prompt: t[6],
    user_id: t[7],
    user_name: t[8],
    user_avatar: null,
    blur_data: null,
    created_at: "",
    ...(t[9] ? { blurDataURL: t[9] } : {}),
  }));
}

/** Expand CompactManifest into ExplorePage for components.
 *  Handles stale cache gracefully: if items are already ExploreRow objects
 *  (old format before compact migration), passes them through as-is. */
export function expandManifest(manifest: CompactManifest): ExplorePage {
  // Stale cache guard: old format has objects, new format has arrays (tuples)
  if (manifest.items.length > 0 && !Array.isArray(manifest.items[0])) {
    return manifest as unknown as ExplorePage;
  }
  return {
    items: fromCompact(manifest.items),
    nextCursor: manifest.nextCursor,
  };
}
