"use client";

import { useMemo } from "react";
import type { AspectRatio, GeneratedItem } from "@/lib/types";
import type { HistoryRow } from "@/lib/queries/user-history";
import type { FeedEntry } from "@/components/studio/types";

export function useStudioFeed(items: GeneratedItem[], dbHistory: HistoryRow[]) {
  return useMemo<FeedEntry[]>(() => {
    const inMemoryIds = new Set(items.map((i) => i.id));
    const dbCompleted = dbHistory
      .filter(
        (h) => !inMemoryIds.has(h.id) && (h.image_url || h.video_url),
      )
      .map((h) => ({
        id: h.id,
        mode: h.mode as "image" | "video",
        prompt: h.prompt,
        aspectRatio: h.aspect_ratio as AspectRatio,
        src: h.video_url || h.image_url!,
        posterUrl: h.mode === "video" ? h.image_url : null,
        muxPlaybackId: h.mux_playback_id ?? null,
        isVideo: h.mode === "video",
        isDb: true as const,
      }));
    return [
      ...items.map((i) => ({ ...i, isDb: false as const })),
      ...dbCompleted,
    ];
  }, [items, dbHistory]);
}
