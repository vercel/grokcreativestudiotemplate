import { cache } from "react";
import { hasDatabase, sql } from "@/lib/db";

export interface HistoryRow {
  id: string;
  mode: string;
  prompt: string;
  aspect_ratio: string;
  image_url: string | null;
  video_url: string | null;
  mux_playback_id: string | null;
  run_id: string | null;
  created_at: string;
}

export const fetchUserHistory = cache(async (userId: string): Promise<HistoryRow[]> => {
  if (!hasDatabase) return [];

  const rows = await sql`
    SELECT id, mode, prompt, aspect_ratio, image_url, video_url, mux_playback_id, run_id, created_at
    FROM generations
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return rows as HistoryRow[];
});

// ── Cursor-based pagination ──────────────────────────────────────────

const HISTORY_PAGE_SIZE = 100;

function decodeCursor(raw: string): { created_at: string; id: string } | null {
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

function encodeCursor(row: HistoryRow): string {
  return Buffer.from(
    JSON.stringify({ created_at: row.created_at, id: row.id }),
  ).toString("base64url");
}

export interface HistoryPage {
  rows: HistoryRow[];
  nextCursor: string | null;
}

export async function fetchUserHistoryPage(
  userId: string,
  cursorParam?: string,
  limit: number = HISTORY_PAGE_SIZE,
): Promise<HistoryPage> {
  if (!hasDatabase) return { rows: [], nextCursor: null };

  const cursor = cursorParam ? decodeCursor(cursorParam) : null;

  const rows = cursor
    ? ((await sql`
        SELECT id, mode, prompt, aspect_ratio, image_url, video_url, mux_playback_id, run_id, created_at
        FROM generations
        WHERE user_id = ${userId}
          AND (created_at < ${cursor.created_at}::timestamptz
               OR (created_at = ${cursor.created_at}::timestamptz AND id::text < ${cursor.id}))
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `) as HistoryRow[])
    : ((await sql`
        SELECT id, mode, prompt, aspect_ratio, image_url, video_url, mux_playback_id, run_id, created_at
        FROM generations
        WHERE user_id = ${userId}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `) as HistoryRow[]);

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1]) : null;

  return { rows, nextCursor };
}

export async function fetchUserHistoryCount(userId: string): Promise<number> {
  if (!hasDatabase) return 0;

  const result = await sql`
    SELECT COUNT(*) AS count
    FROM generations
    WHERE user_id = ${userId}
  `;
  return Number(result[0].count);
}
