"use client";

import type { ReactNode } from "react";

export function Header({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center md:h-16">
      {children}
    </div>
  );
}
