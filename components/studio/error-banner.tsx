"use client";

import { useStudioState } from "./studio-context";

export function ErrorBanner() {
  const { error } = useStudioState();
  if (!error) return null;

  return (
    <div className="shrink-0 border-b border-border bg-destructive/5 px-4 py-1">
      <p className="font-pixel text-[10px] uppercase text-destructive">
        {error}
      </p>
    </div>
  );
}
