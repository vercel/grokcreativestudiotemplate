import { cache } from "react";
import { hasDatabase, sql } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import type { ExploreRow } from "@/lib/explore-queries";
import { SEED_GENERATIONS } from "@/lib/seed-data";

export const fetchGeneration = cache(async function fetchGeneration(id: string): Promise<ExploreRow | null> {
  // Check seed data first (works with or without DB)
  const seed = SEED_GENERATIONS.find((s) => s.id === id);
  if (seed) return seed;

  if (!hasDatabase) return null;

  const rows = await sql`
    SELECT
      g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url,
      g.mode, g.created_at, g.color, g.blur_data,
      u.name AS user_name, u.avatar_url AS user_avatar
    FROM generations g
    LEFT JOIN users u ON g.user_id = u.id
    WHERE g.id = ${id}
      AND (g.image_url IS NOT NULL OR g.video_url IS NOT NULL)
  `;
  return (rows[0] as ExploreRow) ?? null;
});

/** Like fetchGeneration but includes in-progress items (no media yet). */
export async function fetchGenerationAny(id: string): Promise<ExploreRow | null> {
  const seed = SEED_GENERATIONS.find((s) => s.id === id);
  if (seed) return seed;

  if (!hasDatabase) return null;

  const rows = await sql`
    SELECT
      g.id, g.user_id, g.prompt, g.aspect_ratio, g.image_url, g.video_url,
      g.mode, g.created_at, g.color, g.blur_data, g.run_id,
      u.name AS user_name, u.avatar_url AS user_avatar
    FROM generations g
    LEFT JOIN users u ON g.user_id = u.id
    WHERE g.id = ${id}
  `;
  return (rows[0] as ExploreRow) ?? null;
}

export async function getGeneration(id: string) {
  "use cache";
  cacheLife("days");
  cacheTag("generation", `generation-${id}`);
  return fetchGeneration(id);
}
