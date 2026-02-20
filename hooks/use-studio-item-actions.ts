"use client";

import { useCallback, useEffect } from "react";
import type { GeneratedItem, AspectRatio, GenerationMode } from "@/lib/types";
import type { ExploreSelectionType } from "@/components/studio/types";
import { detectMimeFromBase64, downloadOrOpen } from "@/lib/utils";

interface UseStudioItemActionsParams {
  setItems: React.Dispatch<React.SetStateAction<GeneratedItem[]>>;
  mutateHistory: {
    (): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any, opts?: { revalidate?: boolean }): void;
  };
  setAttachment: (v: string | null) => void;
  setMode: (m: GenerationMode) => void;
  setAspectRatio: (r: AspectRatio) => void;
  setPrompt: (v: string) => void;
  setVideoAttachment: (v: string | null) => void;
  setShowExplore: (v: boolean) => void;
  setExploreSelection: (v: ExploreSelectionType) => void;
  exploreDeleteRef: React.RefObject<((id: string) => void) | null>;
}

export function useStudioItemActions({
  setItems,
  mutateHistory,
  setAttachment,
  setMode,
  setAspectRatio,
  setPrompt,
  setVideoAttachment,
  setShowExplore,
  setExploreSelection,
  exploreDeleteRef,
}: UseStudioItemActionsParams) {
  // ── Base64 attachment helper ──
  const toBase64Attachment = useCallback(
    async (src: string): Promise<string | null> => {
      if (!src.startsWith("data:") && !src.startsWith("http")) return src;
      if (src.startsWith("data:"))
        return src.replace(/^data:[^;]+;base64,/, "");
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] || null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    },
    [],
  );

  // ── Download ──
  const handleDownload = useCallback((item: GeneratedItem) => {
    if (item.mode === "image" && item.base64) {
      downloadOrOpen(
        `data:image/png;base64,${item.base64}`,
        `grok-${item.id.slice(0, 8)}.png`,
      );
    } else if (item.mode === "image" && item.imageUrl) {
      downloadOrOpen(item.imageUrl, `grok-${item.id.slice(0, 8)}.png`);
    } else if (item.mode === "video" && item.videoUrl) {
      downloadOrOpen(item.videoUrl, `grok-${item.id.slice(0, 8)}.mp4`);
    }
  }, []);

  // ── Copy ──
  const handleCopy = useCallback(async (item: GeneratedItem) => {
    if (item.mode !== "image" || !item.base64) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        const mime = detectMimeFromBase64(item.base64!);
        img.src = `data:${mime};base64,${item.base64}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
    } catch {
      try {
        const mime = detectMimeFromBase64(item.base64!);
        await navigator.clipboard.writeText(
          `data:${mime};base64,${item.base64}`,
        );
      } catch {}
    }
  }, []);

  // ── Edit ──
  const handleEdit = useCallback(
    (item: GeneratedItem) => {
      if (item.mode !== "image") return;
      const src =
        item.imageUrl ||
        (item.base64 ? `data:image/png;base64,${item.base64}` : null);
      if (!src) return;
      setMode("image");
      setAspectRatio(item.aspectRatio);
      setPrompt("");
      toBase64Attachment(src).then((b64) => {
        if (b64) setAttachment(b64);
      });
    },
    [toBase64Attachment, setMode, setAspectRatio, setPrompt, setAttachment],
  );

  // ── Delete ──
  const handleDelete = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      // Optimistic SWR update — remove from dbHistory immediately so
      // useStudioFeed doesn't re-surface the item as a "past" entry.
      mutateHistory(
        (data: { generations: Array<{ id: string }> } | undefined) =>
          data?.generations
            ? { ...data, generations: data.generations.filter((g) => g.id !== id) }
            : data,
        { revalidate: false },
      );
      // Also remove from explore grid if visible
      exploreDeleteRef.current?.(id);
      try {
        await fetch(`/api/generations/${id}`, { method: "DELETE" });
        mutateHistory();
      } catch {}
    },
    [setItems, mutateHistory, exploreDeleteRef],
  );

  // ── Explore actions ──
  const handleEditExplore = useCallback(
    (selection: NonNullable<ExploreSelectionType>) => {
      if (selection.isVideo) {
        setVideoAttachment(selection.src);
        setMode("video");
        setPrompt("");
      } else {
        setMode("image");
        setPrompt("");
        toBase64Attachment(selection.src).then((b64) => {
          if (b64) setAttachment(b64);
        });
      }
    },
    [toBase64Attachment, setVideoAttachment, setMode, setPrompt, setAttachment],
  );

  const handleDownloadExplore = useCallback(
    (selection: NonNullable<ExploreSelectionType>) => {
      const ext = selection.isVideo ? "mp4" : "png";
      downloadOrOpen(selection.src, `${selection.alt.slice(0, 40)}.${ext}`);
    },
    [],
  );

  const handleDeleteExplore = useCallback(
    async (selection: NonNullable<ExploreSelectionType>) => {
      const realId = selection.id.replace(/^explore-/, "");
      exploreDeleteRef.current?.(realId);
      setExploreSelection(null);
      setShowExplore(true);
      window.history.pushState({}, "", "/explore");
      try {
        await fetch(`/api/generations/${realId}`, { method: "DELETE" });
      } catch {}
      mutateHistory();
    },
    [exploreDeleteRef, setExploreSelection, setShowExplore, mutateHistory],
  );

  // ── Global Cmd+V paste ──
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable;
      if (isInput) return;

      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (const clipItem of Array.from(clipboardItems)) {
        if (clipItem.type.startsWith("image/")) {
          e.preventDefault();
          const file = clipItem.getAsFile();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            if (base64) {
              setAttachment(base64);
              setMode("image");
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [setAttachment, setMode]);

  return {
    handleDownload,
    handleCopy,
    handleEdit,
    handleDelete,
    handleEditExplore,
    handleDownloadExplore,
    handleDeleteExplore,
    toBase64Attachment,
  };
}
