import { cache } from "react";
import { hasDatabase, sql } from "@/lib/db";
import { searchStore } from "@/lib/mixedbread-store";
import { cacheLife, cacheTag } from "next/cache";
import { toCompact, type CompactManifest } from "@/lib/compact-manifest";
import { SEED_GENERATIONS } from "@/lib/seed-data";

export const EXPLORE_PAGE_SIZE = 20;

export interface ExploreRow {
  id: string;
  user_id: string;
  prompt: string;
  aspect_ratio: string;
  image_url: string;
  video_url: string | null;
  mux_playback_id: string | null;
  mode: string;
  created_at: string;
  user_name: string | null;
  user_avatar: string | null;
  color: string | null;
  blur_data: string | null;
  blurDataURL?: string;
  similarity?: number;
}

export interface ExplorePage {
  items: ExploreRow[];
  nextCursor: string | null;
}

export function decodeCursor(
  raw: string | null,
): { created_at: string; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    );
    if (typeof decoded.created_at !== "string" || typeof decoded.id !== "string") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function encodeCursor(row: ExploreRow): string {
  return Buffer.from(
    JSON.stringify({ created_at: row.created_at, id: row.id }),
  ).toString("base64url");
}

// ── In-memory fallbacks for seed data ──────────────────────────────

function seedExplorePage(
  cursor: { created_at: string; id: string } | null = null,
  limit: number = EXPLORE_PAGE_SIZE,
): ExplorePage {
  let items = SEED_GENERATIONS;
  if (cursor) {
    const idx = items.findIndex((i) => i.id === cursor.id);
    items = idx >= 0 ? items.slice(idx + 1) : items;
  }
  const page = items.slice(0, limit);
  const nextCursor = page.length === limit && page.length < items.length
    ? encodeCursor(page[page.length - 1])
    : null;
  return { items: page, nextCursor };
}

function seedExploreById(id: string): ExploreRow | null {
  return SEED_GENERATIONS.find((i) => i.id === id) ?? null;
}

function localTextSearch(query: string): ExploreRow[] {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  return SEED_GENERATIONS.filter((item) => {
    const prompt = item.prompt.toLowerCase();
    return words.every((w) => prompt.includes(w));
  });
}

// ── DB-backed implementations ──────────────────────────────────────

export async function fetchExplorePage(
  cursor: { created_at: string; id: string } | null = null,
  limit: number = EXPLORE_PAGE_SIZE,
): Promise<ExplorePage> {
  if (!hasDatabase) return seedExplorePage(cursor, limit);

  const rows = cursor
    ? ((await sql`
        SELECT
          g.id,
          g.user_id,
          g.prompt,
          g.aspect_ratio,
          g.image_url,
          g.video_url,
          g.mux_playback_id,
          g.mode,
          g.created_at,
          g.color,
          g.blur_data,
          u.name  AS user_name,
          u.avatar_url AS user_avatar
        FROM generations g
        LEFT JOIN users u ON g.user_id = u.id
        WHERE (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
          AND (g.created_at < ${cursor.created_at}::timestamptz
               OR (g.created_at = ${cursor.created_at}::timestamptz AND g.id::text < ${cursor.id}))
        ORDER BY g.created_at DESC, g.id DESC
        LIMIT ${limit}
      `) as ExploreRow[])
    : ((await sql`
        SELECT
          g.id,
          g.user_id,
          g.prompt,
          g.aspect_ratio,
          g.image_url,
          g.video_url,
          g.mux_playback_id,
          g.mode,
          g.created_at,
          g.color,
          g.blur_data,
          u.name  AS user_name,
          u.avatar_url AS user_avatar
        FROM generations g
        LEFT JOIN users u ON g.user_id = u.id
        WHERE (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
        ORDER BY g.created_at DESC, g.id DESC
        LIMIT ${limit}
      `) as ExploreRow[]);

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1]) : null;

  return { items: rows, nextCursor };
}

export async function fetchExploreById(id: string): Promise<ExploreRow | null> {
  if (!hasDatabase) return seedExploreById(id);

  const rows = await sql`
    SELECT
      g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url, g.mux_playback_id,
      g.mode, g.created_at, g.color, g.blur_data,
      u.name AS user_name, u.avatar_url AS user_avatar
    FROM generations g
    LEFT JOIN users u ON g.user_id = u.id
    WHERE g.id = ${id}
      AND (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
  `;
  return (rows[0] as ExploreRow) ?? null;
}

/* ---- Server-side search (mirrors /api/explore/search logic) ---- */

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, "\\$&");
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textSearch(query: string) {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const wordPattern = `\\y${escapeRegex(query)}\\y`;
    return sql`
      SELECT
        g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url, g.mux_playback_id,
        g.mode, g.created_at, g.color, g.blur_data,
        u.name AS user_name, u.avatar_url AS user_avatar
      FROM generations g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
        AND g.prompt ~* ${wordPattern}
      ORDER BY g.created_at DESC
      LIMIT 40
    `;
  }
  const likePattern = `%${escapeLike(query)}%`;
  return sql`
    SELECT
      g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url, g.mux_playback_id,
      g.mode, g.created_at, g.color, g.blur_data,
      u.name AS user_name, u.avatar_url AS user_avatar
    FROM generations g
    LEFT JOIN users u ON g.user_id = u.id
    WHERE (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
      AND g.prompt ILIKE ${likePattern}
    ORDER BY g.created_at DESC
    LIMIT 40
  `;
}

