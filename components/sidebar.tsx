"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import type { GeneratedItem } from "@/lib/types";

/** Route an image URL through Next.js image optimization for tiny sidebar thumbs. */
function thumbUrl(src: string, width = 128, quality = 60): string {
  if (src.startsWith("data:")) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

const SIDEBAR_PLAY_ICON = (
  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-white"><path d="M3 1.5v9l7.5-4.5z"/></svg>
  </div>
);

const PixelThumb = memo(function PixelThumb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 4;
    const gap = 1;
    const step = size + gap;
    const cols = Math.floor(canvas.width / step);
    const rows = Math.floor(canvas.height / step);
    const t = Date.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const phase = Math.sin(t * 0.003 + c * 1.1 + r * 1.7) * 0.5 + 0.5;
        const flicker = Math.sin(t * 0.005 + c * 2.3 + r * 0.7) * 0.5 + 0.5;
        const opacity = phase * flicker;

        if (opacity > 0.3) {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
          ctx.fillRect(c * step, r * step, size, size);
        }
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Defer animation start to idle — don't compete with critical rendering
    const idle = typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 200);
    const idleId = idle(() => {
      animRef.current = requestAnimationFrame(animate);
    });
    return () => {
      if (typeof cancelIdleCallback !== "undefined") cancelIdleCallback(idleId as number);
      cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-sm"
    />
  );
});

