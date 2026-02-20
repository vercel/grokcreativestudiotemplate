"use client";

import { useEffect, useRef } from "react";

interface KeyboardShortcutConfig {
  lightbox: unknown;
  exploreSelection: unknown;
  generationSelection: unknown;
  exploreSearch: string;
  visibleId: string | null;
  onCloseLightbox: () => void;
  onCloseExploreSelection: () => void;
  onCloseGenerationSelection: () => void;
  onClearSearch: () => void;
  onDelete: (id: string) => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutConfig) {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const cfg = configRef.current;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;

      if (e.key === "Escape") {
        if (cfg.lightbox) {
          e.preventDefault();
          cfg.onCloseLightbox();
          return;
        }
        if (cfg.exploreSelection) {
          e.preventDefault();
          cfg.onCloseExploreSelection();
          return;
        }
        if (cfg.generationSelection) {
          e.preventDefault();
          cfg.onCloseGenerationSelection();
          return;
        }
        if (cfg.exploreSearch) {
          e.preventDefault();
          cfg.onClearSearch();
          return;
        }
      }

      if (isInput || cfg.lightbox) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (cfg.visibleId) {
          e.preventDefault();
          cfg.onDelete(cfg.visibleId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
