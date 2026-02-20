"use client";

import useSWRInfinite from "swr/infinite";
import { startTransition, useCallback, useMemo, useRef } from "react";
import type { HistoryRow } from "@/lib/queries/user-history";

interface PageData {
  generations: HistoryRow[];
  nextCursor: string | null;
  totalCount?: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useStudioHistory(
  userId: string | null | undefined,
  initialHistory: HistoryRow[],
) {
  // Track totalCount from the first page response across revalidations
  const totalCountRef = useRef<number | undefined>(undefined);

  const getKey = useCallback(
    (pageIndex: number, previousPageData: PageData | null) => {
      if (!userId) return null;
      // Reached the end
      if (previousPageData && !previousPageData.nextCursor) return null;
      // First page
      if (pageIndex === 0) return "/api/generations";
      // Subsequent pages
      return `/api/generations?cursor=${previousPageData!.nextCursor}`;
    },
    [userId],
  );

  const {
    data: pages,
    isLoading: isHistoryLoading,
    mutate: mutateHistory,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite<PageData>(getKey, fetcher, {
    fallbackData:
      initialHistory.length > 0
        ? [{ generations: initialHistory, nextCursor: null }]
        : undefined,
    revalidateFirstPage: true,
    revalidateAll: false,
  });

  // Accumulate all pages into flat history
  const dbHistory = useMemo<HistoryRow[]>(() => {
    if (!pages) return [];
    return pages.flatMap((page) => page.generations);
  }, [pages]);

  // Extract totalCount from first page (persists across pages)
  const totalCount = useMemo(() => {
    if (pages?.[0]?.totalCount !== undefined) {
      totalCountRef.current = pages[0].totalCount;
    }
    return totalCountRef.current;
  }, [pages]);

  // Has more pages to load
  const hasMore = useMemo(() => {
    if (!pages || pages.length === 0) return false;
    return pages[pages.length - 1].nextCursor !== null;
  }, [pages]);

  const isLoadingMore = isValidating && size > 1 && pages && size > pages.length;

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      startTransition(() => { setSize((s) => s + 1); });
    }
  }, [hasMore, isLoadingMore, setSize]);

  return {
    dbHistory,
    isHistoryLoading,
    mutateHistory,
    totalCount,
    hasMore,
    loadMore,
    isLoadingMore: !!isLoadingMore,
  };
}
