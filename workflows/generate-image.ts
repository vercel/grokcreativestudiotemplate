import { getWritable } from "workflow";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { experimental_generateImage, gateway } from "ai";
import sharp from "sharp";
import type { ImageProgress } from "@/lib/types";

const hasDatabase = !!process.env.DATABASE_URL;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

async function callGenerateImage(
  prompt: string,
  aspectRatio: string,
  imageBase64: string | null,
): Promise<{ base64: string; blobUrl: string | null }> {
  "use step";

  const isEdit = !!imageBase64;

  let editPrompt: string | { images: string[]; text: string } = prompt;
  if (isEdit && imageBase64) {
    // Detect MIME from first bytes of base64
    const header = imageBase64.slice(0, 4);
    let mime = "image/png";
    if (header.startsWith("/9j/") || header.startsWith("/9j+")) mime = "image/jpeg";
    else if (header.startsWith("R0lG")) mime = "image/gif";
    else if (header.startsWith("UklG")) mime = "image/webp";
    editPrompt = { images: [`data:${mime};base64,${imageBase64}`], text: prompt };
  }

  const { image } = await experimental_generateImage({
    model: gateway.imageModel("xai/grok-imagine-image"),
    prompt: editPrompt,
    providerOptions: { xai: { aspect_ratio: aspectRatio } },
  });

  let blobUrl: string | null = null;
  if (hasBlob) {
    const filename = crypto.randomUUID();
    const imgBuffer = Buffer.from(image.base64, "base64");
    const saved = await put(`generations/${filename}.png`, imgBuffer, {
      access: "public",
      contentType: "image/png",
      cacheControlMaxAge: 31536000,
    });
    blobUrl = saved.url;
  }

  return { base64: image.base64, blobUrl };
}

async function saveGeneration(
  generationId: string,
  userId: string,
  prompt: string,
  aspectRatio: string,
  base64: string,
  blobUrl: string,
) {
  "use step";

  const imgBuffer = Buffer.from(base64, "base64");

  // Extract color + blur placeholder in parallel
  const [colorData, blurBuf] = await Promise.all([
    sharp(imgBuffer).resize(1, 1, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(imgBuffer).resize(8, undefined, { fit: "inside" }).toFormat("webp", { quality: 10 }).toBuffer(),
  ]);

  const r = colorData.data[0], g = colorData.data[1], b = colorData.data[2];
  const color = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  const blurDataURL = `data:image/webp;base64,${blurBuf.toString("base64")}`;

  const dbSql = neon(process.env.DATABASE_URL!);
  await dbSql`
    INSERT INTO generations (id, user_id, mode, prompt, aspect_ratio, image_url, color, blur_data)
    VALUES (${generationId}, ${userId}, 'image', ${prompt}, ${aspectRatio}, ${blobUrl}, ${color}, ${blurDataURL})
  `;
}

async function writeProgress(progress: ImageProgress) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();
  await writer.write(JSON.stringify(progress) + "\n");
  writer.releaseLock();
}

async function closeStream() {
  "use step";
  await getWritable().close();
}

export async function generateImageWorkflow(
  prompt: string,
  aspectRatio: string,
  userId: string | null,
  generationId: string | null,
  imageBase64: string | null,
) {
  "use workflow";

  await writeProgress({ status: "pending" });

  let result: { base64: string; blobUrl: string | null };
  try {
    result = await callGenerateImage(prompt, aspectRatio, imageBase64);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    await writeProgress({ status: "failed", error: message });
    await closeStream();
    return { status: "failed", error: message };
  }

  // Save to database (optional)
  if (hasDatabase && userId && generationId && result.blobUrl) {
    try {
      await saveGeneration(generationId, userId, prompt, aspectRatio, result.base64, result.blobUrl);
    } catch (e) {
      console.error("[generate-image] DB save failed:", e);
    }
  }

  await writeProgress({
    status: "completed",
    base64: result.base64,
    imageUrl: result.blobUrl ?? undefined,
  });
  await closeStream();
  return { status: "completed", imageUrl: result.blobUrl };
}
