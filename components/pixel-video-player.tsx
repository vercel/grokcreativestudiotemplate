"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { attachHls, detachHls, muxStoryboardUrl } from "@/lib/hls";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PAUSE_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <rect x="1.5" y="1" width="3" height="10" rx="0.5" />
    <rect x="7.5" y="1" width="3" height="10" rx="0.5" />
  </svg>
);

const PLAY_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M2.5 1v10l8.5-5z" />
  </svg>
);

const MUTED_ICON = (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
    <path d="M0 3.5h2L5 0.5v11l-3-3H0v-5z" />
    <path d="M9 3l3.5 3L9 9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UNMUTED_ICON = (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
    <path d="M0 3.5h2L5 0.5v11l-3-3H0v-5z" />
    <path d="M8.5 4a2 2 0 010 4" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M10 2a5 5 0 010 8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

const FULLSCREEN_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1,4 1,1 4,1" />
    <polyline points="8,1 11,1 11,4" />
    <polyline points="11,8 11,11 8,11" />
    <polyline points="4,11 1,11 1,8" />
  </svg>
);

interface PixelVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  onVideoRef?: (video: HTMLVideoElement | null) => void;
  onClick?: (e: React.MouseEvent) => void;
  /** Render controls below the video instead of overlaying on top */
  controlsBelow?: boolean;
  /** When set, portal controls into this external container instead of rendering inline */
  controlsPortalTarget?: HTMLDivElement | null;
  /** Mux playback ID — enables storyboard seek preview */
  muxPlaybackId?: string;
  /** Background color shown while poster loads */
  bgColor?: string;
}

interface StoryboardData {
  url: string;
  tile_width: number;
  tile_height: number;
  tiles: { start: number; x: number; y: number }[];
}

