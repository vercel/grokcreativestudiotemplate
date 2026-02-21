export function optimizedUrl(src: string, w = 1200, q = 75) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}
