import sharp from "sharp";

/**
 * Extract the dominant color from an image buffer.
 * Resizes to 1x1 pixel and reads the single pixel's RGB value.
 */
export async function extractDominantColor(buffer: Buffer): Promise<string> {
  try {
    const { data } = await sharp(buffer)
      .resize(1, 1, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const r = data[0];
    const g = data[1];
    const b = data[2];
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return "#111111";
  }
}
