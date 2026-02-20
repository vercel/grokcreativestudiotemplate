import { getExplorePage, getExplorePageAt, getExplorePageByOffset } from "@/lib/explore-queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const offsetParam = searchParams.get("offset");

  try {
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
    };

    // Offset-based pagination (parallel-friendly)
    if (offsetParam != null) {
      const offset = parseInt(offsetParam, 10);
      if (isNaN(offset) || offset < 0) {
        return Response.json({ error: "Invalid offset" }, { status: 400 });
      }
      const page = await getExplorePageByOffset(offset);
      return Response.json(page, { headers: cacheHeaders });
    }

    // Legacy cursor-based pagination
    if (cursorParam) {
      const page = await getExplorePageAt(cursorParam);
      if (!page) {
        return Response.json({ error: "Invalid cursor" }, { status: 400 });
      }
      return Response.json(page, { headers: cacheHeaders });
    }

    const page = await getExplorePage();
    return Response.json(page, { headers: cacheHeaders });
  } catch (err) {
    console.error("[explore] Failed to fetch:", err);
    return Response.json(
      { error: "Failed to load creations" },
      { status: 500 },
    );
  }
}
