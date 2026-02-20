import { getSearchResults } from "@/lib/explore-queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length === 0 || query.length > 200) {
    return Response.json({ items: [] });
  }

  try {
    const result = await getSearchResults(query);
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
