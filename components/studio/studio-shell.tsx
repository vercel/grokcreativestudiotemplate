"use client";

import type { SearchResult } from "@/lib/explore-queries";
import type { CompactManifest } from "@/lib/compact-manifest";
import { Header } from "./header";
import { DesktopTitle } from "./desktop-title";
import { DesktopPromptSlot } from "./desktop-prompt-slot";
import { DesktopSearchInput } from "./desktop-search-input";
import { AuthDisplay } from "./auth-display";
import { MobileHeader } from "./mobile-header";
import { ErrorBanner } from "./error-banner";
import { SidebarShell } from "./sidebar-shell";
import { ResizeHandle } from "./resize-handle";
import { MainContent } from "./main-content";
import { MobileBottomBar } from "./mobile-bottom-bar";
import { DragOverlay, useDragOverlay } from "./drag-overlay";
import { LightboxPortal } from "./lightbox-portal";

interface StudioShellProps {
  initialExploreManifest?: CompactManifest | null;
  initialSearchResults?: SearchResult | null;
}

export function StudioShell({ initialExploreManifest, initialSearchResults }: StudioShellProps) {
  const { isDragging, dragProps } = useDragOverlay();

  return (
    <>
      <div
        className="relative flex h-dvh flex-col overflow-hidden bg-background pb-24 md:pb-0"
        {...dragProps}
      >
        <DragOverlay isDragging={isDragging} />

        <Header>
          <DesktopTitle />
          <MobileHeader />
          <DesktopPromptSlot />
          <DesktopSearchInput />
          <AuthDisplay />
        </Header>

        <ErrorBanner />

        <div className="flex min-h-0 flex-1">
          <SidebarShell />
          <ResizeHandle />
          <MainContent initialExploreManifest={initialExploreManifest} initialSearchResults={initialSearchResults} />
        </div>
      </div>

      <MobileBottomBar />
      <LightboxPortal />
    </>
  );
}
