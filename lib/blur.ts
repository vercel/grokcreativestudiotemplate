import sharp from "sharp";

export interface BlurResult {
  blurDataURL?: string;
  width?: number;
  height?: number;
}

export async function generateBlurDataURL(
  imageUrl: string,
): Promise<BlurResult> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return {};
    const buffer = Buffer.from(await res.arrayBuffer());
    return generateBlurFromBuffer(buffer);
  } catch {
    return {};
  }
}

export async function generateBlurFromBuffer(
  buffer: Buffer,
): Promise<BlurResult> {
  try {
    const image = sharp(buffer);
    const meta = await image.metadata();
    const blurred = await image
      .resize(8, undefined, { fit: "inside" })
      .toFormat("webp", { quality: 10 })
      .toBuffer();
    return {
      blurDataURL: `data:image/webp;base64,${blurred.toString("base64")}`,
      width: meta.width,
      height: meta.height,
    };
  } catch {
    return {};
  }
}

