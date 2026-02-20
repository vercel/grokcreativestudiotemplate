"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { GeneratedItem } from "@/lib/types";
import { muxThumbnailUrl } from "@/lib/hls";

const INFLIGHT_KEY = "gcs-inflight-videos";
const IMAGES_KEY = "gcs-generated-images";
const BLOB_HOST = "w1ddfvelthbnqh3k.public.blob.vercel-storage.com";

/** Persist completed items (images + videos) to localStorage so they survive refresh.
 *  We strip base64 data to avoid exceeding the ~5 MB localStorage quota. */
export function saveGeneratedImages(items: GeneratedItem[]) {
  const completed = items.filter(
    (i) =>
      (i.mode === "image" && (i.base64 || i.imageUrl)) ||
      (i.mode === "video" && i.videoStatus === "completed" && i.videoUrl),
  );
  if (completed.length === 0) {
    localStorage.removeItem(IMAGES_KEY);
    return;
  }
  // Only persist items that have a permanent URL (uploaded to storage).
  // Strip base64 to stay well within the ~5 MB quota.
  const serialisable = completed
    .filter((i) => i.imageUrl || i.videoUrl)
    .map(({ base64: _b64, ...rest }) => rest);
  if (serialisable.length === 0) {
    localStorage.removeItem(IMAGES_KEY);
    return;
  }
  try {
    localStorage.setItem(IMAGES_KEY, JSON.stringify(serialisable));
  } catch {
    // Quota still exceeded — clear stale data rather than crash.
    localStorage.removeItem(IMAGES_KEY);
  }
}

/** Restore generated images from localStorage */
export function loadGeneratedImages(): GeneratedItem[] {
  try {
    const raw = localStorage.getItem(IMAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GeneratedItem[];
  } catch {
    return [];
  }
}

/** Per-item in-flight tracker */
export type InFlightEntry = {
  interval: ReturnType<typeof setInterval>;
  abort: AbortController;
};

/** Persist in-flight video items to localStorage so they survive refresh */
function saveInflightVideos(items: GeneratedItem[]) {
  const inflight = items.filter(
    (i) => i.mode === "video" && i.runId && i.videoStatus !== "completed" && i.videoStatus !== "failed",
  );
  if (inflight.length > 0) {
    localStorage.setItem(INFLIGHT_KEY, JSON.stringify(inflight));
  } else {
    localStorage.removeItem(INFLIGHT_KEY);
  }
}

/** Restore in-flight video items from localStorage */
export function loadInflightVideos(): GeneratedItem[] {
  try {
    const raw = localStorage.getItem(INFLIGHT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GeneratedItem[];
  } catch {
    return [];
  }
}

/**
 * Reads a workflow stream of newline-delimited JSON VideoProgress objects.
 * Updates the corresponding item in state as progress arrives.
 */
export async function consumeVideoStream(
  response: Response,
  itemId: string,
  setItems: React.Dispatch<React.SetStateAction<GeneratedItem[]>>,
  onDone?: () => void,
) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let progress: import("@/lib/types").VideoProgress;
        try {
          progress = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (progress.status === "completed" && progress.url) {
          const imageUrl = progress.muxPlaybackId
            ? muxThumbnailUrl(progress.muxPlaybackId)
            : undefined;

          // Preload thumbnail through next/image while progress bar is still
          // visible (~95%). Once cached, the card renders with it instantly.
          if (imageUrl) {
            const nextImgUrl = `/_next/image?url=${encodeURIComponent(imageUrl)}&w=1200&q=75`;
            await new Promise<void>((resolve) => {
              const img = new window.Image();
              const done = () => { img.onload = null; img.onerror = null; resolve(); };
              img.onload = done;
              img.onerror = done;
              img.src = nextImgUrl;
              setTimeout(done, 3000);
            });
          }

          // Atomic update: progress bar disappears → thumbnail already cached → no gap.
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    videoStatus: "completed",
                    videoUrl: progress.url,
                    muxPlaybackId: progress.muxPlaybackId,
                    imageUrl: imageUrl || item.imageUrl,
                  }
                : item,
            ),
          );
          onDone?.();
          return;
        }

        if (progress.status === "failed") {
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, videoStatus: "failed", videoError: progress.error || "Failed" }
                : item,
            ),
          );
          onDone?.();
          return;
        }

        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, videoStatus: progress.status }
              : item,
          ),
        );
      }
    }
  } catch {
    // Stream interrupted - workflow continues server-side
  }
}

/** Start simulated progress for a video generation */
function startSimulatedProgress(
  itemId: string,
  setProgressMap: React.Dispatch<React.SetStateAction<Map<string, number>>>,
  startedAt?: number,
) {
  const videoStart = startedAt || Date.now();
  return setInterval(() => {
    const elapsed = (Date.now() - videoStart) / 1000;
    let target: number;
    if (elapsed < 3) target = (elapsed / 3) * 15;
    else if (elapsed < 15) target = 15 + ((elapsed - 3) / 12) * 55;
    else if (elapsed < 30) target = 70 + ((elapsed - 15) / 15) * 20;
    else target = Math.min(95, 90 + (elapsed - 30) * 0.2);
    setProgressMap((prev) => {
      const cur = prev.get(itemId) ?? 0;
      if (target <= cur) return prev;
      return new Map(prev).set(itemId, Math.round(target));
    });
  }, 500);
}

