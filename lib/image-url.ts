// Matches next.config.mjs deviceSizes + imageSizes
export const IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

// Lazily computed optimal image width for the grid tile size + device DPR.
// Shared across hooks and render so prefetched URLs match what <Image> requests.
let _gridImgWidth = 0;
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => { _gridImgWidth = 0; });
}

export function getGridImageWidth(): number {
  if (_gridImgWidth > 0) return _gridImgWidth;
  if (typeof window === "undefined") return 640;
  const vw = window.innerWidth >= 1024 ? window.innerWidth * 0.2
           : window.innerWidth >= 640 ? window.innerWidth * 0.33
           : window.innerWidth * 0.5;
  const dpr = window.devicePixelRatio || 1;
  const target = Math.ceil(vw * dpr);
  _gridImgWidth = IMAGE_WIDTHS.find((s) => s >= target) || 640;
  return _gridImgWidth;
}

/** Pre-compute the /_next/image optimized URL that the browser will actually request.
 *  Matches what next/image generates so browser cache is shared. */
export function nextImageUrl(src: string, w: number, q: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}
