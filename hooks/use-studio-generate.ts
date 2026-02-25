"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { GeneratedItem, AspectRatio, GenerationMode } from "@/lib/types";
import type { ExploreSelectionType, GenerationSelectionType } from "@/components/studio/types";
import type { InFlightEntry } from "@/hooks/use-video-progress";
import { upload } from "@vercel/blob/client";
import { consumeVideoStream, consumeImageStream } from "@/hooks/use-video-progress";

async function uploadBlobVideo(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  const file = new File([blob], `video-${Date.now()}.mp4`, { type: blob.type || "video/mp4" });
  const result = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return result.url;
}

interface UseStudioGenerateParams {
  promptRef: RefObject<string>;
  aspectRatioRef: RefObject<AspectRatio>;
  modeRef: RefObject<GenerationMode>;
  durationRef: RefObject<number>;
  attachmentRef: RefObject<string | null>;
  videoAttachmentRef: RefObject<string | null>;
  setPrompt: (v: string) => void;
  setAttachment: (v: string | null) => void;
  setVideoAttachment: (v: string | null) => void;
  setError: (v: string | null) => void;
  setShowExplore: (v: boolean) => void;
  setExploreSelection: (v: ExploreSelectionType) => void;
  setGenerationSelection: (v: GenerationSelectionType) => void;
  setItems: React.Dispatch<React.SetStateAction<GeneratedItem[]>>;
  setVisibleId: (v: string | null) => void;
  setActiveGenerations: React.Dispatch<React.SetStateAction<number>>;
  setProgressMap: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  inFlightRef: RefObject<Map<string, InFlightEntry>>;
  feedRef: RefObject<HTMLDivElement | null>;
  mutateHistory: () => void;
}