export function useVideoProgress(
  items: GeneratedItem[],
  setItems: React.Dispatch<React.SetStateAction<GeneratedItem[]>>,
  mutateHistory: () => void,
) {
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  const inFlightRef = useRef<Map<string, InFlightEntry>>(new Map());
  const reconnectedDbIds = useRef(new Set<string>());
  const hasMountedRef = useRef(false);

  // Persist in-flight video items to localStorage.
  // Skip the mount render — items were just loaded FROM localStorage.
  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    saveInflightVideos(items);
  }, [items]);

  // On mount, reconnect in-flight video items to their streams.
  // Read directly from localStorage — component state hasn't hydrated yet.
  useEffect(() => {
    const inflight = loadInflightVideos();
    if (inflight.length === 0) return;

    for (const item of inflight) {
      if (!item.runId) continue;
      const runId = item.runId;
      const itemId = item.id;

      const videoInterval = startSimulatedProgress(itemId, setProgressMap, item.timestamp);
      const abort = new AbortController();
      inFlightRef.current.set(itemId, { interval: videoInterval, abort });

      fetch(`/api/generate-video/${runId}`, { signal: abort.signal })
        .then((streamRes) => {
          if (!streamRes.ok) throw new Error("Failed to reconnect to video stream");
          consumeVideoStream(streamRes, itemId, setItems, () => {
            const entry = inFlightRef.current.get(itemId);
            if (entry) { clearInterval(entry.interval); inFlightRef.current.delete(itemId); }
            setProgressMap((prev) => { const next = new Map(prev); next.delete(itemId); return next; });
          });
        })
        .catch(async () => {
          clearInterval(videoInterval);
          inFlightRef.current.delete(itemId);
          // Workflow may have already completed — check if video exists in Blob
          const blobUrl = `https://${BLOB_HOST}/generations/${itemId}.mp4`;
          try {
            const head = await fetch(blobUrl, { method: "HEAD" });
            if (head.ok) {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === itemId ? { ...i, videoStatus: "completed" as const, videoUrl: blobUrl } : i,
                ),
              );
            }
          } catch { /* video not in blob — truly failed or still running elsewhere */ }
          setProgressMap((prev) => { const next = new Map(prev); next.delete(itemId); return next; });
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect pending videos discovered in DB history
  const reconnectDbVideos = useCallback((dbHistory: Array<{ id: string; mode: string; video_url: string | null; run_id: string | null; prompt: string; aspect_ratio: string }>) => {
    if (!dbHistory || dbHistory.length === 0) return;
    const pending = dbHistory.filter(
      (h) => h.mode === "video" && !h.video_url && h.run_id && !reconnectedDbIds.current.has(h.id),
    );
    if (pending.length === 0) return;

    for (const h of pending) {
      const itemId = h.id;
      const runId = h.run_id as string;
      reconnectedDbIds.current.add(itemId);

      setItems((prev) => {
        if (prev.some((i) => i.id === itemId)) return prev;
        return [{
          id: itemId,
          mode: "video" as const,
          prompt: h.prompt,
          aspectRatio: (h.aspect_ratio || "16:9") as import("@/lib/types").AspectRatio,
          timestamp: Date.now(),
          videoStatus: "in_progress" as const,
          runId,
        }, ...prev];
      });

      const videoInterval = startSimulatedProgress(itemId, setProgressMap);
      const abort = new AbortController();
      inFlightRef.current.set(itemId, { interval: videoInterval, abort });

      fetch(`/api/generate-video/${runId}`, { signal: abort.signal })
        .then((streamRes) => {
          if (!streamRes.ok) throw new Error("Failed to reconnect to video stream");
          consumeVideoStream(streamRes, itemId, setItems, () => {
            const entry = inFlightRef.current.get(itemId);
            if (entry) { clearInterval(entry.interval); inFlightRef.current.delete(itemId); }
            setProgressMap((prev) => { const next = new Map(prev); next.delete(itemId); return next; });
            mutateHistory();
          });
        })
        .catch(async () => {
          clearInterval(videoInterval);
          inFlightRef.current.delete(itemId);
          const blobUrl = `https://${BLOB_HOST}/generations/${itemId}.mp4`;
          try {
            const head = await fetch(blobUrl, { method: "HEAD" });
            if (head.ok) {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === itemId ? { ...i, videoStatus: "completed" as const, videoUrl: blobUrl } : i,
                ),
              );
            }
          } catch {}
          setProgressMap((prev) => { const next = new Map(prev); next.delete(itemId); return next; });
          mutateHistory();
        });
    }
  }, [setItems, mutateHistory, setProgressMap]);

  // Cleanup on unmount — abort in-flight fetches and clear intervals
  useEffect(() => {
    return () => {
      for (const entry of inFlightRef.current.values()) {
        clearInterval(entry.interval);
        entry.abort.abort();
      }
    };
  }, []);

  return { progressMap, setProgressMap, inFlightRef, reconnectDbVideos };
}
