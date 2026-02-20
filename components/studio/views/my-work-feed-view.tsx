"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { PixelVideoPlayer } from "@/components/pixel-video-player";
import { PixelProgress } from "@/components/pixel-progress";
import { ASPECT_RATIO_CSS, ASPECT_RATIO_FACTOR } from "@/lib/constants";
import type { AspectRatio, GeneratedItem } from "@/lib/types";
import { downloadOrOpen } from "@/lib/utils";
import { muxStreamUrl } from "@/lib/hls";
import {
  useStudioState,
  useStudioActions,
  useStudioMeta,
  useStudioProgress,
  type FeedEntry,
} from "../studio-context";

/** Compute inline styles for feed media containers so that portrait/square
 *  items get a constrained max-width that matches the max-height + aspect ratio.
 *  Uses a CSS custom property `--feed-mh` for responsive breakpoints. */
function feedMediaStyle(aspectRatio: AspectRatio) {
  const cssAspect = ASPECT_RATIO_CSS[aspectRatio];
  const factor = ASPECT_RATIO_FACTOR[aspectRatio];
  return {
    "--feed-mh": "calc(100dvh - 14rem)",
    aspectRatio: cssAspect,
    maxHeight: "var(--feed-mh)",
    maxWidth: `min(100%, calc(var(--feed-mh) * ${factor}))`,
    width: "100%",
    margin: "0 auto",
  } as React.CSSProperties;
}

/** Tailwind classes to pair with feedMediaStyle() for responsive max-height */
const FEED_MEDIA_CLASS = "md:[--feed-mh:calc(100dvh-10rem)]";

