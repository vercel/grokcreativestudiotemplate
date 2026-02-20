/**
 * Server-side proxy for video URLs that have CORS restrictions (e.g. vidgen.x.ai).
 * Fetches the video server-side and streams it back to the browser with proper headers.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Only allow proxying from known video hosts
  try {
    const parsed = new URL(url);
    const allowedHosts = ["vidgen.x.ai"];
    if (!allowedHosts.some((h) => parsed.hostname.endsWith(h))) {
      return new Response("URL host not allowed", { status: 403 });
    }
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return new Response("Upstream fetch failed", { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "video/mp4",
        "Content-Length": upstream.headers.get("Content-Length") || "",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Video proxy error:", error);
    return new Response("Proxy failed", { status: 500 });
  }
}
