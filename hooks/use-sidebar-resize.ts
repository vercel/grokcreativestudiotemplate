"use client";

import { useState, useCallback, useRef } from "react";
import type React from "react";

const MIN_SIDEBAR = 160;
const DEFAULT_SIDEBAR = 280;
const MAX_SIDEBAR = 480;

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const [isResizing, setIsResizing] = useState(false);
  const isDraggingSidebar = useRef(false);
  const prevWidthRef = useRef(DEFAULT_SIDEBAR);

  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const x = ev.clientX;
      if (x < MIN_SIDEBAR) {
        setSidebarWidth(0);
      } else {
        const clamped = Math.min(MAX_SIDEBAR, x);
        setSidebarWidth(clamped);
        prevWidthRef.current = clamped;
      }
    };
    const onUp = () => {
      isDraggingSidebar.current = false;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleSidebarDblClick = useCallback(() => {
    setSidebarWidth((w) => {
      if (w === 0) return prevWidthRef.current || DEFAULT_SIDEBAR;
      prevWidthRef.current = w;
      return 0;
    });
  }, []);

  return {
    sidebarWidth,
    isResizing,
    handleSidebarDragStart,
    handleSidebarDblClick,
    MIN_SIDEBAR,
  };
}
