"use client";

import { useCallback, useState } from "react";
import { PixelVideoPlayer } from "@/components/pixel-video-player";
import { muxStreamUrl } from "@/lib/hls";
import { getGridImageWidth, nextImageUrl } from "@/lib/image-url";

export interface ItemDetailContentProps {
  item: {
    id: string;
    src: string;
    alt: string;
    isVideo?: boolean;
    poster?: string;
    color?: string;
    muxPlaybackId?: string | null;
  };
  isOwner: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  onLightbox?: (v: { src: string; alt: string }) => void;
  showMobileBack?: boolean;
  downloadLabel?: string;
}

export function ItemDetailContent({
  item,
  isOwner,
  onClose,
  onEdit,
  onDownload,
  onDelete,
  onLightbox,
  showMobileBack = false,
  downloadLabel = "Download",
}: ItemDetailContentProps) {
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const controlsCallbackRef = useCallback((node: HTMLDivElement | null) => setControlsTarget(node), []);

  const displaySrc = item.isVideo ? item.src : nextImageUrl(item.src, 1200, 75);
  // Grid-size image URL — matches what the grid loaded (same width + quality), browser cache hit
  const gridSrc = item.isVideo ? undefined : nextImageUrl(item.src, getGridImageWidth(), 75);

  return (
    <div className="flex h-full flex-col bg-background/80 backdrop-blur-sm" onClick={onClose}>
      {showMobileBack && (
        <div className="flex shrink-0 items-center px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 2L4 7l5 5" />
            </svg>
            Back
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
        {item.isVideo ? (
          <PixelVideoPlayer
            key={item.id}
            src={item.muxPlaybackId ? muxStreamUrl(item.muxPlaybackId) : item.src}
            poster={item.poster}
            muxPlaybackId={item.muxPlaybackId ?? undefined}
            controlsBelow
            controlsPortalTarget={controlsTarget}
            className="h-full w-full max-h-[calc(100dvh-12rem)] md:max-h-[calc(100dvh-8rem)] max-w-full"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLightbox?.({ src: item.src, alt: item.alt });
            }}
            className="relative cursor-zoom-in"
            aria-label={`View "${item.alt}" full size`}
          >
            <div
              className="absolute inset-0 rounded"
              style={gridSrc ? {
                backgroundImage: `url(${gridSrc})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              } : undefined}
            />
            <img
              key={item.id}
              src={displaySrc}
              alt={item.alt}
              className="max-h-[calc(100dvh-12rem)] md:max-h-[calc(100dvh-8rem)] max-w-full object-contain"
            />
          </button>
        )}
      </div>
      {item.isVideo && <div ref={controlsCallbackRef} className="shrink-0 px-3 pt-1" onClick={(e) => e.stopPropagation()} />}
      <div className="shrink-0 border-t border-border px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate font-pixel text-[10px] lowercase text-muted-foreground select-text">
            {item.alt}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onEdit}
              className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
            >
              {downloadLabel}
            </button>
            {isOwner && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
