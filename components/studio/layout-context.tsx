"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface LayoutContextValue {
  sidebarWidth: number;
  isResizing: boolean;
  handleSidebarDragStart: (e: React.MouseEvent) => void;
  handleSidebarDblClick: () => void;
  MIN_SIDEBAR: number;
  prefersReducedMotion: boolean;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { sidebarWidth, isResizing, handleSidebarDragStart, handleSidebarDblClick, MIN_SIDEBAR } =
    useSidebarResize();
  const prefersReducedMotion = useReducedMotion();

  const value = useMemo(
    () => ({ sidebarWidth, isResizing, handleSidebarDragStart, handleSidebarDblClick, MIN_SIDEBAR, prefersReducedMotion }),
    [sidebarWidth, isResizing, handleSidebarDragStart, handleSidebarDblClick, MIN_SIDEBAR, prefersReducedMotion],
  );

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}
