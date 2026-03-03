import { getWritable } from "workflow";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { experimental_generateVideo, gateway } from "ai";
import type { XaiVideoModelOptions } from "@ai-sdk/xai";
import sharp from "sharp";
import type { VideoProgress } from "@/lib/types";

const hasDatabase = !!process.env.DATABASE_URL;
const hasMux = !!process.env.MUX_TOKEN_ID && !!process.env.MUX_TOKEN_SECRET;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

async function callGenerateVideo(
  prompt: string,
  aspectRatio: string,
  videoUrl: string | null,
  imageUrl: string | null,
  duration: number,
  generationId: string | null,
): Promise<{ permanentUrl: string | null; xaiUrl: string }> {
  "use step";

  const isEdit = !!videoUrl;
  const isImageToVideo = !!imageUrl;

  const result = await experimental_generateVideo({
    model: gateway.videoModel("xai/grok-imagine-video"),
    prompt: isImageToVideo ? { image: imageUrl!, text: prompt } : prompt,
    ...(!isEdit && !isImageToVideo ? { aspectRatio: aspectRatio as `${number}:${number}` } : {}),
    ...(!isEdit ? { duration } : {}),
    providerOptions: {
      xai: {
        ...(isEdit ? { videoUrl } : {}),
        ...(!isEdit ? { resolution: "720p" as const } : {}),
        pollTimeoutMs: 600000,
      } satisfies XaiVideoModelOptions,
    },
  });

  const xaiUrl = result.providerMetadata?.xai?.videoUrl as string;

  if (hasBlob) {
    const filename = generationId || crypto.randomUUID();
    const saved = await put(`generations/${filename}.mp4`, Buffer.from(result.video.uint8Array), {
      access: "public",
      contentType: "video/mp4",
      cacheControlMaxAge: 31536000,
    });
    return { permanentUrl: saved.url, xaiUrl };
  }

  return { permanentUrl: null, xaiUrl };
}

async function uploadToMux(blobUrl: string): Promise<{ assetId: string; playbackId: string | null }> {
  "use step";
  const { default: Mux } = await import("@mux/mux-node");
  const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
  });
  const asset = await mux.video.assets.create({
    inputs: [{ url: blobUrl }],
    playback_policies: ["public"],
    max_resolution_tier: "1080p",
  });
  const playbackId = asset.playback_ids?.[0]?.id ?? null;
  return { assetId: asset.id, playbackId };
}

async function writeProgress(progress: VideoProgress) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();
  await writer.write(JSON.stringify(progress) + "\n");
  writer.releaseLock();
}

async function saveGeneration(
  generationId: string,
  userId: string,
  prompt: string,
  aspectRatio: string,
  videoUrl: string,
  muxAssetId: string | null,
  muxPlaybackId: string | null,
) {
  "use step";
  const dbSql = neon(process.env.DATABASE_URL!);
  const thumbnailUrl = muxPlaybackId
    ? `https://image.mux.com/${muxPlaybackId}/thumbnail.webp?time=0.1&width=1920`
    : null;

  // Extract color + blur from Mux thumbnail for instant grid placeholders
  let color: string | null = null;
  let blurDataURL: string | null = null;
  if (thumbnailUrl) {
    try {
      const res = await fetch(thumbnailUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const [colorData, blurBuf] = await Promise.all([
          sharp(buf).resize(1, 1, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
          sharp(buf).resize(8, undefined, { fit: "inside" }).toFormat("webp", { quality: 10 }).toBuffer(),
        ]);
        const r = colorData.data[0], g = colorData.data[1], b = colorData.data[2];
        color = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        blurDataURL = `data:image/webp;base64,${blurBuf.toString("base64")}`;
      }
    } catch { /* non-critical — grid falls back to muted bg */ }
  }

  const updated = await dbSql`UPDATE generations SET video_url = ${videoUrl}, mux_asset_id = ${muxAssetId}, mux_playback_id = ${muxPlaybackId}, image_url = COALESCE(${thumbnailUrl}, image_url), color = COALESCE(${color}, color), blur_data = COALESCE(${blurDataURL}, blur_data) WHERE id = ${generationId} AND user_id = ${userId} RETURNING id`;
  if (updated.length === 0) {
    await dbSql`INSERT INTO generations (id, user_id, mode, prompt, aspect_ratio, video_url, mux_asset_id, mux_playback_id, image_url, color, blur_data) VALUES (${generationId}, ${userId}, 'video', ${prompt}, ${aspectRatio}, ${videoUrl}, ${muxAssetId}, ${muxPlaybackId}, ${thumbnailUrl}, ${color}, ${blurDataURL})`;
  }
}

async function closeStream() {
  // use step
  await getWritable().close();
}

export async function generateVideoWorkflow(
  prompt: string,
  aspectRatio: string,
  userId: string | null,
  generationId: string | null,
  videoUrl: string | null,
  imageUrl: string | null,
  duration: number,
) {
  "use workflow";

  await writeProgress({ status: "pending" });

  let result: { permanentUrl: string | null; xaiUrl: string };
  try {
    result = await callGenerateVideo(
      prompt, aspectRatio, videoUrl, imageUrl, duration, generationId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video generation failed";

    if (error instanceof Error && "statusCode" in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        await writeProgress({ status: "failed", error: message });
        await closeStream();
        return { status: "failed", error: message };
      }
    }

    await writeProgress({ status: "failed", error: message });
    await closeStream();
    return { status: "failed", error: message };
  }

  // Always prefer the blob URL. If blob upload was skipped, proxy the xAI URL
  // through our server to avoid CORS issues (vidgen.x.ai blocks cross-origin).
  const finalUrl = result.permanentUrl || `/api/video-proxy?url=${encodeURIComponent(result.xaiUrl)}`;

  // Upload to Mux for HLS streaming + auto-thumbnails (optional)
  let muxAssetId: string | null = null;
  let muxPlaybackId: string | null = null;
  if (hasMux && result.permanentUrl) {
    try {
      const muxResult = await uploadToMux(result.permanentUrl);
      muxAssetId = muxResult.assetId;
      muxPlaybackId = muxResult.playbackId;
    } catch (e) {
      console.error("[mux] Upload failed, falling back to direct MP4:", e);
    }
  }

  // Save to database (optional)
  if (hasDatabase && userId && generationId && result.permanentUrl) {
    await saveGeneration(generationId, userId, prompt, aspectRatio, result.permanentUrl, muxAssetId, muxPlaybackId);
  }

  await writeProgress({ status: "completed", url: finalUrl, muxPlaybackId: muxPlaybackId ?? undefined });
  await closeStream();
  return { status: "completed", url: finalUrl, muxPlaybackId };
}
