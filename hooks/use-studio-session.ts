"use client";

import { useCallback, type RefObject } from "react";
import type { SessionUser } from "@/lib/auth";
import type { GeneratedItem } from "@/lib/types";

interface UseStudioSessionParams {
  user: SessionUser | null;
  sessionLoading: boolean;
  mutateSession: () => Promise<unknown>;
  itemsRef: RefObject<GeneratedItem[]>;
  mutateHistory: () => void;
}

export function useStudioSession({
  mutateSession,
  mutateHistory,
}: UseStudioSessionParams) {
  const handleAuthComplete = useCallback(async () => {
    await mutateSession();
    mutateHistory();
  }, [mutateSession, mutateHistory]);

  const openAuth = useCallback(() => {
    // Auth removed in template version
  }, []);

  const handleLogout = useCallback(async () => {
    // Auth removed in template version
  }, []);

  return { handleAuthComplete, openAuth, handleLogout };
}
