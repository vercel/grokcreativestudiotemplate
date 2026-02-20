"use client";

import { useState, useEffect, useTransition } from "react";
import { useStudioState, useStudioActions, useStudioSelection } from "./studio-context";

export function MobileHeader() {
  const {
    showExplore,
    exploreSearch,
  } = useStudioState();
  const { exploreSelection, generationSelection } = useStudioSelection();
  const {
    setShowExplore,
    setExploreSelection,
    setGenerationSelection,
    setExploreSearch,
    feedRef,
  } = useStudioActions();
  const [localSearch, setLocalSearch] = useState(exploreSearch);
  const [, startTransition] = useTransition();

  // Sync from context (e.g. popstate clears search)
  useEffect(() => { setLocalSearch(exploreSearch); }, [exploreSearch]);

  return (
    <div className="flex flex-1 items-center justify-between px-3 md:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowExplore(true);
            setExploreSelection(null);
            setGenerationSelection(null);
            setExploreSearch("");
            setLocalSearch("");
            if (window.location.pathname !== "/explore") {
              window.history.replaceState({}, "", "/explore");
              document.title = "Grok Creative Studio";
            }
          }}
          className="whitespace-nowrap font-pixel text-sm text-foreground leading-tight hover:text-muted-foreground transition-colors"
        >
          GCS
        </button>
        <button
          type="button"
          onClick={() => {
            setShowExplore(true);
            setExploreSelection(null);
            setGenerationSelection(null);
            const path = window.location.pathname;
            if (/^\/explore\/[^/]+$/.test(path) || /^\/generations\/[^/]+$/.test(path)) {
              window.history.replaceState({}, "", "/explore");
              document.title = "Grok Creative Studio";
            }
            feedRef.current?.scrollTo({ top: 0 });
          }}
          className={`shrink-0 px-2 py-1 font-pixel text-[11px] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
            showExplore && !exploreSelection && !generationSelection
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Explore
        </button>
        <button
          type="button"
          onClick={() => {
            setShowExplore(false);
            setExploreSelection(null);
            setGenerationSelection(null);
            feedRef.current?.scrollTo({ top: 0 });
          }}
          className={`shrink-0 px-2 py-1 font-pixel text-[11px] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
            !showExplore && !exploreSelection && !generationSelection
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My work
        </button>
      </div>
      <div className="flex min-w-0 flex-1 items-center px-2">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => {
            const v = e.target.value;
            setLocalSearch(v);
            startTransition(() => setExploreSearch(v));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && localSearch) {
              e.preventDefault();
              setLocalSearch("");
              startTransition(() => setExploreSearch(""));
            }
          }}
          placeholder="search"
          className="w-full origin-left scale-[0.6875] bg-transparent font-pixel text-base uppercase text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