export interface SearchResult {
  items: ExploreRow[];
}

export const fetchSearchResults = cache(async function fetchSearchResults(query: string): Promise<SearchResult> {
  if (!query || query.length === 0) {
    return { items: [] };
  }

  // No database: use local text search on seed data
  if (!hasDatabase) {
    return { items: localTextSearch(query) };
  }

  const [textRows, storeResults] = await Promise.all([
    textSearch(query),
    searchStore(query).catch((err) => {
      console.error("[search] Store search failed:", err);
      return [] as { generationId: string; score: number }[];
    }),
  ]);

  if (storeResults.length > 0) {
    const ids = storeResults.map((r) => r.generationId);
    const rows = await sql`
      SELECT
        g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url, g.mux_playback_id,
        g.mode, g.created_at, g.color, g.blur_data,
        u.name AS user_name, u.avatar_url AS user_avatar
      FROM generations g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.id = ANY(${ids})
        AND (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
    `;

    const rowMap = new Map(rows.map((r) => [r.id as string, r]));
    const storeItems = storeResults
      .map((r) => rowMap.get(r.generationId))
      .filter(Boolean);

    const seen = new Set(textRows.map((r) => r.id as string));
    const extra = storeItems.filter((r) => !seen.has(r!.id as string));

    return { items: [...textRows, ...extra] as ExploreRow[] };
  }

  return { items: textRows as ExploreRow[] };
});

// ---- Shared blur helper ----

/** Strip DB-only fields (blur_data, created_at) from an ExploreRow for client output. */
function stripDbFields(item: ExploreRow): Omit<ExploreRow, "blur_data" | "created_at"> {
  const { blur_data: _, created_at: __, ...rest } = item;
  return rest;
}

function applyBlurData(items: ExploreRow[], blurLimit?: number): ExploreRow[] {
  const limit = blurLimit ?? items.length; // default: all items get blur
  return items.map((item, i) => {
    const rest = stripDbFields(item);
    if (!item.blur_data) return rest as ExploreRow;
    if (i < limit) return { ...rest, blurDataURL: item.blur_data } as ExploreRow;
    return rest as ExploreRow;
  });
}

// ---- Seeded shuffle helper ----
// Uses a time-based seed so the order stays stable within each hour.
// This keeps the same images in the viewport across cache busts,
// ensuring the CDN image cache (/_next/image) stays warm.

function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  // Seed changes once per hour — same order within the hour
  const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  const rand = seededRandom(hourSeed);
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ---- Cached wrappers for PPR (cacheComponents) ----

export async function getExplorePage() {
  "use cache";
  cacheLife("minutes");
  cacheTag("explore");
  const page = await fetchExplorePage();
  const blurred = applyBlurData(page.items);
  return { ...page, items: shuffleArray(blurred) };
}

export async function getExploreManifest(): Promise<CompactManifest> {
  "use cache";
  cacheLife("hours");
  cacheTag("explore");
  const page = await fetchExplorePage(null, 1000);
  const shuffled = shuffleArray(page.items);
  const withBlurFields = applyBlurData(shuffled);
  return { items: toCompact(withBlurFields), nextCursor: page.nextCursor };
}

export async function fetchExploreByOffset(
  offset: number,
  limit: number = EXPLORE_PAGE_SIZE,
): Promise<ExplorePage> {
  if (!hasDatabase) {
    const items = SEED_GENERATIONS.slice(offset, offset + limit);
    return { items, nextCursor: null };
  }

  const rows = (await sql`
    SELECT
      g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url, g.mux_playback_id,
      g.mode, g.created_at, g.color, g.blur_data,
      u.name AS user_name, u.avatar_url AS user_avatar
    FROM generations g
    LEFT JOIN users u ON g.user_id = u.id
    WHERE (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
    ORDER BY g.created_at DESC, g.id DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `) as ExploreRow[];

  return { items: rows, nextCursor: null };
}

export async function getExplorePageByOffset(offset: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("explore");
  const page = await fetchExploreByOffset(offset);
  return { ...page, items: applyBlurData(page.items) };
}

export async function getExplorePageAt(cursorParam: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("explore");
  const cursor = decodeCursor(cursorParam);
  if (!cursor) return null;
  const page = await fetchExplorePage(cursor);
  return { ...page, items: applyBlurData(page.items) };
}

export async function getExploreItem(id: string) {
  "use cache";
  cacheLife("days");
  cacheTag("explore", `explore-item-${id}`);
  const item = await fetchExploreById(id);
  if (!item) return null;
  const [processed] = applyBlurData([item]);
  return processed;
}

export async function getSearchResults(query: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("search");
  const result = await fetchSearchResults(query);
  const blurred = applyBlurData(result.items);
  return { items: blurred };
}
