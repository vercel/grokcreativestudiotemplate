"use client";

import { useCallback, useEffect, type RefObject } from "react";
import type { ExploreSelectionType, GenerationSelectionType } from "@/components/studio/types";

interface UseStudioNavigationParams {
  showExplore: boolean;
  exploreSearch: string;
  exploreSelection: ExploreSelectionType;
  generationSelection: GenerationSelectionType;
  visibleId: string | null;
  setShowExplore: (v: boolean) => void;
  setExploreSelection: (v: ExploreSelectionType) => void;
  setGenerationSelection: (v: GenerationSelectionType) => void;
  setExploreSearch: (v: string) => void;
  feedRef: RefObject<HTMLDivElement | null>;
  exploreScrollY: RefObject<number>;
}

export function useStudioNavigation({
  showExplore,
  exploreSearch,
  exploreSelection,
  generationSelection,
  visibleId,
  setShowExplore,
  setExploreSelection,
  setGenerationSelection,
  setExploreSearch,
  feedRef,
  exploreScrollY,
}: UseStudioNavigationParams) {
  // ── URL sync ──
  useEffect(() => {
    // Don't overwrite /explore/[id] URLs — parallel route modal handles those
    if (/^\/explore\/[^/]+$/.test(window.location.pathname)) return;

    let target: string;
    if (showExplore && exploreSelection) {
      return;
    } else if (generationSelection) {
      return;
    } else if (showExplore) {
      target = exploreSearch
        ? `/explore?q=${encodeURIComponent(exploreSearch)}`
        : "/explore";
    } else {
      target = visibleId
        ? `/generations/${visibleId}`
        : "/generations";
    }
    const current = window.location.pathname + window.location.search;
    if (current !== target) {
      window.history.replaceState({}, "", target);
    }
  }, [showExplore, exploreSelection, generationSelection, exploreSearch, visibleId]);

  // ── Browser back/forward ──
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);

      // /explore/[id] is handled by parallel route modal — don't interfere
      if (/^\/explore\/[^/]+$/.test(path)) return;

      if (path === "/explore") {
        setShowExplore(true);
        setExploreSelection(null);
        setGenerationSelection(null);
        setExploreSearch(params.get("q") || "");
        requestAnimationFrame(() => {
          feedRef.current?.scrollTo(0, exploreScrollY.current);
        });
      } else if (path === "/generations" || /^\/generations\/[^/]+$/.test(path)) {
        setShowExplore(false);
        setExploreSelection(null);
        setGenerationSelection(null);
      } else {
        setExploreSelection(null);
        setGenerationSelection(null);
        setShowExplore(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setShowExplore, setExploreSelection, setGenerationSelection, setExploreSearch, feedRef, exploreScrollY]);

  // ── Close explore selection ──
  // Always use replaceState — history.back() can navigate to about:blank
  // if there's no prior entry (new tab, direct link, fast Escape).
  const closeExploreSelection = useCallback(() => {
    setExploreSelection(null);
    setShowExplore(true);
    window.history.replaceState({}, "", "/explore");
    document.title = "Grok Creative Studio";
    requestAnimationFrame(() => {
      feedRef.current?.scrollTo(0, exploreScrollY.current);
    });
  }, [setExploreSelection, setShowExplore, feedRef, exploreScrollY]);

  // ── Close generation selection ──
  const closeGenerationSelection = useCallback(() => {
    setGenerationSelection(null);
    setShowExplore(false);
    window.history.replaceState({}, "", "/generations");
    document.title = "Grok Creative Studio";
  }, [setGenerationSelection, setShowExplore]);

  return { closeExploreSelection, closeGenerationSelection };
}
