"use client";

import { useState, useEffect, useTransition } from "react";
import { useStudioState, useStudioActions } from "./studio-context";

export function DesktopSearchInput() {
  const { exploreSearch } = useStudioState();
  const { setExploreSearch } = useStudioActions();
  const [localSearch, setLocalSearch] = useState(exploreSearch);
  const [, startTransition] = useTransition();

  // Sync from context (e.g. popstate clears search)
  useEffect(() => { setLocalSearch(exploreSearch); }, [exploreSearch]);

  return (
    <div
      className="hidden shrink-0 items-center border-l border-border px-3 md:flex"
      style={{ width: 180 }}
    >
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
        className="w-full bg-transparent font-pixel text-sm lowercase text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
