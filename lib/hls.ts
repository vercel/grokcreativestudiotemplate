// hls.js is loaded lazily — only when first video needs it (~60KB off critical path)
let HlsModule: typeof import("hls.js").default | null = null;
let hlsLoadPromise: Promise<void> | null = null;

function loadHls(): Promise<void> {
  if (HlsModule) return Promise.resolve();
  if (!hlsLoadPromise) {
    hlsLoadPromise = import("hls.js").then((m) => { HlsModule = m.default; });
  }
  return hlsLoadPromise;
}

/** Eagerly start loading hls.js chunk (call on click before detail opens). */
export function preloadHls(): void {
  loadHls().catch(() => {});
}

export function muxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/** Grid stream URL: cap at 360p server-side so the manifest only contains
 *  low-res renditions. Less parsing, less bandwidth, lower decode cost. */
export function muxGridStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8?max_resolution=360p`;
}

export function muxStoryboardUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/storyboard.json?format=webp`;
}

export function muxThumbnailUrl(playbackId: string, width = 1920): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?time=0.1&width=${width}`;
}

// Safari's MediaSource compositing briefly renders video at native resolution
// before CSS object-contain applies — causes a flash artifact. Native HLS
// doesn't have this issue because Safari's own pipeline handles layout correctly.
const isSafari = typeof navigator !== "undefined" &&
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|CriOS|Chromium/i.test(navigator.userAgent);

/** Retry native HLS in Safari when Mux returns 412 (asset still processing). */
function attachWithRetry(video: HTMLVideoElement, src: string, maxRetries = 5, delay = 3000) {
  let attempt = 0;
  const tryLoad = () => {
    video.src = src;
    video.load();
  };
  const onError = () => {
    if (attempt < maxRetries) {
      attempt++;
      setTimeout(tryLoad, delay);
    }
  };
  video.addEventListener("error", onError);
  tryLoad();
  // Return cleanup function
  return () => video.removeEventListener("error", onError);
}

/** Attach HLS.js for the detail player. Locked to 720p on all browsers.
 *  Safari compositing artifacts prevented by requestVideoFrameCallback
 *  in the player component. Non-HLS URLs (MP4) bypass HLS entirely. */
export async function attachHls(video: HTMLVideoElement, src: string): Promise<import("hls.js").default | null> {
  if (!src.endsWith(".m3u8")) {
    video.src = src;
    return null;
  }
  if (isSafari) {
    video.preload = "auto";
    attachWithRetry(video, src);
    return null;
  }
  await loadHls();
  const Hls = HlsModule!;
  if (Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 30,
      abrEwmaDefaultEstimate: 5_000_000,
    });
    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      hls.currentLevel = data.levels.length - 1;
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        hls.destroy();
        video.src = src;
      }
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return hls;
  }
  video.src = src;
  return null;
}

/** Grid-optimized HLS. Safari uses native HLS (its MediaSource is slow
 *  with many concurrent instances). Chrome/Firefox use HLS.js. */
export async function attachGridHls(video: HTMLVideoElement, src: string): Promise<import("hls.js").default | null> {
  if (isSafari) {
    video.preload = "auto";
    attachWithRetry(video, src);
    return null;
  }
  await loadHls();
  const Hls = HlsModule!;
  if (Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 6,
      capLevelToPlayerSize: true,
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        hls.destroy();
        video.src = src;
      }
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return hls;
  }
  video.src = src;
  return null;
}

export function detachHls(hls: import("hls.js").default | null) {
  hls?.destroy();
}
