"use client";

import { Activity, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { SearchResult } from "@/lib/explore-queries";
import type { CompactManifest } from "@/lib/compact-manifest";
import { useStudioState, useStudioActions, useStudioSelection } from "./studio-context";
import { ExploreGridView } from "./views/explore-grid-view";

const MyWorkFeedView = dynamic(() => import("./views/my-work-feed-view").then((m) => m.MyWorkFeedView), { ssr: false });
const ExploreSelectionView = dynamic(() => import("./views/explore-selection-view").then((m) => m.ExploreSelectionView), { ssr: false });
const GenerationDetailView = dynamic(() => import("./views/generation-detail-view").then((m) => m.GenerationDetailView), { ssr: false });

interface MainContentProps {
  initialExploreManifest?: CompactManifest | null;
  initialSearchResults?: SearchResult | null;
}

export function MainContent({ initialExploreManifest, initialSearchResults }: MainContentProps) {
  const { showExplore } = useStudioState();
  const { exploreSelection, generationSelection } = useStudioSelection();
  const { feedRef } = useStudioActions();

  // Scroll to top when switching between explore and my work
  const prevShowExplore = useRef(showExplore);
  useEffect(() => {
    if (prevShowExplore.current !== showExplore) {
      prevShowExplore.current = showExplore;
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [showExplore, feedRef]);

  return (
    <main className="relative flex min-w-0 flex-1 flex-col">
      <div ref={feedRef} className="relative flex-1 overflow-y-auto bg-background scrollbar-none">
        <Activity mode={showExplore ? "visible" : "hidden"}>
          <ExploreGridView
            initialExploreManifest={initialExploreManifest}
            initialSearchResults={initialSearchResults}
          />
        </Activity>
        <Activity mode={!showExplore ? "visible" : "hidden"}>
          <div className="h-full @container/feed" style={{ containerType: "size" }}>
            <MyWorkFeedView />
          </div>
        </Activity>
      </div>
      {exploreSelection && (
        <div className="absolute inset-0 z-10">
          <ExploreSelectionView />
        </div>
      )}
      {generationSelection && (
        <div className="absolute inset-0 z-10">
          <GenerationDetailView />
        </div>
      )}
    </main>
  );
}
