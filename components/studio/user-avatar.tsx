"use client";

import { useState, useRef, useEffect } from "react";

export function UserAvatar({
  user,
  onLogout,
}: {
  user: { name: string | null; email: string | null; avatar_url: string | null };
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = (user.name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border transition-colors hover:border-foreground/50"
        aria-label="Account menu"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-pixel text-[9px] text-muted-foreground">
            {initials}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-40 border border-border bg-background shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate font-pixel text-[10px] text-foreground">
              {user.name || user.email}
            </p>
            {user.name && user.email && (
              <p className="truncate font-pixel text-[8px] text-muted-foreground/70">
                {user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full px-3 py-2 text-left font-pixel text-[10px] uppercase text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
