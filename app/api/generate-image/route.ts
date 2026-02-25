import { start } from "workflow/api";
import { generateImageWorkflow } from "@/workflows/generate-image";
import { isValidRatio, MAX_PROMPT_LENGTH } from "@/lib/constants";

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

    const run = await start(generateImageWorkflow, [
      prompt.trim(),
      ratio,
      null, // userId — auth removed
      id || null,
      typeof imageBase64 === "string" && imageBase64.length > 0 ? imageBase64 : null,
    ]);

    return Response.json({ runId: run.runId });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
