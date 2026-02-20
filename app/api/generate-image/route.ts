import { experimental_generateImage, gateway } from "ai";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { isValidRatio, MAX_PROMPT_LENGTH } from "@/lib/constants";
import { detectMimeFromBase64 } from "@/lib/utils";
import { hasDatabase, sql } from "@/lib/db";
import { hasMixedbread, uploadImageToStore } from "@/lib/mixedbread-store";
import { warmViewportImages } from "@/lib/warm-image-cache";

const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

async function persistImage(
  id: string,
  userId: string,
  base64: string,
  prompt: string,
  ratio: string,
) {
  const { put } = await import("@vercel/blob");
  const { extractDominantColor } = await import("@/lib/color");
  const { generateBlurFromBuffer } = await import("@/lib/blur");

  const imgBuffer = Buffer.from(base64, "base64");
  const [saved, color, { blurDataURL }] = await Promise.all([
    put(`generations/${id}.png`, imgBuffer, { access: "public", contentType: "image/png", cacheControlMaxAge: 31536000 }),
    extractDominantColor(imgBuffer),
    generateBlurFromBuffer(imgBuffer),
  ]);
  const imageUrl = saved.url;
  await sql`INSERT INTO generations (id, user_id, mode, prompt, aspect_ratio, image_url, color, blur_data) VALUES (${id}, ${userId}, 'image', ${prompt}, ${ratio}, ${imageUrl}, ${color}, ${blurDataURL || null})`;
  after(async () => {
    if (hasMixedbread) {
      try {
        await uploadImageToStore(imgBuffer, `${id}.png`, {
          generation_id: id, prompt, mode: "image",
          aspect_ratio: ratio, created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[store] Upload error:", e);
      }
    }
    try {
      await warmViewportImages([{ image_url: imageUrl }]);
    } catch (e) {
      console.error("[warm] CDN warm error:", e);
    }
  });
  return imageUrl;
}

export async function POST(request: Request) {
  try {
    const { prompt, aspectRatio, imageBase64, id } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json(
        { error: "A prompt is required" },
        { status: 400 },
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return Response.json(
        { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` },
        { status: 400 },
      );
    }

    const ratio =
      typeof aspectRatio === "string" && isValidRatio(aspectRatio)
        ? aspectRatio
        : "16:9";

    const isEdit = typeof imageBase64 === "string" && imageBase64.length > 0;

    console.log("[v0] Image generation starting", { isEdit, ratio, promptLength: prompt.trim().length });
    const { image } = await experimental_generateImage({
      model: gateway.imageModel("xai/grok-imagine-image"),
      prompt: isEdit
        ? { images: [`data:${detectMimeFromBase64(imageBase64)};base64,${imageBase64}`], text: prompt.trim() }
        : prompt.trim(),
      providerOptions: { xai: { aspect_ratio: ratio } },
    });
    console.log("[v0] Image generation completed successfully, base64 length:", image.base64.length);

    let imageUrl: string | undefined;

    if (hasDatabase && id) {
      // Full persistence: Blob + DB + color + blur + embedding
      imageUrl = await persistImage(id, "anonymous", image.base64, prompt.trim(), ratio);
      after(() => {
        revalidateTag("explore", "max");
        revalidateTag("search", "max");
      });
    } else if (hasBlob && id) {
      // Blob only (permanent URL, no DB record)
      const { put } = await import("@vercel/blob");
      const imgBuffer = Buffer.from(image.base64, "base64");
      const saved = await put(`generations/${id}.png`, imgBuffer, {
        access: "public",
        contentType: "image/png",
        cacheControlMaxAge: 31536000,
      });
      imageUrl = saved.url;
    }

    return Response.json({ image: image.base64, aspectRatio: ratio, imageUrl });
  } catch (error) {
    console.error("[v0] Image generation error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
