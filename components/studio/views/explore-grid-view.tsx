"use client";

import { useCallback, useMemo } from "react";
import { ExploreGrid } from "@/components/explore-grid";
import type { SearchResult } from "@/lib/explore-queries";
import type { CompactManifest } from "@/lib/compact-manifest";
import { expandManifest } from "@/lib/compact-manifest";
import { useStudioState, useStudioActions, useStudioSelection } from "../studio-context";

interface ExploreGridViewProps {
  initialExploreManifest?: CompactManifest | null;
  initialSearchResults?: SearchResult | null;
}

export function ExploreGridView({
  initialExploreManifest,
  initialSearchResults,
}: ExploreGridViewProps = {}) {
  const { exploreSearch, items: userItems } = useStudioState();
  const { exploreSelection } = useStudioSelection();
  const {
    feedRef,
    exploreDeleteRef,
    exploreScrollY,
    setExploreSelection,
  } = useStudioActions();

  // Expand compact manifest on the client (avoids serializing verbose objects across RSC boundary)
  const items = useMemo(() => {
    if (!initialExploreManifest) return [];
    const page = expandManifest(initialExploreManifest);
    return page.items;
  }, [initialExploreManifest]);

  // Build a map of user's recently generated images so the explore grid
  // can show them instantly from the browser cache instead of a color square.
  const knownImages = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of userItems) {
      if (item.imageUrl) map.set(item.id, item.imageUrl);
    }
    return map.size > 0 ? map : undefined;
  }, [userItems]);

  // Stable callback — prevents MasonryGrid (React.memo) from re-rendering
  // when ExploreGridView re-renders due to exploreSearch changes.
  const handleSelectImage = useCallback(
    (img: { id: string; src: string; alt: string; isVideo?: boolean; userId: string; poster?: string; color?: string; muxPlaybackId?: string | null }) => {
      exploreScrollY.current = feedRef.current?.scrollTop ?? 0;
      setExploreSelection({
        id: img.id,
        src: img.src,
        alt: img.alt,
        isVideo: img.isVideo,
        userId: img.userId,
        poster: img.poster,
        color: img.color,
        muxPlaybackId: img.muxPlaybackId,
      });
      window.history.pushState(null, "", `/explore/${img.id}`);
    },
    [feedRef, exploreScrollY, setExploreSelection],
  );

  return (
    <ExploreGrid
      scrollRef={feedRef}
      initialItems={items}
      searchQuery={exploreSearch}
      searchFallbackData={initialSearchResults}
      deleteItemRef={exploreDeleteRef}
      onSelectImage={handleSelectImage}
      knownImages={knownImages}
      overlayActive={!!exploreSelection}
    />
  );
}
