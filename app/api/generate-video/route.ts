import { start } from "workflow/api";
import { generateVideoWorkflow } from "@/workflows/generate-video";
import { isValidRatio, MAX_PROMPT_LENGTH } from "@/lib/constants";
import { hasDatabase, sql } from "@/lib/db";
import { detectMimeFromBase64 } from "@/lib/utils";

const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function POST(request: Request) {
  try {
    const { prompt, aspectRatio, id, videoUrl, imageBase64, duration } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "A prompt is required" }, { status: 400 });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return Response.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    }

    const ratio =
      typeof aspectRatio === "string" && isValidRatio(aspectRatio)
        ? aspectRatio
        : "16:9";

    const dur = duration === 10 ? 10 : 5;

    let imageUrl: string | null = null;
    if (hasBlob && typeof imageBase64 === "string" && imageBase64.length > 0) {
      const { put } = await import("@vercel/blob");
      const mime = detectMimeFromBase64(imageBase64);
      const buffer = Buffer.from(imageBase64, "base64");
      const blob = await put(`video-source/${Date.now()}.${mime === "image/jpeg" ? "jpg" : "png"}`, buffer, {
        access: "public",
        contentType: mime,
        cacheControlMaxAge: 31536000,
      });
      imageUrl = blob.url;
    }

    console.log("[v0] Video generation starting", { ratio, dur, hasVideoUrl: !!videoUrl, hasImageUrl: !!imageUrl, promptLength: prompt.trim().length });
    const run = await start(generateVideoWorkflow, [
      prompt.trim(),
      ratio,
      null, // userId — auth removed
      id || null,
      typeof videoUrl === "string" ? videoUrl : null,
      imageUrl,
      dur,
    ]);

    // Insert pending DB record if database is available
    if (hasDatabase && id) {
      try {
        await sql`
          INSERT INTO generations (id, user_id, mode, prompt, aspect_ratio, run_id)
          VALUES (${id}, ${"anonymous"}, 'video', ${prompt.trim()}, ${ratio}, ${run.runId})
        `;
      } catch (dbErr) {
        console.error("[generate-video] Failed to persist pending record:", dbErr);
      }
    }

    return Response.json({ runId: run.runId });
  } catch (error) {
    console.error("[v0] Video generation error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
