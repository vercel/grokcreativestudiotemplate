"use client";

import { startTransition, useCallback, useRef, useEffect, useLayoutEffect, useState, useMemo, useDeferredValue } from "react";
import useSWR, { preload } from "swr";
import useSWRInfinite, { type SWRInfiniteConfiguration } from "swr/infinite";
import Image from "next/image";
import dynamic from "next/dynamic";

import { ASPECT_RATIO_CSS, ASPECT_RATIO_FACTOR } from "@/lib/constants";
import type { ExploreRow, ExplorePage, SearchResult } from "@/lib/explore-queries";
import { muxGridStreamUrl, muxStreamUrl, muxThumbnailUrl, attachGridHls, detachHls, preloadHls } from "@/lib/hls";

// ============================================================
// Section 1: Types & Constants
// ============================================================

const Lightbox = dynamic(
  () => import("@/components/lightbox").then((m) => m.Lightbox),
  { ssr: false },
);

const PAGE_SIZE = 20;

interface ExploreGridProps {
  onSelectImage?: (image: {
    id: string;
    src: string;
    alt: string;
    isVideo?: boolean;
    userId: string;
    poster?: string;
    color?: string;
    muxPlaybackId?: string | null;
  }) => void;
  initialItems?: ExploreRow[];
  searchQuery?: string;
  searchFallbackData?: SearchResult | null;
  deleteItemRef?: React.MutableRefObject<((itemId: string) => void) | null>;
  scrollRef?: React.RefObject<HTMLElement | null>;
  knownImages?: Map<string, string>;
  /** When true, grid videos pause in place instead of detaching (prevents flash when overlay opens/closes) */
  overlayActive?: boolean;
}

// ── Grid Loading Priorities ───────────────────────────────────
//
// Core principle: load what the user sees NOW, prepare what they'll
// want NEXT, and never do work that competes with their current action.
//
// P0  The grid shell — the user never sees "black"
//     1. Background color renders instantly (SSR, inline style)
//     2. Blur placeholder fades in (base64 data-uri, no network)
//     3. Sharp image loads (next/image, eager above-fold, lazy below)
//     4. For videos: the poster IS the image. Same pipeline.
//     Infinite scroll: new items enter with color+blur immediately.
//     Result: scroll anywhere, at any speed, and every cell shows something.
//
// P1  Viewport gets absolute priority
//     When the user stops scrolling (or on first load), everything
//     outside the viewport is paused/cancelled. ALL visible videos
//     start downloading in parallel — no artificial concurrency limit.
//     The viewport is the natural limit. Above-fold videos start
//     downloading eagerly on mount (getBoundingClientRect, no IO wait).
//
// P2  Clicks open instantly
//     Only two image sizes exist: grid (~384px) and detail (1200px).
//     The lightbox uses the same 1200px — zero extra loads.
//     Desktop: on hover, prefetch 1200px and decode into GPU cache.
//     By the time the user clicks, it's ready. No transition needed.
//     Mobile: no hover. Show the grid-size image (already cached) as
//     an instant blurry placeholder, swap to 1200px when it arrives.
//     No fade transition — swap is instant, no flash.
//     Video clicks: poster (= grid image) shows instantly. If the grid
//     already downloaded the video, browser HTTP cache makes the detail
//     load near-instant. Playback starts from 0.
//     Download button: serves the original full-resolution file.
//
// P3  Detail/lightbox gets ALL bandwidth
//     The moment the detail opens, pause every grid video download.
//     Warm videos freeze on their last frame — no flicker, no re-download.
//     When the detail closes, wait 150ms before resuming grid videos.
//     If the user clicks another image within that window, the resume
//     is cancelled. Zero wasted work.
//
// P4  Scrolling doesn't waste bandwidth
//     While scrolling: abort downloads for videos that leave the viewport.
//     Don't start anything new — wait for scroll to stop (150ms idle).
//     After idle: snapshot the viewport, cancel everything outside it,
//     download what's visible (top-to-bottom order).
//     Already-watched videos stay warm (keep src, keep decoded frames).
//     When scrolled back into view, they resume instantly — no re-download.
//
// P5  No visual glitches
//     Warm videos: show frozen last frame (opacity 1). Resume is instant.
//     Cold videos: poster image is always visible underneath.
//     LRU eviction caps warm videos at 12 to bound GPU memory.
//     No opacity-0 flashes on any state transition.
//
// ──────────────────────────────────────────────────────────────


