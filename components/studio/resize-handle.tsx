"use client";

import { useLayout } from "./layout-context";

export function ResizeHandle() {
  const { sidebarWidth, handleSidebarDragStart, handleSidebarDblClick } =
    useLayout();

  return (
    <div
      onMouseDown={handleSidebarDragStart}
      onDoubleClick={handleSidebarDblClick}
      className={`hidden shrink-0 cursor-col-resize transition-all hover:bg-foreground/20 active:bg-foreground/30 md:block ${
        sidebarWidth === 0
          ? "w-3 bg-border/50 hover:bg-foreground/30"
          : "w-1.5 bg-transparent"
      }`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
    />
  );
}
