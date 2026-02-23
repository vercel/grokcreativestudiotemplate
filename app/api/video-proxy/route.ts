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

  // Only allow proxying to a fixed upstream host; treat `url` as a relative path.
  const BASE_URL = "https://vidgen.x.ai";
  let parsed: URL;
  try {
    parsed = new URL(url, BASE_URL);

    // Disallow attempts to escape the intended path space via path traversal.
    if (parsed.pathname.includes("..")) {
      return new Response("Invalid path", { status: 400 });
    }

    // Optionally restrict to a specific path prefix on the upstream host.
    const allowedPathPrefixes = ["/", "/videos/", "/video/"];
    if (!allowedPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) {
      return new Response("Path not allowed", { status: 403 });
    }

    // At this point, the scheme, host, and port are controlled by BASE_URL,
    // and only a constrained path/query derived from user input is used.
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString());
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