interface SharedObservers {
  registerLoad(el: Element, cb: () => void): void;
  unregisterLoad(el: Element): void;
  registerVis(el: Element, cb: (visible: boolean) => void): void;
  unregisterVis(el: Element): void;
  /** Re-observe all vis elements to trigger fresh intersection callbacks */
  reobserve(): void;
}

const ASPECT_HEIGHT_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(ASPECT_RATIO_FACTOR).map(([k, v]) => [k, 1 / v]),
);

const PLACEHOLDER_RATIOS = ["3/4", "1/1", "4/3", "9/16", "1/1", "3/4"] as const;

// Pre-compute the /_next/image optimized URL that the browser will actually request.
// Matches what next/image generates so browser cache is shared.
function nextImageUrl(src: string, w: number, q: number) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}

/** Prefetch + decode an image into the GPU bitmap cache.
 *  Returns a promise that resolves when the image is fully decoded. */
function prefetchAndDecode(src: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new window.Image();
    img.src = src;
    if (img.complete) { resolve(); return; }
    img.onload = () => { img.decode().then(resolve, resolve); };
    img.onerror = () => resolve();
  });
}

// Matches next.config.mjs deviceSizes + imageSizes (same as preload-images.ts)
const PRELOAD_QUALITY = 75;
// Must match preload-images.ts and next.config imageSizes+deviceSizes exactly
// so the SSR <img srcset> picks the same URL the <link rel="preload"> fetched.
const SSR_WIDTHS = [128, 256, 384, 640, 750, 828, 1080, 1200, 1920];
const SSR_SIZES = "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw";

// Lazily computed optimal image width for the grid tile size + device DPR.
// Shared across hooks and render so prefetched URLs match what <Image> requests.
const IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
let _gridImgWidth = 0;
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => { _gridImgWidth = 0; });
}
function getGridImageWidth(): number {
  if (_gridImgWidth > 0) return _gridImgWidth;
  if (typeof window === "undefined") return 640;
  const vw = window.innerWidth >= 1024 ? window.innerWidth * 0.2 : window.innerWidth * 0.33;
  const dpr = window.devicePixelRatio || 1;
  const target = Math.ceil(vw * dpr);
  _gridImgWidth = IMAGE_WIDTHS.find((s) => s >= target) || 640;
  return _gridImgWidth;
}


// ============================================================
// Section 2: Pure Helpers
// ============================================================

const computeCols = () => (window.innerWidth >= 1024 ? 5 : window.innerWidth >= 640 ? 3 : 2);

function distributeToColumns<T extends { aspect_ratio: string }>(items: T[], numCols: number): T[][] {
  const safeCols = Math.max(1, Math.floor(numCols) || 3);
  const columns: T[][] = Array.from({ length: safeCols }, () => []);
  const heights: number[] = new Array(safeCols).fill(0);
  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < safeCols; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    heights[shortest] += ASPECT_HEIGHT_MAP[item.aspect_ratio] || 1;
  }
  return columns;
}