/** Feed video — uses native <video poster> for zero layout shift. */
function FeedVideo({
  src,
  poster,
  aspectRatio,
  scrollRef,
  controlsPortalTarget,
}: {
  src: string;
  poster?: string;
  aspectRatio: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  controlsPortalTarget?: HTMLDivElement | null;
}) {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  useEffect(() => {
    const video = videoElRef.current;
    const root = scrollRef.current;
    if (!video || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { root, threshold: 0.5 },
    );
    observer.observe(containerRef.current || video);
    return () => observer.disconnect();
  }, [scrollRef]);

  const arKey = (aspectRatio as AspectRatio) || "16:9";

  return (
    <div
      ref={containerRef}
      className={`relative animate-content-reveal ${FEED_MEDIA_CLASS}`}
      style={feedMediaStyle(arKey)}
    >
      <PixelVideoPlayer
        src={src}
        poster={poster}
        onVideoRef={handleVideoRef}
        controlsBelow
        controlsPortalTarget={controlsPortalTarget}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

/** Render-prop component: places video in the media area and controls
 *  portal target as a separate full-width slot for the parent to position. */
function VideoFeedCard({
  videoSrc,
  poster,
  entryAspectRatio,
  feedRef,
  children,
}: {
  videoSrc: string;
  poster?: string;
  entryAspectRatio: AspectRatio;
  feedRef: React.RefObject<HTMLDivElement | null>;
  children: (video: React.ReactNode, controlsSlot: React.ReactNode) => React.ReactNode;
}) {
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);

  const video = (
    <FeedVideo
      src={videoSrc}
      poster={poster}
      aspectRatio={entryAspectRatio}
      scrollRef={feedRef}
      controlsPortalTarget={controlsTarget}
    />
  );

  const controlsSlot = <div ref={setControlsTarget} />;

  return <>{children(video, controlsSlot)}</>;
}

const PRELOAD_WINDOW = 4; // preload ±4 items around visible

export function MyWorkFeedView() {
  const { feedItems, visibleId, scrollTarget, showExplore } = useStudioState();
  const { isHistoryLoading, sessionLoading } = useStudioMeta();
  const { progressMap } = useStudioProgress();
  const {
    cancelItem,
    deleteItem,
    setLightbox,
    setMode,
    setPrompt,
    setAttachment,
    setVideoAttachment,
    setShowExplore,
    handleCopy,
    feedRef,
    itemRefs,
    scrollingFromClick,
    setVisibleId,
    toBase64Attachment,
  } = useStudioActions();

  // Wheel navigation: accumulates delta for inertia, then jumps items.
  // Content is always perfectly centered via block:"center".
  const visibleIdRef = useRef(visibleId);
  visibleIdRef.current = visibleId;
  const feedItemsRef = useRef(feedItems);
  feedItemsRef.current = feedItems;
  const showExploreRef = useRef(showExplore);
  showExploreRef.current = showExplore;

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;

    let accDelta = 0;
    const THRESHOLD = 30;
    let cooldown = false;

    const onWheel = (e: WheelEvent) => {
      if (showExploreRef.current) return;
      e.preventDefault();
      const items = feedItemsRef.current;
      if (items.length === 0 || cooldown) return;

      accDelta += e.deltaY;
      if (Math.abs(accDelta) < THRESHOLD) return;

      const direction = accDelta > 0 ? 1 : -1;
      const jumps = Math.min(Math.floor(Math.abs(accDelta) / THRESHOLD), 10);
      accDelta = 0;

      const curIdx = items.findIndex((f) => f.id === visibleIdRef.current);
      const nextIdx = Math.max(0, Math.min(
        (curIdx === -1 ? 0 : curIdx) + direction * jumps,
        items.length - 1,
      ));

      const nextId = items[nextIdx].id;
      if (nextId === visibleIdRef.current) return;

      const el = itemRefs.current.get(nextId);
      if (el) {
        scrollingFromClick.current = true;
        setVisibleId(nextId);
        el.scrollIntoView({ behavior: "instant", block: "start" });
        scrollingFromClick.current = false;
      }

      cooldown = true;
      setTimeout(() => { cooldown = false; }, 60);
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [feedRef, itemRefs, setVisibleId, scrollingFromClick]);

  // On mount, scroll to target item once rendered (after refresh on /generations/[id]).
  // Uses ResizeObserver to re-center when the image loads and changes the element height.
  const scrolledToTarget = useRef(false);
  useEffect(() => {
    if (scrolledToTarget.current || !scrollTarget) return;
    const el = itemRefs.current.get(scrollTarget);
    if (el) {
      scrolledToTarget.current = true;
      el.scrollIntoView({ behavior: "instant", block: "center" });
      const ro = new ResizeObserver(() => {
        el.scrollIntoView({ behavior: "instant", block: "center" });
      });
      ro.observe(el);
      const timer = setTimeout(() => ro.disconnect(), 3000);
      return () => { ro.disconnect(); clearTimeout(timer); };
    }
  }, [feedItems, scrollTarget, itemRefs]);

  // Stable ref callback — avoids React 19 cleanup/reattach cycles on every render
  const itemRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const id = el.dataset.itemId;
    if (id) itemRefs.current.set(id, el);
  }, [itemRefs]);

  const visibleIdx = feedItems.findIndex((f) => f.id === visibleId);

  // Imperatively prefetch + decode images ±PRELOAD_WINDOW around visible item
  // so they're in the GPU bitmap cache before the next scroll lands.
  const preloadedRef = useRef(new Set<string>());
  const [decodedSrcs, setDecodedSrcs] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visibleIdx === -1) return;
    const lo = Math.max(0, visibleIdx - PRELOAD_WINDOW);
    const hi = Math.min(feedItems.length - 1, visibleIdx + PRELOAD_WINDOW);
    for (let i = lo; i <= hi; i++) {
      const e = feedItems[i];
      let src: string | undefined;
      if (!e.isDb) {
        const mem = e as GeneratedItem & { isDb: false };
        src = mem.imageUrl;
      } else {
        const db = e as Extract<FeedEntry, { isDb: true }>;
        src = db.isVideo ? db.posterUrl ?? undefined : db.src;
      }
      if (src && !preloadedRef.current.has(src)) {
        preloadedRef.current.add(src);
        const img = new window.Image();
        const imgSrc = src;
        img.src = imgSrc;
        const markDecoded = () => {
          img.decode()
            .then(() => setDecodedSrcs((prev) => { const next = new Set(prev); next.add(imgSrc); return next; }))
            .catch(() => setDecodedSrcs((prev) => { const next = new Set(prev); next.add(imgSrc); return next; }));
        };
        if (img.complete) markDecoded();
        else { img.onload = markDecoded; img.onerror = markDecoded; }
      }
    }
  }, [visibleIdx, feedItems]);

  return (
    <div className="flex flex-col items-center">
      {feedItems.length === 0 && !isHistoryLoading && !sessionLoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="font-pixel text-[10px] uppercase text-muted-foreground/70">
            Create your first image or video
          </p>
          <button
            type="button"
            onClick={() => {
              setShowExplore(false);
              // Focus the prompt input
              const input = document.querySelector("textarea");
              if (input) input.focus();
            }}
            className="font-pixel text-[10px] uppercase border border-border px-4 py-1.5 text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Start creating
          </button>
        </div>
      )}
      {feedItems.map((entry, idx) => {
        const isInMemory = !entry.isDb;
        const item = isInMemory
          ? (entry as GeneratedItem & { isDb: false })
          : null;
        const dbEntry = !isInMemory
          ? (entry as Extract<FeedEntry, { isDb: true }>)
          : null;

        const entryId = entry.id;
        const entryPrompt = entry.prompt;
        const entryMode = entry.mode;
        const entryAspectRatio = entry.aspectRatio as AspectRatio;
        const entryProgress = progressMap.get(entryId);
        const nearVisible = Math.abs(idx - visibleIdx) <= PRELOAD_WINDOW;

        const isImageGenerating =
          item &&
          item.mode === "image" &&
          !item.base64 &&
          !item.imageUrl &&
          entryProgress != null;
        const isVideoInProgress =
          item &&
          item.mode === "video" &&
          (item.videoStatus === "pending" ||
            item.videoStatus === "in_progress");
        const isVideoFailed =
          item && item.mode === "video" && item.videoStatus === "failed";

        const imageSrc = item
          ? item.imageUrl ||
            (item.base64 ? `data:image/png;base64,${item.base64}` : undefined)
          : dbEntry && !dbEntry.isVideo
            ? dbEntry.src
            : undefined;
        const videoBlobSrc = item
          ? item.videoUrl
          : dbEntry?.isVideo
            ? dbEntry.src
            : undefined;
        const entryMuxId = item?.muxPlaybackId ?? dbEntry?.muxPlaybackId;
        const videoSrc = videoBlobSrc
          ? (entryMuxId ? muxStreamUrl(entryMuxId) : videoBlobSrc)
          : undefined;

        const isCompleted = !!(imageSrc || videoBlobSrc);
        const isVideo = entryMode === "video";

        return (
          <div
            key={entryId}
            ref={itemRefCallback}
            data-item-id={entryId}
            className="flex w-full flex-col px-4 md:px-8"
            style={{ height: "100cqh" }}
          >
            {/* Completed video — only load when My Work tab is active */}
            {isVideo && videoSrc && !showExplore ? (
              <VideoFeedCard
                videoSrc={videoSrc}
                poster={item?.imageUrl || dbEntry?.posterUrl || undefined}
                entryAspectRatio={entryAspectRatio}
                feedRef={feedRef}
              >
                {(video, controlsSlot) => (
                  <>
                    <div className="flex flex-1 flex-col items-center justify-center">
                      {video}
                    </div>
                    {controlsSlot}
                  </>
                )}
              </VideoFeedCard>
            ) : isVideo && videoSrc ? (
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className={`${FEED_MEDIA_CLASS}`} style={feedMediaStyle(entryAspectRatio)} />
              </div>
            ) : (
              /* Non-video media area — flex-1 centers content vertically */
              <div className="flex flex-1 flex-col items-center justify-center">
                {isImageGenerating && (
                  <div
                    className={`relative flex items-center justify-center border border-border/50 bg-muted/30 ${FEED_MEDIA_CLASS}`}
                    style={feedMediaStyle(entryAspectRatio)}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.03]"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--foreground)) 3px, hsl(var(--foreground)) 4px)",
                      }}
                    />
                    <div className="flex flex-col items-center gap-3">
                      <PixelProgress
                        value={entryProgress ?? 0}
                        label={`Generating ${entryProgress ?? 0}%`}
                      />
                      <button
                        type="button"
                        onClick={() => cancelItem(entryId)}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {isVideoInProgress && (
                  <div
                    className={`relative flex items-center justify-center border border-border/50 bg-muted/30 ${FEED_MEDIA_CLASS}`}
                    style={feedMediaStyle(entryAspectRatio)}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.03]"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--foreground)) 3px, hsl(var(--foreground)) 4px)",
                      }}
                    />
                    <div className="flex flex-col items-center gap-3">
                      <PixelProgress
                        value={Math.round(entryProgress ?? 0)}
                        label={`Generating ${Math.round(entryProgress ?? 0)}%`}
                      />
                      <button
                        type="button"
                        onClick={() => cancelItem(entryId)}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {isVideoFailed && (
                  <div
                    className={`flex items-center justify-center border border-border/50 bg-muted/30 p-8 ${FEED_MEDIA_CLASS}`}
                    style={feedMediaStyle(entryAspectRatio)}
                  >
                    <p className="font-pixel text-[10px] uppercase text-destructive">
                      {item?.videoError || "Failed"}
                    </p>
                  </div>
                )}

                {!isVideo && imageSrc && (
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({ src: imageSrc, alt: entryPrompt })
                    }
                    className="mx-auto block cursor-zoom-in"
                    aria-label={`View "${entryPrompt}" full size`}
                  >
                    <img
                      src={imageSrc}
                      alt={entryPrompt}
                      loading={nearVisible && !showExplore ? "eager" : "lazy"}
                      fetchPriority={entryId === visibleId ? "high" : "auto"}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; }}
                      className={`max-h-[calc(100dvh-14rem)] md:max-h-[calc(100dvh-10rem)] max-w-full object-contain transition-opacity duration-150 ${
                        imageSrc.startsWith("data:") || decodedSrcs.has(imageSrc) ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                )}
              </div>
            )}

            {/* Action bar — pinned to bottom */}
            {(isCompleted ||
              isImageGenerating ||
              isVideoInProgress ||
              isVideoFailed) && (
              <div className="shrink-0 border-t border-border/50 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-pixel text-[10px] lowercase text-muted-foreground select-text">
                    {entryPrompt}
                  </p>
                  <div className="flex shrink-0 items-center gap-3">
                    {!isVideo && imageSrc && item?.base64 && (
                      <button
                        type="button"
                        onClick={() => handleCopy(item)}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Copy
                      </button>
                    )}
                    {!isVideo && imageSrc && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("image");
                          setPrompt("");
                          toBase64Attachment(imageSrc).then((b64) => {
                            if (b64) setAttachment(b64);
                          });
                        }}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Edit
                      </button>
                    )}
                    {isVideo && videoSrc && (
                      <button
                        type="button"
                        onClick={() => {
                          setVideoAttachment(videoBlobSrc!);
                          setMode("video");
                          setPrompt("");
                        }}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Edit
                      </button>
                    )}
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => {
                          const href =
                            (isVideo ? videoBlobSrc : imageSrc) || "";
                          const ext = isVideo ? "mp4" : "png";
                          downloadOrOpen(href, `grok-${entryId.slice(0, 8)}.${ext}`);
                        }}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Download
                      </button>
                    )}
                    {(isCompleted || isVideoFailed) && (
                      <button
                        type="button"
                        onClick={() => deleteItem(entryId)}
                        className="font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[8px] uppercase text-muted-foreground/40">
                    {entryMode}
                  </span>
                  <span className="font-pixel text-[8px] text-muted-foreground/40">
                    {typeof entryAspectRatio === "string"
                      ? entryAspectRatio
                      : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