export function PixelVideoPlayer({
  src,
  poster,
  autoPlay = true,
  muted = true,
  loop = true,
  className = "",
  onVideoRef,
  onClick,
  controlsBelow = false,
  controlsPortalTarget,
  muxPlaybackId,
  bgColor,
}: PixelVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [showControls, setShowControls] = useState(false);
  const isSeekingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const storyboardRef = useRef<StoryboardData | null>(null);

  // Fetch storyboard data for seek preview
  useEffect(() => {
    if (!muxPlaybackId) return;
    const controller = new AbortController();
    fetch(muxStoryboardUrl(muxPlaybackId), { signal: controller.signal })
      .then((r) => r.json())
      .then((data: StoryboardData) => {
        storyboardRef.current = data;
        // Preload the sprite sheet
        const img = new window.Image();
        img.src = data.url;
      })
      .catch(() => {});
    return () => controller.abort();
  }, [muxPlaybackId]);
  const durationRef = useRef(0);

  // Attach HLS.js (or native HLS / direct src) when src changes
  const hlsRef = useRef<import("hls.js").default | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    detachHls(hlsRef.current);
    hlsRef.current = null;
    attachHls(v, src).then((hls) => {
      if (!cancelled) hlsRef.current = hls;
    });
    return () => {
      cancelled = true;
      detachHls(hlsRef.current);
      hlsRef.current = null;
    };
  }, [src]);

  // Wait for enough buffer, play, then reveal only after a frame is painted.
  // Safari briefly renders video at native resolution before object-contain
  // applies — keeping opacity:0 until requestVideoFrameCallback prevents this.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoPlay) return;
    v.style.opacity = "0";
    const onReady = () => {
      v.play().then(() => {
        setPlaying(true);
        const reveal = () => {
          v.style.opacity = "1";
        };
        if ("requestVideoFrameCallback" in v) {
          (v as any).requestVideoFrameCallback(reveal);
        } else {
          requestAnimationFrame(reveal);
        }
      }).catch(() => {
        setPlaying(false);
        v.style.opacity = "1"; // Show even if autoplay blocked
      });
    };
    if (v.readyState >= 3) { onReady(); return; }
    v.addEventListener("canplaythrough", onReady, { once: true });
    return () => v.removeEventListener("canplaythrough", onReady);
  }, [autoPlay, src]);

  useEffect(() => {
    onVideoRef?.(videoRef.current);
    return () => onVideoRef?.(null);
  }, [onVideoRef]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const handleMouseLeave = useCallback(() => {
    if (isSeekingRef.current) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 800);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // Smooth progress via rAF — updates DOM directly, no React re-renders
  const rafRef = useRef(0);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onDur = () => {
      const d = v.duration;
      if (d && Number.isFinite(d)) durationRef.current = d;
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const updateDOM = () => {
      const d = durationRef.current;
      if (d > 0) {
        const pct = (v.currentTime / d) * 100;
        if (progressBarRef.current) progressBarRef.current.style.width = `${pct}%`;
        if (timeRef.current) timeRef.current.textContent = `${formatTime(v.currentTime)} / ${formatTime(d)}`;
      }
    };
    const tick = () => {
      updateDOM();
      rafRef.current = requestAnimationFrame(tick);
    };
    const startRaf = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    const stopRaf = () => {
      cancelAnimationFrame(rafRef.current);
      updateDOM();
    };
    // Update DOM on seek (e.g. user scrubs while paused) without killing
    // the rAF loop — looping videos fire `seeked` without pausing, so
    // cancelling the rAF here would freeze the progress bar on the 2nd loop.
    const onSeeked = () => updateDOM();

    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("play", startRaf);
    v.addEventListener("pause", onPause);
    v.addEventListener("pause", stopRaf);
    v.addEventListener("seeked", onSeeked);
    // Metadata may already be loaded before this effect runs (autoPlay)
    onDur();
    if (!v.paused) startRaf();
    return () => {
      cancelAnimationFrame(rafRef.current);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("play", startRaf);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("pause", stopRaf);
      v.removeEventListener("seeked", onSeeked);
    };
  }, []);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const showStoryboardPreview = useCallback((clientX: number) => {
    const bar = progressRef.current;
    const preview = previewRef.current;
    const sb = storyboardRef.current;
    const d = durationRef.current;
    if (!bar || !preview || !sb || !d || sb.tiles.length === 0) {
      if (preview) preview.style.display = "none";
      return;
    }
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = ratio * d;

    // Find the tile for this time
    let tile = sb.tiles[0];
    for (let i = sb.tiles.length - 1; i >= 0; i--) {
      if (time >= sb.tiles[i].start) { tile = sb.tiles[i]; break; }
    }

    preview.style.display = "block";
    preview.style.width = `${sb.tile_width}px`;
    preview.style.height = `${sb.tile_height}px`;
    preview.style.backgroundImage = `url("${sb.url}")`;
    preview.style.backgroundPosition = `-${tile.x}px -${tile.y}px`;

    // Center preview above the cursor, clamped to bar edges
    const previewX = Math.max(0, Math.min(rect.width - sb.tile_width, clientX - rect.left - sb.tile_width / 2));
    preview.style.left = `${previewX}px`;
  }, []);

  const hideStoryboardPreview = useCallback(() => {
    if (previewRef.current) previewRef.current.style.display = "none";
  }, []);

  const seekToPosition = useCallback(
    (clientX: number) => {
      const v = videoRef.current;
      const bar = progressRef.current;
      const d = durationRef.current;
      if (!v || !bar || !d) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      v.currentTime = ratio * d;
      showStoryboardPreview(clientX);
    },
    [showStoryboardPreview],
  );

  const handleSeekPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isSeekingRef.current = true;
      seekToPosition(e.clientX);
    },
    [seekToPosition],
  );

  const handleSeekPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSeekingRef.current) return;
      e.stopPropagation();
      seekToPosition(e.clientX);
    },
    [seekToPosition],
  );

  const handleSeekPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isSeekingRef.current) return;
      e.stopPropagation();
      isSeekingRef.current = false;
      hideStoryboardPreview();
      scheduleHide();
    },
    [scheduleHide, hideStoryboardPreview],
  );

  const toggleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      v.requestFullscreen().catch(() => {});
    }
  }, []);

  const controlsVisible = controlsBelow || showControls;

  const controls = (
    <div
      className={`flex items-center gap-2 ${controlsBelow ? "py-1.5" : "px-3 pb-3"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-7 shrink-0 items-center transition-colors ${
          controlsBelow
            ? "text-muted-foreground hover:text-foreground"
            : "w-7 justify-center text-white/80 hover:text-white"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? PAUSE_ICON : PLAY_ICON}
      </button>

      <div
        ref={progressRef}
        className="relative flex h-7 flex-1 cursor-pointer items-center"
        onPointerDown={handleSeekPointerDown}
        onPointerMove={handleSeekPointerMove}
        onPointerUp={handleSeekPointerUp}
        onPointerCancel={handleSeekPointerUp}
      >
        <div
          ref={previewRef}
          className="pointer-events-none absolute bottom-8 border border-white/20 bg-black shadow-lg"
          style={{ display: "none" }}
        />
        <div className={`h-[2px] w-full ${controlsBelow ? "bg-foreground/10" : "bg-white/20"}`}>
          <div
            ref={progressBarRef}
            className={`h-full ${controlsBelow ? "bg-foreground/60" : "bg-white/80"}`}
            style={{ width: "0%" }}
          />
        </div>
      </div>

      <span
        ref={timeRef}
        className={`shrink-0 font-pixel text-[9px] tabular-nums ${controlsBelow ? "text-muted-foreground/60" : "text-white/40"}`}
      >
        0:00 / 0:00
      </span>

      <button
        type="button"
        onClick={toggleMute}
        className={`flex h-7 shrink-0 items-center transition-colors ${
          controlsBelow
            ? "justify-end text-muted-foreground hover:text-foreground"
            : "w-7 justify-center text-white/80 hover:text-white"
        }`}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? MUTED_ICON : UNMUTED_ICON}
      </button>

      <button
        type="button"
        onClick={toggleFullscreen}
        className={`flex h-7 shrink-0 items-center transition-colors ${
          controlsBelow
            ? "justify-end text-muted-foreground hover:text-foreground"
            : "w-7 justify-center text-white/80 hover:text-white"
        }`}
        aria-label="Fullscreen"
      >
        {FULLSCREEN_ICON}
      </button>
    </div>
  );

  return (
    <div
      className={`group/player ${controlsBelow ? "inline-flex flex-col" : "relative inline-flex"} ${className}`}
      onMouseMove={controlsBelow ? undefined : revealControls}
      onMouseLeave={controlsBelow ? undefined : handleMouseLeave}
      onTouchStart={controlsBelow ? undefined : revealControls}
      onClick={onClick}
    >
      <div className={controlsBelow ? "min-h-0 flex-1 flex items-center justify-center" : ""}>
        <div className="relative max-w-full">
          {poster && (
            <img
              src={poster}
              alt=""
              loading="eager"
              fetchPriority="high"
              className={`max-w-full object-contain ${controlsBelow ? "min-h-0 max-h-[calc(100dvh-16rem)] md:max-h-[calc(100dvh-10rem)]" : "max-h-full"}`}
              style={{ pointerEvents: "none", ...(bgColor ? { backgroundColor: bgColor } : {}) }}
            />
          )}
          <video
            ref={videoRef}
            muted={muted}
            loop={loop}
            playsInline
            preload="auto"
            poster={poster || undefined}
            onClick={togglePlay}
            className={`absolute inset-0 z-[1] h-full w-full max-w-full object-contain ${controlsBelow ? "min-h-0" : ""}`}
          />
        </div>
      </div>

      {controlsPortalTarget ? (
        createPortal(controls, controlsPortalTarget)
      ) : controlsBelow ? (
        controls
      ) : (
        <div
          className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="relative">{controls}</div>
        </div>
      )}
    </div>
  );
}
