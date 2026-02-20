"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import type { HistoryRow } from "@/lib/queries/user-history";
import type { SearchResult } from "@/lib/explore-queries";

/**
 * Invisible client component that injects server-streamed data into the SWR cache.
 *
 * Rendered inside a Suspense boundary (returns null → no DOM).
 * After hydration, injects history and search results into the
 * global SWR cache so hooks pick them up without a network round-trip.
 */
export function DataInjector({
  history,
  historyCount,
  searchQuery,
  searchResults,
}: {
  history: HistoryRow[];
  historyCount?: number;
  searchQuery?: string;
  searchResults?: SearchResult | null;
}) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    // Inject history as first page of useSWRInfinite
    if (history.length > 0) {
      mutate(
        "/api/generations",
        { generations: history, nextCursor: null, totalCount: historyCount ?? history.length },
        { revalidate: false },
      );
    }

    // Inject search results
    if (searchQuery && searchResults) {
      mutate(
        `/api/explore/search?q=${encodeURIComponent(searchQuery)}`,
        searchResults,
        { revalidate: false },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