const feedFetcher = async (url: string): Promise<ExplorePage> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Explore fetch failed: ${res.status}`);
  return res.json();
};

const searchFetcher = async (url: string): Promise<SearchResult> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
};

// ============================================================
// Section 3: Custom Hooks
// ============================================================

function useColumnCount() {
  const [state, setState] = useState(() => ({ count: 2, hydrated: false }));
  useLayoutEffect(() => {
    setState({ count: computeCols(), hydrated: true });
    const onResize = () => setState((prev) => ({ ...prev, count: computeCols() }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return state;
}


function useSharedObservers(scrollRef: React.RefObject<HTMLElement | null> | undefined): SharedObservers {
  const loadCallbacks = useRef(new Map<Element, () => void>());
  const visCallbacks = useRef(new Map<Element, (visible: boolean) => void>());
  const loadObsRef = useRef<IntersectionObserver | null>(null);
  const visObsRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const root = scrollRef?.current ?? null;
    loadObsRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const cb = loadCallbacks.current.get(e.target);
            if (cb) { cb(); loadCallbacks.current.delete(e.target); loadObsRef.current?.unobserve(e.target); }
          }
        }
      },
      { root, rootMargin: "200px" },
    );
    visObsRef.current = new IntersectionObserver(
      (entries) => { for (const e of entries) { const cb = visCallbacks.current.get(e.target); if (cb) cb(e.isIntersecting); } },
      { root, rootMargin: "400px" },
    );
    for (const el of loadCallbacks.current.keys()) loadObsRef.current.observe(el);
    for (const el of visCallbacks.current.keys()) visObsRef.current.observe(el);
    return () => { loadObsRef.current?.disconnect(); visObsRef.current?.disconnect(); };
  }, [scrollRef]);

  return useMemo<SharedObservers>(() => ({
    registerLoad(el, cb) { loadCallbacks.current.set(el, cb); loadObsRef.current?.observe(el); },
    unregisterLoad(el) { loadCallbacks.current.delete(el); loadObsRef.current?.unobserve(el); },
    registerVis(el, cb) { visCallbacks.current.set(el, cb); visObsRef.current?.observe(el); },
    unregisterVis(el) { visCallbacks.current.delete(el); visObsRef.current?.unobserve(el); },
    reobserve() {
      for (const el of visCallbacks.current.keys()) { visObsRef.current?.unobserve(el); visObsRef.current?.observe(el); }
    },
  }), []);
}

const SCROLL_IDLE_MS = 50;

function useGridVideos(
  observers: SharedObservers,
  scrollRef: React.RefObject<HTMLElement | null> | undefined,
  overlayActive: boolean,
) {
  const hlsMap = useRef(new Map<string, import("hls.js").default | null>());
  const videosRef = useRef(new Map<string, { video: HTMLVideoElement; inZone: boolean }>());
  const scrollingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef(overlayActive);
  overlayRef.current = overlayActive;

  // When overlay opens: pause all videos (keep HLS attached, keep opacity).
  // When overlay closes: resume visible videos instantly (no re-download).
  const prevOverlay = useRef(overlayActive);
  useEffect(() => {
    if (prevOverlay.current === overlayActive) return;
    prevOverlay.current = overlayActive;
    if (overlayActive) {
      // Pause all — keep frames visible
      for (const [, entry] of videosRef.current) {
        entry.video.pause();
      }
    } else {
      // Resume visible videos after a short delay so the overlay has time to unmount
      const timer = setTimeout(() => {
        for (const [url, entry] of videosRef.current) {
          if (entry.inZone && hlsMap.current.has(url)) {
            entry.video.play().catch(() => {});
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [overlayActive]);

  const attachVideo = useCallback((url: string, video: HTMLVideoElement) => {
    if (hlsMap.current.has(url)) return;
    hlsMap.current.set(url, null); // mark as loading
    attachGridHls(video, url).then((hls) => {
      hlsMap.current.set(url, hls);
      const play = () => {
        // Don't start playback if overlay opened while we were loading
        if (overlayRef.current) {
          // Still reveal the first frame so there's no black flash later
          const reveal = () => { video.style.opacity = "1"; };
          if ("requestVideoFrameCallback" in video) {
            (video as any).requestVideoFrameCallback(reveal);
          } else {
            requestAnimationFrame(reveal);
          }
          return;
        }
        video.play().then(() => {
          // Wait until the browser has actually painted a video frame before
          // making it visible. requestVideoFrameCallback fires at the exact
          // moment a frame is composited — no intermediate artifacts.
          const reveal = () => { video.style.opacity = "1"; };
          if ("requestVideoFrameCallback" in video) {
            (video as any).requestVideoFrameCallback(reveal);
          } else {
            requestAnimationFrame(reveal);
          }
        }).catch(() => {});
      };
      if (video.readyState >= 2) play();
      else video.addEventListener("canplay", play, { once: true });
    });
  }, []);

  // After scroll stops: detach stale HLS, attach + play visible ones
  const schedulePass = useCallback(() => {
    // Skip detach/attach cycle while overlay is covering the grid
    if (overlayRef.current) return;
    for (const [url, entry] of videosRef.current) {
      if (entry.inZone) {
        attachVideo(url, entry.video);
      } else {
        entry.video.pause();
        const hls = hlsMap.current.get(url);
        if (hls) {
          detachHls(hls);
          hlsMap.current.delete(url);
          entry.video.style.opacity = "0";
          entry.video.removeAttribute("src");
          entry.video.load();
        }
      }
    }
  }, []);

  // Scroll listener: flag scrolling, schedule cleanup on idle
  useEffect(() => {
    const scrollEl = scrollRef?.current;
    if (!scrollEl) return;
    const onScroll = () => {
      scrollingRef.current = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        scrollingRef.current = false;
        schedulePass();
      }, SCROLL_IDLE_MS);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [scrollRef, schedulePass]);

  const registerVideoRef = useCallback((streamUrl: string, el: HTMLDivElement | null) => {
    if (!el) return;
    const video = el.querySelector("video");
    if (!video) return;

    // Skip if same DOM element is already registered for this URL
    const existing = videosRef.current.get(streamUrl);
    if (existing?.video === video) return;

    // Clean up stale HLS attached to the old (now-dead) video element
    // (happens when search→feed toggle recreates DOM nodes for the same URL)
    if (existing) {
      const hls = hlsMap.current.get(streamUrl);
      if (hls) { detachHls(hls); hlsMap.current.delete(streamUrl); }
    }

    videosRef.current.set(streamUrl, { video, inZone: false });

    observers.registerVis(el, (visible) => {
      const entry = videosRef.current.get(streamUrl);
      if (!entry) return;
      entry.inZone = visible;

      // When overlay is active, ignore intersection changes — the overlay
      // covering items shouldn't trigger detach/attach cycles.
      if (overlayRef.current) return;

      // During scroll, just track zone state — schedulePass handles the rest.
      // When idle (not scrolling), act immediately.
      if (!scrollingRef.current) {
        if (visible) {
          attachVideo(streamUrl, video);
        } else {
          video.pause();
        }
      }
    });

    // Eagerly start above-fold videos on mount — use rAF to batch layout reads
    requestAnimationFrame(() => {
      if (overlayRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0) {
        preloadHls();
        const entry = videosRef.current.get(streamUrl);
        if (entry) {
          entry.inZone = true;
          attachVideo(streamUrl, video);
        }
      }
    });
  }, [observers, attachVideo]);

  useEffect(() => {
    return () => {
      for (const hls of hlsMap.current.values()) detachHls(hls);
      hlsMap.current.clear();
      videosRef.current.clear();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  return registerVideoRef;
}


function useInfiniteScroll(
  scrollRef: React.RefObject<HTMLElement | null> | undefined,
  setSize: (fn: (s: number) => number) => void,
  canLoadRef: React.RefObject<boolean>,
  pagesLoaded: number,
  isLoadingMore: boolean,
) {
  const loadRef = useRef(() => {});
  loadRef.current = () => {
    if (!canLoadRef.current) return;
    startTransition(() => { setSize((s) => s + 1); });
  };

  // Scroll-based trigger
  useEffect(() => {
    const scrollEl = scrollRef?.current;
    if (!scrollEl) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!canLoadRef.current) return;
        if (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 15000) loadRef.current();
      });
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollRef, canLoadRef]);

  // Post-load content check (trigger again if still near bottom)
  useEffect(() => {
    if (pagesLoaded === 0 || isLoadingMore) return;
    const scrollEl = scrollRef?.current;
    if (!scrollEl) return;
    const raf = requestAnimationFrame(() => {
      if (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 10000) loadRef.current();
    });
    return () => cancelAnimationFrame(raf);
  }, [pagesLoaded, isLoadingMore, scrollRef]);

  // IO sentinel
  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver(
        (entries) => { if (entries[0].isIntersecting) loadRef.current(); },
        { root: scrollRef?.current ?? null, rootMargin: "10000px" },
      );
      observer.current.observe(node);
    },
    [scrollRef],
  );

  return sentinelRef;
}

// ============================================================
// Section 4: SSR Grid (pre-hydration, responsive columns)
// ============================================================

type SsrItem = { id: string; aspect_ratio: string; color?: string | null; blurDataURL?: string; image_url?: string };

function renderSsrGrid(items: SsrItem[], columnCount?: number) {
  const renderCols = (cols: SsrItem[][], globalOffset: number) =>
    cols.map((colItems, ci) => (
      <div key={ci} className="flex flex-1 flex-col gap-px">
        {colItems.map((item, ri) => {
          const cssAspect = ASPECT_RATIO_CSS[item.aspect_ratio as keyof typeof ASPECT_RATIO_CSS] || "1/1";
          const hasBlur = !!item.blurDataURL;
          const globalIdx = ri * cols.length + ci + globalOffset;
          return (
            <div
              key={item.id}
              className="relative overflow-hidden"
              style={{
                aspectRatio: cssAspect,
                ...(hasBlur
                  ? { backgroundImage: `url(${item.blurDataURL})`, backgroundSize: "cover" }
                  : {}),
                backgroundColor: item.color || "hsl(var(--muted))",
              }}
            >
              {item.image_url && (
                <img
                  alt=""
                  loading={globalIdx < 5 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={globalIdx < 5 ? "high" : undefined}
                  srcSet={SSR_WIDTHS.map((w) => `/_next/image?url=${encodeURIComponent(item.image_url!)}&w=${w}&q=${PRELOAD_QUALITY} ${w}w`).join(", ")}
                  sizes={SSR_SIZES}
                  src={`/_next/image?url=${encodeURIComponent(item.image_url!)}&w=640&q=${PRELOAD_QUALITY}`}
                  className="absolute inset-0 h-full w-full object-cover text-transparent"
                />
              )}
            </div>
          );
        })}
      </div>
    ));

  if (columnCount) {
    return (
      <div className="flex gap-px">{renderCols(distributeToColumns(items, columnCount), 0)}</div>
    );
  }

  // CSS-based responsive columns: browser applies the correct breakpoint instantly,
  // no JS needed — prevents flash/layout shift during SSR → hydration.
  // Images inside display:none containers are not downloaded by modern browsers.
  return (
    <>
      <div className="flex gap-px sm:hidden">{renderCols(distributeToColumns(items, 2), 0)}</div>
      <div className="hidden gap-px sm:flex lg:hidden">{renderCols(distributeToColumns(items, 3), 0)}</div>
      <div className="hidden gap-px lg:flex">{renderCols(distributeToColumns(items, 5), 0)}</div>
    </>
  );
}

// ============================================================
// Section 5: ExploreGrid Component
// ============================================================

export function ExploreGrid({
  onSelectImage,
  initialItems,
  searchQuery = "",
  searchFallbackData,
  deleteItemRef,
  scrollRef,
  knownImages,
  overlayActive = false,
}: ExploreGridProps) {
  // --- State ---
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const handleLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), []);
  const debouncedQuery = useDeferredValue(searchQuery ?? "");
  const isSearching = debouncedQuery.length > 0;
  const { count: columnCount, hydrated } = useColumnCount();
  const [serverItems] = useState<ExploreRow[]>(initialItems ?? []);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Scroll to top on search change (skip initial mount to preserve scroll position)
  const searchMountRef = useRef(true);
  useEffect(() => {
    if (searchMountRef.current) { searchMountRef.current = false; return; }
    scrollRef?.current?.scrollTo(0, 0);
  }, [debouncedQuery, scrollRef]);

  // --- Hooks composition ---
  const observers = useSharedObservers(scrollRef);
  const registerVideoRef = useGridVideos(observers, scrollRef, overlayActive);

  // --- Feed (infinite scroll) ---
  const getKey = useCallback(
    (pageIndex: number, previousPageData: ExplorePage | null) => {
      // End of feed: last page returned fewer items than PAGE_SIZE
      if (previousPageData && previousPageData.items.length < PAGE_SIZE) return null;
      // Page 0 starts right after server items (offset 0 if no SSR data)
      const offset = serverItems.length + pageIndex * PAGE_SIZE;
      return `/api/explore?offset=${offset}`;
    },
    [serverItems.length],
  );

  const swrOptions: SWRInfiniteConfiguration<ExplorePage> = {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    revalidateAll: false,
    dedupingInterval: 10_000,
  };

  const {
    data: feedData,
    error: feedError,
    size,
    setSize,
    isLoading: feedLoading,
    mutate: feedMutate,
  } = useSWRInfinite<ExplorePage>(getKey, feedFetcher, swrOptions);

  const feedItems = useMemo(() => {
    const seen = new Set<string>();
    const out: ExploreRow[] = [];
    // Server items first (manifest), minus deleted
    for (const item of serverItems) {
      if (deletedIds.has(item.id)) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    // Then feed pages, deduped against server items AND against each other
    if (feedData) {
      for (const page of feedData) {
        for (const item of page.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          out.push(item);
        }
      }
    }
    return out;
  }, [serverItems, deletedIds, feedData]);

  const hasServerItems = serverItems.length > 0;
  const isEmpty = !hasServerItems && feedData?.[0]?.items.length === 0;
  const isReachingEnd = isEmpty || (
    (serverItems.length === 0 && (!feedData || feedData.length === 0)) ||
    (feedData != null && feedData.some((page) => page.items.length < PAGE_SIZE))
  );

  // --- Search ---
  const { data: searchData, error: searchError, isLoading: searchLoading, mutate: searchMutate } = useSWR(
    isSearching ? `/api/explore/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    searchFetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 120_000,
      keepPreviousData: false,
      ...(searchFallbackData ? { fallbackData: searchFallbackData } : {}),
    },
  );

  const searchItems = searchData?.items ?? [];

  // --- Display items ---
  // While searching: show results when ready, empty grid while loading (never the feed)
  const displayItems = isSearching ? searchItems : feedItems;
  const isLoading = isSearching ? false : feedLoading;
  const error = isSearching ? searchError : feedError;

  // --- Optimistic delete ---
  const deleteItem = useCallback(
    (itemId: string) => {
      setDeletedIds((prev) => new Set(prev).add(itemId));
      feedMutate(
        (pages) => pages?.map((page) => ({ ...page, items: page.items.filter((i) => i.id !== itemId) })),
        { revalidate: false },
      );
      searchMutate(
        (data) => data ? { items: data.items.filter((i: ExploreRow) => i.id !== itemId) } : data,
        { revalidate: false },
      );
    },
    [feedMutate, searchMutate],
  );

  useEffect(() => {
    if (deleteItemRef) deleteItemRef.current = deleteItem;
  }, [deleteItemRef, deleteItem]);

  // --- Column layout ---
  const columns = useMemo(
    () => distributeToColumns(displayItems, columnCount),
    [displayItems, columnCount],
  );

  const globalIndexMap = useMemo(() => {
    const gMap = new Map<string, number>();
    const maxLen = Math.max(...columns.map((c) => c.length), 0);
    let gIdx = 0;
    for (let row = 0; row < maxLen; row++) {
      for (const col of columns) {
        if (row < col.length) {
          gMap.set(col[row].id, gIdx++);
        }
      }
    }
    return gMap;
  }, [columns]);

  // --- Infinite scroll ---
  const pagesLoaded = feedData?.length ?? 0;
  const isLoadingMore = size > 0 && feedData != null && typeof feedData[size - 1] === "undefined";
  const canLoadRef = useRef(true);
  canLoadRef.current = !isSearching && !isReachingEnd && !isLoadingMore;

  const sentinelRef = useInfiniteScroll(scrollRef, setSize, canLoadRef, pagesLoaded, isLoadingMore);

  // --- Image preloading ---
  // Prefetch + decode above-fold grid images into GPU cache.
  // Uses Image().decode() instead of <link rel=preload> to avoid
  // Safari's "preloaded but not used" warnings.
  useEffect(() => {
    if (serverItems.length === 0) return;
    const w = getGridImageWidth();
    const ABOVE_FOLD = 20;
    for (let i = 0; i < Math.min(ABOVE_FOLD, serverItems.length); i++) {
      const item = serverItems[i];
      if (item.image_url) {
        prefetchAndDecode(nextImageUrl(item.image_url, w, i < 10 ? 75 : 60));
      }
    }
  }, [serverItems]);

  // Prefetch next 3 pages in parallel (Midjourney-style)
  useEffect(() => {
    if (isSearching || serverItems.length === 0) return;
    for (let i = 0; i < 3; i++) {
      const offset = serverItems.length + i * PAGE_SIZE;
      preload(`/api/explore?offset=${offset}`, feedFetcher);
    }
  }, [serverItems.length, isSearching]);

  // --- SSR grid items (must be before early returns — hooks rules) ---
  const SSR_BLUR_LIMIT = 30;
  const SSR_SKELETON_LIMIT = 200;
  const ssrItems: SsrItem[] = useMemo(() =>
    (serverItems.length > 0 ? serverItems : displayItems)
      .slice(0, SSR_SKELETON_LIMIT)
      .map((item, i) =>
        i < SSR_BLUR_LIMIT
          ? { id: item.id, aspect_ratio: item.aspect_ratio, color: item.color, blurDataURL: item.blurDataURL }
          : { id: item.id, aspect_ratio: item.aspect_ratio, color: item.color }
      ),
    [serverItems, displayItems],
  );
  const showSsrGrid = ssrItems.length > 0;

  // Fade out SSR grid after client images have time to load from cache.
  // On client navigations (readyState already "complete"), skip immediately.
  const [ssrFaded, setSsrFaded] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") {
      setSsrFaded(true);
      return;
    }
    if (!hydrated) return;
    const timer = setTimeout(() => setSsrFaded(true), 400);
    return () => clearTimeout(timer);
  }, [hydrated]);

  // ============================================================
  // Render
  // ============================================================

  // Skeleton state
  if (isLoading && displayItems.length === 0) {
    const placeholders = Array.from({ length: 20 }, (_, i) => ({
      aspect_ratio: PLACEHOLDER_RATIOS[i % PLACEHOLDER_RATIOS.length].replace("/", ":"),
      key: i,
    }));
    const skeletonCols = distributeToColumns(placeholders, columnCount);
    return (
      <div className="flex gap-px">
        {skeletonCols.map((col, ci) => (
          <div key={ci} className="flex flex-1 flex-col gap-px">
            {col.map((p) => (
              <div key={p.key} className="w-full shimmer-bg" style={{ aspectRatio: ASPECT_RATIO_CSS[p.aspect_ratio as keyof typeof ASPECT_RATIO_CSS] || "1/1" }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error && displayItems.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="font-pixel text-xs text-destructive/70">{isSearching ? "Search failed" : "Failed to load creations"}</p>
        <button type="button" onClick={() => isSearching ? searchMutate() : feedMutate()} className="border border-border bg-background px-4 py-1.5 font-pixel text-[10px] uppercase text-foreground transition-colors hover:bg-foreground hover:text-background">Retry</button>
      </div>
    );
  }

  // Empty state
  const searchFinished = isSearching && !searchLoading && searchData;
  if (!isLoading && displayItems.length === 0 && (!isSearching || searchFinished)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="font-pixel text-xs text-muted-foreground/70">
          {isSearching ? "No results found" : "No community creations. Be the first!"}
        </p>
      </div>
    );
  }

  // --- Grid ---
  // SSR grid stays in DOM as visual fallback until client grid is mounted.
  // Both exist simultaneously — no destructive DOM swap, no flash.

  return (
    <>
      {/* Overlay container: SSR grid sits on top of client grid, fades out */}
      <div className="relative">
        {showSsrGrid && !ssrFaded && (
          <div className={hydrated ? "pointer-events-none absolute inset-x-0 top-0 z-[1]" : ""}>
            {renderSsrGrid(ssrItems)}
          </div>
        )}

        {/* Client grid: mounted after hydration, renders underneath SSR */}
        {hydrated && (
          <div className="flex gap-px">
              {columns.map((colItems, colIdx) => (
                  <div key={colIdx} className="flex flex-1 flex-col gap-px">
                    {colItems.map((item) => {
                      const isVideo = item.mode === "video" && !!item.video_url;
                      const mediaSrc = isVideo ? item.video_url! : item.image_url;
                      const posterSrc = isVideo && item.mux_playback_id
                        ? muxThumbnailUrl(item.mux_playback_id, 640)
                        : item.image_url;
                      const globalIdx = globalIndexMap.get(item.id) ?? 999;
                      const isAboveFold = globalIdx < 20;
                      const cssAspect = ASPECT_RATIO_CSS[item.aspect_ratio as keyof typeof ASPECT_RATIO_CSS] || "1/1";
                      const knownSrc = !isVideo ? knownImages?.get(item.id) : undefined;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          style={{
                            contentVisibility: "auto",
                            aspectRatio: cssAspect,
                            backgroundColor: item.color || "hsl(var(--muted))",
                          }}
                          onMouseEnter={() => {
                            if (isVideo) {
                              if (item.mux_playback_id) {
                                preloadHls();
                                fetch(muxStreamUrl(item.mux_playback_id)).catch(() => {});
                              }
                            } else if (posterSrc) {
                              const w = getGridImageWidth();
                              prefetchAndDecode(nextImageUrl(posterSrc, w, isAboveFold ? 75 : 60));
                              prefetchAndDecode(nextImageUrl(posterSrc, 1200, 75));
                            }
                          }}
                          onClick={() => {
                            if (onSelectImage) {
                              if (isVideo) preloadHls();
                              onSelectImage({ id: item.id, src: mediaSrc, alt: item.prompt, isVideo, userId: item.user_id, poster: posterSrc || undefined, color: item.color || undefined, muxPlaybackId: item.mux_playback_id });
                            } else {
                              handleLightbox(mediaSrc, item.prompt);
                            }
                          }}
                          className="group relative block w-full cursor-pointer overflow-hidden focus:outline-none"
                        >
                          <div
                            ref={isVideo && item.mux_playback_id ? (el) => registerVideoRef(muxGridStreamUrl(item.mux_playback_id!), el) : undefined}
                            className={`relative h-full overflow-hidden ${!item.blurDataURL && !knownSrc && !item.color ? "shimmer-bg" : ""}`}
                            style={{
                              ...(knownSrc
                                ? { backgroundImage: `url(${knownSrc})`, backgroundSize: "cover", backgroundPosition: "center" }
                                : {}),
                            }}
                          >
                            {isVideo && item.mux_playback_id ? (
                              <img
                                src={posterSrc!}
                                alt={item.prompt}
                                loading={isAboveFold ? "eager" : "lazy"}
                                decoding="async"
                                {...(globalIdx < 5 ? { fetchPriority: "high" as const } : {})}
                                className="absolute inset-0 h-full w-full object-cover text-transparent"
                              />
                            ) : (
                              <Image
                                src={posterSrc || "/placeholder.svg"}
                                alt={item.prompt}
                                fill
                                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                                quality={isAboveFold ? 75 : 60}
                                loading={isAboveFold ? "eager" : "lazy"}
                                priority={globalIdx < 5}
                                {...(globalIdx < 5 ? { fetchPriority: "high" as const } : {})}
                                {...(item.blurDataURL ? { placeholder: "blur" as const, blurDataURL: item.blurDataURL } : {})}
                                className="object-cover text-transparent"
                              />
                            )}
                            {isVideo && item.mux_playback_id && (
                              <video muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0, willChange: "opacity", transition: "opacity 150ms" }} />
                            )}
                          </div>
                          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100 md:pointer-events-auto max-md:hidden">
                            <div className="p-3">
                              <p className="line-clamp-2 text-left font-pixel text-[10px] lowercase leading-relaxed text-foreground">{item.prompt}</p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="font-pixel text-[8px] text-muted-foreground">{item.user_name || "Anonymous"}</span>
                                <span className="ml-auto font-pixel text-[8px] text-muted-foreground/70">{item.aspect_ratio}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Infinite scroll sentinel (invisible) */}
        {hydrated && !isSearching && !isReachingEnd && (
          <div ref={sentinelRef} className="h-px" />
        )}

        {/* Bottom spacing */}
        {hydrated && <div className="h-28 md:h-16" />}

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
