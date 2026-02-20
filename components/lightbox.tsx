"use client";

import { useEffect, useCallback } from "react";

interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

function optimizedUrl(src: string, w = 1200, q = 75) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  // Same 1200px URL as the detail view — already in browser cache → instant.
  const displaySrc = optimizedUrl(src);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95">
      {/* Close area */}
      <div className="absolute inset-0 cursor-zoom-out" aria-hidden="true" onClick={onClose} />

      {/* Close button — larger touch target on mobile */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 z-10 border border-border bg-background px-3 py-2 font-pixel text-[10px] uppercase text-foreground transition-colors hover:bg-foreground hover:text-background md:right-4 md:top-4 md:py-1"
        aria-label="Close lightbox"
      >
        Close
      </button>

      {/* Image — same 1200px as detail, already cached */}
      <img
        src={displaySrc}
        alt={alt}
        role="button"
        tabIndex={0}
        className="relative z-10 max-h-[85vh] max-w-[95vw] cursor-zoom-out object-contain md:max-h-[90vh] md:max-w-[90vw]"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
      />
    </div>
  );
}