/** Lazy-loaded thumbnail — browser handles loading based on visibility. */
function LazyThumb({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" loading="lazy" decoding="async" className={className} />;
}

interface SidebarProps {
  items: GeneratedItem[];
  dbHistory: { id: string; mode: string; prompt: string; aspect_ratio: string; image_url: string | null; video_url: string | null; created_at: string }[];
  isHistoryLoading?: boolean;
  historyTotalCount?: number;
  historyHasMore?: boolean;
  historyLoadMore?: () => void;
  isHistoryLoadingMore?: boolean;
  activeId?: string | null;
  onSelectImage?: (id: string) => void;
  onExplore?: () => void;
  onMyWork?: () => void;
  showExplore?: boolean;
  width?: number;
  isResizing?: boolean;
  prefersReducedMotion?: boolean;
}

export function Sidebar({ items, dbHistory, isHistoryLoading, historyTotalCount, historyHasMore, historyLoadMore, isHistoryLoadingMore, activeId, onSelectImage, onExplore, onMyWork, showExplore, width, isResizing, prefersReducedMotion }: SidebarProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll sentinel — load more when it enters the viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !historyHasMore || !historyLoadMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          historyLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyHasMore, historyLoadMore]);

  // Thumbnails load on-demand via loading="lazy" — no bulk prefetch needed.

  useEffect(() => {
    if (!showHowItWorks) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowHowItWorks(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHowItWorks]);

  // Auto-scroll sidebar to keep active item visible
  useEffect(() => {
    if (!activeId) return;
    const el = document.querySelector(`[data-sidebar-item="${activeId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [activeId]);

  const pastItems = useMemo(() => {
    const inMemoryIds = new Set(items.map((i) => i.id));
    return dbHistory.filter((h) => !inMemoryIds.has(h.id));
  }, [items, dbHistory]);

  // Use real DB count when available, fall back to loaded count
  const totalCount = historyTotalCount ?? (items.length + pastItems.length);
  return (
    <aside
      className={`hidden shrink-0 flex-col overflow-hidden bg-background md:flex ${!isResizing && !prefersReducedMotion ? "transition-[width] duration-200 ease-out" : ""}`}
      style={{ width: width ?? 224 }}
    >
      <button
        type="button"
        onClick={onExplore}
        className={`flex w-full items-center gap-2 px-4 py-2 font-pixel text-xs uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
          showExplore
            ? "bg-muted/80 text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        Explore
      </button>
      <button
        type="button"
        onClick={onMyWork}
        className={`flex w-full items-center justify-between px-4 py-2 font-pixel text-xs uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
          !showExplore
            ? "bg-muted/80 text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <span>My work</span>
        <span className="text-muted-foreground/40">
          {totalCount}
        </span>
      </button>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        {totalCount === 0 && !isHistoryLoading && (
          <div className="px-4 py-6">
            <p className="font-pixel text-xs text-muted-foreground/70">
              No creations
            </p>
          </div>
        )}
        {items.map((item) => {
          const rawSrc = item.imageUrl
            || (item.base64 ? `data:image/png;base64,${item.base64}` : undefined);
          const thumbSrc = rawSrc ? thumbUrl(rawSrc) : undefined;
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              data-sidebar-item={item.id}
              onClick={() => {
                onSelectImage?.(item.id);
              }}
              onMouseEnter={() => {
                // Prefetch + decode the full image on hover so it's instant when clicked
                if (item.imageUrl) {
                  const i = new window.Image();
                  i.src = item.imageUrl;
                  i.decode().catch(() => {});
                }
              }}
              className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 ${
                isActive
                  ? "bg-muted/80"
                  : ""
              }`}
            >
              {thumbSrc ? (
                <LazyThumb
                  src={thumbSrc}
                  className="h-8 w-8 shrink-0 rounded-sm object-cover"
                />
              ) : item.mode === "video" && item.videoUrl ? (
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-muted">
                  <video muted playsInline preload="none" poster="" className="h-full w-full object-cover" />
                  {SIDEBAR_PLAY_ICON}
                </div>
              ) : (
                <PixelThumb />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-pixel text-xs lowercase text-muted-foreground group-hover:text-foreground">
                  {item.prompt}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[8px] uppercase text-muted-foreground/70">
                    {item.mode}
                  </span>
                  <span className="font-pixel text-[8px] text-muted-foreground/70">
                    {item.aspectRatio}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        {pastItems.map((h) => {
          const rawSrc = h.image_url || undefined;
          const thumbSrc = rawSrc ? thumbUrl(rawSrc) : undefined;
          const videoSrc = h.video_url || undefined;
          const isClickable = !!rawSrc || !!videoSrc;
          const isActive = h.id === activeId;
          return (
            <button
              key={h.id}
              type="button"
              data-sidebar-item={h.id}
              disabled={!isClickable}
              onClick={() => {
                if (isClickable) {
                  onSelectImage?.(h.id);
                }
              }}
              onMouseEnter={() => {
                // Prefetch + decode the full image on hover so it's instant when clicked
                if (rawSrc) {
                  const i = new window.Image();
                  i.src = rawSrc;
                  i.decode().catch(() => {});
                }
              }}
              className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors disabled:cursor-default disabled:hover:bg-transparent ${
                isActive
                  ? "bg-muted/80 opacity-100"
                  : "opacity-60 hover:bg-muted/50 hover:opacity-100 disabled:hover:opacity-60"
              }`}
            >
              {thumbSrc ? (
                <LazyThumb
                  src={thumbSrc}
                  className="h-8 w-8 shrink-0 rounded-sm object-cover"
                />
              ) : h.mode === "video" && videoSrc ? (
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-muted">
                  <video muted playsInline preload="none" poster="" className="h-full w-full object-cover" />
                  {SIDEBAR_PLAY_ICON}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-pixel text-xs lowercase text-muted-foreground group-hover:text-foreground">
                  {h.prompt}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[8px] uppercase text-muted-foreground/70">
                    {h.mode}
                  </span>
                  <span className="font-pixel text-[8px] text-muted-foreground/70">
                    {h.aspect_ratio}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        {/* Scroll sentinel for infinite loading */}
        {historyHasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-3">
            {isHistoryLoadingMore && (
              <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground/70" />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <a
          href="https://github.com/vercel/grokcreativestudiotemplate/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Feedback?
        </a>
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="font-pixel text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          How it works
        </button>
      </div>

      {showHowItWorks && (
        <div role="button" tabIndex={0} className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-background/80" onClick={() => setShowHowItWorks(false)} onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setShowHowItWorks(false); }}>
          <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col border border-border bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="font-pixel text-base uppercase text-foreground">How it works</h2>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="font-pixel text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-6 pb-6 scrollbar-thin">
            <div className="space-y-4 font-pixel text-xs leading-relaxed text-muted-foreground">
              <p className="text-muted-foreground/70">
                v0 template built on the Vercel platform. All source is deployable as-is.
              </p>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Image Generation &amp; Editing</h3>
                <p>
                  Both generation and editing go through a single{" "}
                  <code className="text-foreground">experimental_generateImage()</code> call
                  from the <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel AI SDK</a>, routed through{" "}
                  <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">AI Gateway</a> to{" "}
                  <code className="text-foreground">xai/grok-imagine-image</code>.
                  The gateway abstracts the provider &mdash; switching models is a
                  one-line change. When a source image is attached, the SDK wraps it
                  as a <code className="text-foreground">data:</code> URI and passes it
                  in <code className="text-foreground">prompt.images</code>, routing
                  to xAI&apos;s edit endpoint automatically. Dominant color
                  (1&times;1px resize) and blur placeholder (8px WebP, q10) are
                  extracted via <code className="text-foreground">sharp</code> so
                  the grid can show an instant preview before the full image loads.
                  After persistence, the image is uploaded to Mixedbread Store for
                  visual search indexing via{" "}
                  <code className="text-foreground">after()</code> &mdash; deferred
                  so it never blocks the response to the user.
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Video Generation &amp; Streaming</h3>
                <p>
                  Video generation takes 30&ndash;120 seconds &mdash; too long for
                  a single serverless function. <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel Workflows</a> provide
                  durable execution: each step is a checkpoint that survives
                  infrastructure restarts. Five retryable steps:{" "}
                  <code className="text-foreground">callGenerateVideo</code> &rarr;{" "}
                  <code className="text-foreground">uploadToMux</code> &rarr;{" "}
                  <code className="text-foreground">writeProgress</code> &rarr;{" "}
                  <code className="text-foreground">saveGeneration</code> &rarr;{" "}
                  <code className="text-foreground">closeStream</code>.
                  Generation calls{" "}
                  <code className="text-foreground">experimental_generateVideo()</code> via{" "}
                  <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">AI Gateway</a> to{" "}
                  <code className="text-foreground">xai/grok-imagine-video</code>{" "}
                  at 720p (5s or 10s duration). The MP4 is stored in <a href="https://vercel.com/docs/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel Blob</a>, then
                  uploaded to <a href="https://www.mux.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Mux</a> (public
                  playback, 1080p max tier) for HLS adaptive streaming. The workflow
                  fetches the Mux thumbnail and extracts dominant color + blur
                  placeholder via <code className="text-foreground">sharp</code> for
                  instant grid placeholders. User-uploaded videos for editing are
                  sent to <a href="https://vercel.com/docs/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel Blob</a> via client-side upload
                  (<code className="text-foreground">@vercel/blob/client</code>)
                  before reaching the workflow.
                  Grid videos stream at 360p via{" "}
                  <code className="text-foreground">hls.js</code> (6s buffer) &mdash;
                  higher resolution would waste bandwidth on small tiles. Detail view
                  locks to the highest level for full quality.
                  Mux auto-generates thumbnails and storyboard sprite sheets for seek
                  preview. Safari uses native HLS in the grid (its MediaSource
                  implementation is faster than hls.js for many concurrent streams);
                  Chrome/Firefox use hls.js. Supports text-to-video, image-to-video,
                  and video edit modes (including drag &amp; drop). Progress is streamed
                  to the client as newline-delimited JSON via the workflow&apos;s
                  readable stream.
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Search</h3>
                <p>
                  Two tiers run in parallel so results are both fast and
                  semantically rich. Text search uses
                  PostgreSQL{" "}
                  <code className="text-foreground">~*</code> regex word boundaries
                  for single words and{" "}
                  <code className="text-foreground">ILIKE</code> for multi-word
                  queries (up to 40 results). <a href="https://www.mixedbread.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Mixedbread Store</a> performs multimodal
                  visual search using{" "}
                  <code className="text-foreground">mxbai-wholembed-v3</code> &mdash;
                  encodes both images and text into the same embedding space
                  (score threshold 0.71, top 15). Results are merged with text
                  results taking priority, then deduped. Each tier has its own{" "}
                  <code className="text-foreground">catch</code> and 429 rate-limit
                  handling (60s cooldown) &mdash; if one tier fails, the other
                  still returns results.
                  Client-side scheduling via React&apos;s{" "}
                  <code className="text-foreground">useDeferredValue</code> instead of
                  a fixed debounce delay &mdash; React keeps showing old results
                  while preparing the new render, so typing always feels responsive.
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Performance</h3>
                <p>
                  A 1000-item compact manifest (tuples instead of objects to
                  minimize RSC payload) is served from a cached server function.
                  The SSR grid renders up to 200 items with color backgrounds;
                  the first 30 include blur placeholders &mdash; so the grid is
                  never empty on first paint. Server-side{" "}
                  <code className="text-foreground">preload()</code> emits{" "}
                  <code className="text-foreground">{"<link rel=\"preload\">"}</code> for the
                  first 20 images (5 high-priority). Above-fold images are prefetched +
                  decoded into GPU cache via{" "}
                  <code className="text-foreground">Image().decode()</code>. Image
                  display uses optimized <code className="text-foreground">/_next/image</code>{" "}
                  (AVIF/WebP, 1-year cache since images are immutable UUID keys).
                  Video posters are served direct from Mux CDN &mdash; Mux already
                  serves optimized WebP, so routing through the image proxy would
                  add a hop for no benefit. Originals only on download.{" "}
                  <code className="text-foreground">contentVisibility: auto</code> skips
                  layout/paint for off-screen grid items. Grid videos use Mux HLS capped
                  at 360p with scroll-idle scheduling (50ms): videos only load
                  after scrolling stops &mdash; loading during scroll wastes
                  bandwidth on tiles the user will never see. Off-viewport streams
                  are detached to free bandwidth.{" "}
                  <code className="text-foreground">requestVideoFrameCallback</code>{" "}
                  ensures videos reveal only after a frame is composited &mdash; no
                  flash on any browser. hls.js is lazy-loaded (~60KB off critical path).
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Caching</h3>
                <p>
                  The explore grid is public, non-personalized data &mdash; ideal
                  for caching. Seven <code className="text-foreground">{'"use cache"'}</code>{" "}
                  functions with granular lifetimes tuned to update frequency:
                  manifest (hours), feed pages (minutes), individual items (days),
                  search results (minutes). Edge cache headers on API routes
                  (explore 10s/30s SWR, search 30s/60s SWR). After each generation,{" "}
                  <code className="text-foreground">revalidateTag()</code> busts relevant
                  caches (global + item-level tags). CDN image cache warmed via{" "}
                  <code className="text-foreground">after()</code> at 3 sizes (384px,
                  640px, 828px) for the top 20 items &mdash; primes the CDN so the
                  next visitor gets a cache hit. Runs after response is sent, never
                  blocks the user.
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Infinite Scroll</h3>
                <p>
                  Offset-based pagination with{" "}
                  <code className="text-foreground">useSWRInfinite</code> (20 items/page).
                  First page is server-rendered via compact manifest so the grid is
                  visible before JS hydrates &mdash; no blank screen while React
                  boots. Next 3 pages prefetched via SWR&apos;s{" "}
                  <code className="text-foreground">preload()</code> on mount so
                  scrolling feels instant. Three independent load triggers ensure
                  no edge case is missed: scroll distance threshold (15k px),
                  post-load content-height check (10k px), and an
                  IntersectionObserver sentinel (10k px margin).
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Storage</h3>
                <p>
                  <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Neon</a> serverless Postgres for generations, users, and
                  metadata &mdash; scales to zero when idle.{" "}
                  <a href="https://vercel.com/docs/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel Blob</a> for original images and videos (1-year CDN cache,
                  immutable UUID keys &mdash; files never change so cache never
                  goes stale). <a href="https://www.mux.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Mux</a> handles video delivery &mdash; adaptive
                  bitrate transcoding and HLS streaming so we don&apos;t build our
                  own video pipeline. <a href="https://www.mixedbread.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Mixedbread Store</a> indexes every
                  generated image for multimodal visual retrieval &mdash; search
                  by text finds visually similar results, not just prompt matches.
                </p>
              </div>

              <div>
                <h3 className="mb-1 text-[13px] uppercase text-foreground">Stack</h3>
                <p>
                  <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Next.js 16</a> &middot; React 19 &middot;{" "}
                  <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel AI SDK</a> &middot;{" "}
                  <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">AI Gateway</a> &middot;{" "}
                  <a href="https://docs.x.ai" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">xAI Grok Imagine</a> &middot;{" "}
                  <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel Workflows</a> &middot;{" "}
                  <a href="https://vercel.com/docs/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel Blob</a> &middot;{" "}
                  <a href="https://www.mux.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Mux</a> &middot;{" "}
                  <a href="https://vercel.com/docs/oauth" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Vercel OAuth</a> &middot;{" "}
                  <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Neon Postgres</a> &middot;{" "}
                  <a href="https://www.mixedbread.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">Mixedbread AI</a> &middot;{" "}
                  <a href="https://swr.vercel.app" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-border hover:decoration-foreground">SWR</a> &middot; Tailwind CSS
                </p>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