export function useStudioGenerate(params: UseStudioGenerateParams) {
  // Keep a stable ref to all params so callbacks don't need deps
  const p = useRef(params);
  p.current = params;

  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    prefersReducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const handleGenerate = useCallback(async () => {
    const {
      promptRef,
      aspectRatioRef,
      modeRef,
      durationRef,
      attachmentRef,
      videoAttachmentRef,
      setPrompt,
      setAttachment,
      setVideoAttachment,
      setError,
      setShowExplore,
      setExploreSelection,
      setGenerationSelection,
      setItems,
      setVisibleId,
      setActiveGenerations,
      setProgressMap,
      inFlightRef,
      feedRef,
    } = p.current;

    if (!promptRef.current.trim()) return;

    setError(null);
    const currentPrompt = promptRef.current.trim();
    const currentRatio = aspectRatioRef.current;
    const currentMode = modeRef.current;
    const currentDuration = durationRef.current;
    const currentAttachment = attachmentRef.current;
    const currentVideoAttachment = videoAttachmentRef.current;
    const itemId = crypto.randomUUID();
    const abort = new AbortController();

    setAttachment(null);
    setVideoAttachment(null);
    setShowExplore(false);
    setExploreSelection(null);
    setGenerationSelection(null);
    setVisibleId(itemId);
    setActiveGenerations((n) => n + 1);

    if (currentMode === "image") {
      setItems((prev) => [
        {
          id: itemId,
          mode: "image",
          prompt: currentPrompt,
          aspectRatio: currentRatio,
          timestamp: Date.now(),
        },
        ...prev,
      ]);

      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        let target: number;
        if (elapsed < 2) {
          target = (elapsed / 2) * 60;
        } else if (elapsed < 7) {
          target = 60 + ((elapsed - 2) / 5) * 25;
        } else {
          target = Math.min(95, 85 + (elapsed - 7) * 0.5);
        }
        setProgressMap((prev) => {
          const cur = prev.get(itemId) ?? 0;
          if (target <= cur) return prev;
          return new Map(prev).set(itemId, Math.round(target));
        });
      }, 100);

      inFlightRef.current.set(itemId, { interval, abort });
      setProgressMap((prev) => new Map(prev).set(itemId, 0));

      try {
        const startRes = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: currentPrompt,
            aspectRatio: currentRatio,
            id: itemId,
            ...(currentAttachment ? { imageBase64: currentAttachment } : {}),
          }),
          signal: abort.signal,
        });

        if (!startRes.ok) {
          const data = await startRes.json();
          throw new Error(data.error || "Generation failed");
        }

        const { runId } = await startRes.json();
        if (!runId) throw new Error("No runId returned");

        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, runId } : item,
          ),
        );

        const streamRes = await fetch(`/api/generate-image/${runId}`, {
          signal: abort.signal,
        });
        if (!streamRes.ok) {
          throw new Error("Failed to connect to image stream");
        }

        consumeImageStream(
          streamRes,
          itemId,
          setItems,
          () => {
            const entry = inFlightRef.current.get(itemId);
            if (entry) {
              clearInterval(entry.interval);
              inFlightRef.current.delete(itemId);
            }
            setActiveGenerations((n) => Math.max(0, n - 1));
            setProgressMap((prev) => new Map(prev).set(itemId, 100));
            setTimeout(() => {
              setProgressMap((prev) => {
                const next = new Map(prev);
                next.delete(itemId);
                return next;
              });
            }, 500);
          },
        );
      } catch (err) {
        clearInterval(interval);
        inFlightRef.current.delete(itemId);
        setActiveGenerations((n) => Math.max(0, n - 1));
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });

        if (err instanceof Error && err.name === "AbortError") {
          setItems((prev) => prev.filter((item) => item.id !== itemId));
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
        setItems((prev) => prev.filter((item) => item.id !== itemId));
      }
    } else {
      setItems((prev) => [
        {
          id: itemId,
          mode: "video",
          prompt: currentPrompt,
          aspectRatio: currentRatio,
          timestamp: Date.now(),
          videoStatus: "pending",
        },
        ...prev,
      ]);

      setProgressMap((prev) => new Map(prev).set(itemId, 0));
      const videoStart = Date.now();
      const videoInterval = setInterval(() => {
        const elapsed = (Date.now() - videoStart) / 1000;
        let target: number;
        if (elapsed < 3) {
          target = (elapsed / 3) * 15;
        } else if (elapsed < 15) {
          target = 15 + ((elapsed - 3) / 12) * 55;
        } else if (elapsed < 30) {
          target = 70 + ((elapsed - 15) / 15) * 20;
        } else {
          target = Math.min(95, 90 + (elapsed - 30) * 0.2);
        }
        setProgressMap((prev) => {
          const cur = prev.get(itemId) ?? 0;
          if (target <= cur) return prev;
          return new Map(prev).set(itemId, Math.round(target));
        });
      }, 500);
      inFlightRef.current.set(itemId, { interval: videoInterval, abort });

      try {
        const startRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: currentPrompt,
            aspectRatio: currentRatio,
            id: itemId,
            duration: currentDuration,
            ...(currentVideoAttachment
              ? { videoUrl: currentVideoAttachment.startsWith("blob:")
                  ? await uploadBlobVideo(currentVideoAttachment)
                  : currentVideoAttachment }
              : {}),
            ...(currentAttachment && currentMode === "video"
              ? { imageBase64: currentAttachment }
              : {}),
          }),
          signal: abort.signal,
        });

        if (!startRes.ok) {
          const errText = await startRes.text().catch(() => "");
          let message = "Video generation failed";
          try {
            message = JSON.parse(errText).error || message;
          } catch {}
          throw new Error(message);
        }

        const { runId } = await startRes.json();
        if (!runId) throw new Error("No runId returned");

        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, runId } : item,
          ),
        );

        const streamRes = await fetch(`/api/generate-video/${runId}`, {
          signal: abort.signal,
        });
        if (!streamRes.ok) {
          throw new Error("Failed to connect to video stream");
        }

        consumeVideoStream(
          streamRes,
          itemId,
          setItems,
          () => {
            const entry = inFlightRef.current.get(itemId);
            if (entry) {
              clearInterval(entry.interval);
              inFlightRef.current.delete(itemId);
            }
            setActiveGenerations((n) => Math.max(0, n - 1));
            setProgressMap((prev) => {
              const next = new Map(prev);
              next.delete(itemId);
              return next;
            });
          },
        );
      } catch (err) {
        const entry = inFlightRef.current.get(itemId);
        if (entry) {
          clearInterval(entry.interval);
          inFlightRef.current.delete(itemId);
        }
        setActiveGenerations((n) => Math.max(0, n - 1));
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });

        if (err instanceof Error && err.name === "AbortError") {
          setItems((prev) => prev.filter((item) => item.id !== itemId));
          return;
        }
        setError(
          err instanceof Error ? err.message : "Video generation failed",
        );
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  videoStatus: "failed" as const,
                  videoError:
                    err instanceof Error ? err.message : "Failed",
                }
              : item,
          ),
        );
      }
    }

    requestAnimationFrame(() => {
      feedRef.current?.scrollTo({
        top: 0,
        behavior: prefersReducedMotionRef.current ? "instant" : "smooth",
      });
    });
  }, []);

  const handleCancelItem = useCallback(
    (itemId: string) => {
      const { inFlightRef, setActiveGenerations, setProgressMap, setItems, mutateHistory } =
        p.current;
      const entry = inFlightRef.current.get(itemId);
      if (entry) {
        clearInterval(entry.interval);
        entry.abort.abort();
        inFlightRef.current.delete(itemId);
      }
      setActiveGenerations((n) => Math.max(0, n - 1));
      setProgressMap((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      // Delete the DB row so the item doesn't reappear on refresh
      // (the API route created a pending row with run_id when generation started).
      fetch(`/api/generations/${itemId}`, { method: "DELETE" }).catch(() => {});
      mutateHistory();
    },
    [],
  );

  return { handleGenerate, handleCancelItem };
}
