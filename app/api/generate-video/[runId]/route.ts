import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const run = getRun(runId);

    return new Response(run.readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Video status error:", error);
    return Response.json({ error: "Failed to check video status" }, { status: 500 });
  }
}
