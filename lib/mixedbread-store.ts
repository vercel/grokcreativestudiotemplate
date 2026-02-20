import type Mixedbread from "@mixedbread/sdk";

export const hasMixedbread = !!process.env.MIXEDBREAD_API_KEY;

const STORE_NAME = "grokcc-visual";

export interface StoreMetadata {
  generation_id: string;
  prompt: string;
  mode: string;
  aspect_ratio: string;
  created_at: string;
}

// Lazy-init: only create the client when actually needed
let _client: Mixedbread | null = null;
async function getClient(): Promise<Mixedbread> {
  if (_client) return _client;
  const { default: MixedbreadSDK } = await import("@mixedbread/sdk");
  _client = new MixedbreadSDK({ apiKey: process.env.MIXEDBREAD_API_KEY! });
  return _client;
}

export async function uploadImageToStore(
  buffer: Buffer,
  filename: string,
  metadata: StoreMetadata,
): Promise<void> {
  if (!hasMixedbread) return;

  const client = await getClient();
  const { toFile } = await import("@mixedbread/sdk");
  const file = await toFile(buffer, filename);
  await client.stores.files.upload(STORE_NAME, file, {
    metadata,
    external_id: metadata.generation_id,
    overwrite: true,
    config: { parsing_strategy: "high_quality" },
  });
}

export async function deleteFileFromStore(generationId: string): Promise<void> {
  if (!hasMixedbread) return;

  const client = await getClient();
  await client.stores.files.delete(generationId, {
    store_identifier: STORE_NAME,
  });
}

let rateLimitedUntil = 0;

export function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function markRateLimited(): void {
  rateLimitedUntil = Date.now() + 60_000;
}

export async function searchStore(
  query: string,
  topK: number = 15,
  modeFilter?: string,
): Promise<{ generationId: string; score: number }[]> {
  if (!hasMixedbread) return [];
  if (isRateLimited()) return [];

  const client = await getClient();

  const filters = modeFilter
    ? { key: "mode", operator: "eq" as const, value: modeFilter }
    : undefined;

  try {
    const results = await client.stores.search({
      query,
      store_identifiers: [STORE_NAME],
      top_k: topK,
      filters,
      search_options: {
        return_metadata: true,
        score_threshold: 0.71,
      },
    });

    const items: { generationId: string; score: number }[] = [];

    for (const file of results.data) {
      const meta = file.metadata as
        | { generation_id?: string; prompt?: string }
        | undefined;
      const generationId = meta?.generation_id;
      if (!generationId) continue;
      items.push({ generationId, score: file.score });
    }

    return items;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429) markRateLimited();
    throw err;
  }
}
