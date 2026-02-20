"use client";

import { Sidebar } from "@/components/sidebar";
import { useStudioState, useStudioActions, useStudioMeta } from "./studio-context";
import { useLayout } from "./layout-context";

export function SidebarShell() {
  const { items, dbHistory, showExplore, visibleId } = useStudioState();
  const {
    setShowExplore,
    setExploreSelection,
    setGenerationSelection,
    setVisibleId,
    feedRef,
    itemRefs,
    scrollingFromClick,
  } = useStudioActions();
  const {
    isHistoryLoading,
    sessionLoading,
    historyTotalCount,
    historyHasMore,
    historyLoadMore,
    isHistoryLoadingMore,
  } = useStudioMeta();
  const { sidebarWidth, isResizing, prefersReducedMotion } = useLayout();

  return (
    <Sidebar
      items={items}
      dbHistory={dbHistory}
      isHistoryLoading={isHistoryLoading || sessionLoading}
      historyTotalCount={historyTotalCount}
      historyHasMore={historyHasMore}
      historyLoadMore={historyLoadMore}
      isHistoryLoadingMore={isHistoryLoadingMore}
      activeId={visibleId}
      onSelectImage={(id) => {
        setShowExplore(false);
        setExploreSelection(null);
        setGenerationSelection(null);
        setVisibleId(id);
        requestAnimationFrame(() => {
          const el = itemRefs.current.get(id);
          if (el) {
            scrollingFromClick.current = true;
            el.scrollIntoView({ behavior: "instant", block: "start" });
            scrollingFromClick.current = false;
          }
        });
      }}
      onExplore={() => {
        setShowExplore(true);
        setExploreSelection(null);
        setGenerationSelection(null);
        feedRef.current?.scrollTo({ top: 0 });
        const path = window.location.pathname;
        if (path.startsWith("/generations/") || path.startsWith("/explore/")) {
          window.history.replaceState({}, "", "/explore");
          document.title = "Grok Creative Studio";
        }
      }}
      onMyWork={() => {
        setShowExplore(false);
        setExploreSelection(null);
        setGenerationSelection(null);
        feedRef.current?.scrollTo({ top: 0 });
        const path = window.location.pathname;
        if (path.startsWith("/generations/") || path.startsWith("/explore/")) {
          window.history.replaceState({}, "", "/explore");
          document.title = "Grok Creative Studio";
        }
      }}
      showExplore={showExplore}
      width={sidebarWidth}
      isResizing={isResizing}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
}
