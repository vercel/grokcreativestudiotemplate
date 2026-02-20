"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useEffect,
  useMemo,
  startTransition,
  type ReactNode,
  type RefObject,
} from "react";
import type { SessionUser } from "@/lib/auth";
import type { SearchResult } from "@/lib/explore-queries";
import type { HistoryRow } from "@/lib/queries/user-history";
import type { AspectRatio, GenerationMode, GeneratedItem } from "@/lib/types";
import type { ExploreSelectionType, GenerationSelectionType, FeedEntry } from "./types";
export type { FeedEntry } from "./types";
import { useVisibleItem } from "@/hooks/use-visible-item";
import { useVideoProgress, loadInflightVideos, loadGeneratedImages, saveGeneratedImages } from "@/hooks/use-video-progress";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useStudioHistory } from "@/hooks/use-studio-history";
import { useStudioSession } from "@/hooks/use-studio-session";
import { useStudioFeed } from "@/hooks/use-studio-feed";
import { useStudioGenerate } from "@/hooks/use-studio-generate";
import { useStudioItemActions } from "@/hooks/use-studio-item-actions";
import { useStudioNavigation } from "@/hooks/use-studio-navigation";

// ─── State Context ───────────────────────────────────────────────────

interface StudioStateValue {
  prompt: string;
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  duration: 5 | 10;
  attachment: string | null;
  videoAttachment: string | null;
  items: GeneratedItem[];
  error: string | null;
  showExplore: boolean;
  exploreSearch: string;
  lightbox: { src: string; alt: string } | null;
  visibleId: string | null;
  scrollTarget: string | null;
  user: SessionUser | null;
  dbHistory: HistoryRow[];
  feedItems: FeedEntry[];
}

const StudioStateContext = createContext<StudioStateValue | null>(null);

export function useStudioState() {
  const ctx = useContext(StudioStateContext);
  if (!ctx) throw new Error("useStudioState must be used within StudioProvider");
  return ctx;
}

// ─── Actions Context ─────────────────────────────────────────────────

interface StudioActionsValue {
  generate: () => void;
  cancelItem: (id: string) => void;
  deleteItem: (id: string) => void;
  setPrompt: (v: string) => void;
  setMode: (m: GenerationMode) => void;
  setAspectRatio: (r: AspectRatio) => void;
  setDuration: (d: 5 | 10) => void;
  setAttachment: (v: string | null) => void;
  setVideoAttachment: (v: string | null) => void;
  setShowExplore: (v: boolean) => void;
  setExploreSearch: (v: string) => void;
  setExploreSelection: (v: ExploreSelectionType) => void;
  setGenerationSelection: (v: GenerationSelectionType) => void;
  setLightbox: (v: { src: string; alt: string } | null) => void;
  setVisibleId: (v: string | null) => void;
  setError: (v: string | null) => void;
  closeExploreSelection: () => void;
  closeGenerationSelection: () => void;
  handleAuthComplete: () => Promise<void>;
  openAuth: () => void;
  handleLogout: () => Promise<void>;
  handleEdit: (item: GeneratedItem) => void;
  handleDownload: (item: GeneratedItem) => void;
  handleCopy: (item: GeneratedItem) => void;
  handleEditExplore: (selection: NonNullable<ExploreSelectionType>) => void;
  handleDownloadExplore: (selection: NonNullable<ExploreSelectionType>) => void;
  handleDeleteExplore: (selection: NonNullable<ExploreSelectionType>) => Promise<void>;
  feedRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<Map<string, HTMLDivElement>>;
  scrollingFromClick: RefObject<boolean>;
  exploreDeleteRef: RefObject<((id: string) => void) | null>;
  exploreScrollY: RefObject<number>;
  toBase64Attachment: (src: string) => Promise<string | null>;
}

const StudioActionsContext = createContext<StudioActionsValue | null>(null);

export function useStudioActions() {
  const ctx = useContext(StudioActionsContext);
  if (!ctx) throw new Error("useStudioActions must be used within StudioProvider");
  return ctx;
}

// ─── Meta Context ────────────────────────────────────────────────────

interface StudioMetaValue {
  isGenerating: boolean;
  activeGenerations: number;
  sessionLoading: boolean;
  isHistoryLoading: boolean;
  historyTotalCount: number | undefined;
  historyHasMore: boolean;
  historyLoadMore: () => void;
  isHistoryLoadingMore: boolean;
}

const StudioMetaContext = createContext<StudioMetaValue | null>(null);

export function useStudioMeta() {
  const ctx = useContext(StudioMetaContext);
  if (!ctx) throw new Error("useStudioMeta must be used within StudioProvider");
  return ctx;
}

// ─── Progress Context ─────────────────────────────────────────────────
// Separated from state context because progressMap updates every 100-500ms
// during generation. Without separation, every useStudioState() consumer
// (ExploreGrid, AuthDisplay, etc.) would re-render on each tick.

interface StudioProgressValue {
  progressMap: Map<string, number>;
}

const StudioProgressContext = createContext<StudioProgressValue | null>(null);

export function useStudioProgress() {
  const ctx = useContext(StudioProgressContext);
  if (!ctx) throw new Error("useStudioProgress must be used within StudioProvider");
  return ctx;
}

// ─── Selection Context ────────────────────────────────────────────────
// Separated from state context because selection changes (clicking an
// explore/generation item) should NOT re-render the heavy ExploreGrid,
// MobileBottomBar, Sidebar, etc. — only the overlay and mobile header.

interface StudioSelectionValue {
  exploreSelection: ExploreSelectionType;
  generationSelection: GenerationSelectionType;
}

const StudioSelectionContext = createContext<StudioSelectionValue | null>(null);

export function useStudioSelection() {
  const ctx = useContext(StudioSelectionContext);
  if (!ctx) throw new Error("useStudioSelection must be used within StudioProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────

interface StudioProviderProps {
  initialSession: SessionUser | null;
  initialHistory: HistoryRow[];
  initialPath: string;
  initialSearchQuery?: string;
  initialSearchResults?: SearchResult | null;
  initialExploreSelection?: ExploreSelectionType;
  initialGenerationSelection?: GenerationSelectionType;
  initialScrollTarget?: string;
  children: ReactNode;
}

export function StudioProvider({
  initialSession,
  initialHistory,
  initialPath,
  initialSearchQuery,
  initialSearchResults,
  initialExploreSelection,
  initialGenerationSelection,
  initialScrollTarget,
  children,
}: StudioProviderProps) {
  // ── Session (auth removed — always null) ──
  const user = null as SessionUser | null;
  const sessionLoading = false;
  const mutateSession = useCallback(async () => ({}), []);

  // ── History (SWR with server fallback) ──
  const {
    dbHistory,
    isHistoryLoading,
    mutateHistory,
    totalCount: historyTotalCount,
    hasMore: historyHasMore,
    loadMore: historyLoadMore,
    isLoadingMore: isHistoryLoadingMore,
  } = useStudioHistory(user?.id, initialHistory);

  // ── Core state ──
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [mode, setMode] = useState<GenerationMode>("image");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [videoAttachment, setVideoAttachment] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [visibleId, setVisibleId] = useState<string | null>(initialScrollTarget ?? null);
  const [showExplore, setShowExplore] = useState(initialPath !== "/generations");
  const [exploreSearch, setExploreSearch] = useState(initialSearchQuery || "");

  // PPR: shell renders before searchParams are available. Sync from URL on mount.
  useEffect(() => {
    if (!initialSearchQuery) {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q?.trim()) setExploreSearch(q.trim());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [exploreSelection, setExploreSelection] = useState<ExploreSelectionType>(
    initialExploreSelection ?? null,
  );
  const [generationSelection, setGenerationSelection] = useState<GenerationSelectionType>(
    initialGenerationSelection ?? null,
  );
  const [activeGenerations, setActiveGenerations] = useState(0);

  // ── Refs for stable handleGenerate (rerender-defer-reads) ──
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const aspectRatioRef = useRef(aspectRatio);
  aspectRatioRef.current = aspectRatio;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const attachmentRef = useRef(attachment);
  attachmentRef.current = attachment;
  const videoAttachmentRef = useRef(videoAttachment);
  videoAttachmentRef.current = videoAttachment;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const exploreScrollY = useRef(0);
  const deleteRef = useRef<((id: string) => void) | null>(null);
  const exploreDeleteRef = useRef<((id: string) => void) | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollingFromClick = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Session (auth flows + localStorage sync) ──
  const { handleAuthComplete, openAuth, handleLogout } = useStudioSession({
    user,
    sessionLoading,
    mutateSession,
    itemsRef,
    mutateHistory,
  });

  // ── Item actions (download, copy, edit, delete, paste, explore actions) ──
  const {
    handleDownload,
    handleCopy,
    handleEdit,
    handleDelete,

    handleEditExplore,
    handleDownloadExplore,
    handleDeleteExplore,
    toBase64Attachment,
  } = useStudioItemActions({
    setItems,
    mutateHistory,
    setAttachment,
    setMode,
    setAspectRatio,
    setPrompt,
    setVideoAttachment,
    setShowExplore,
    setExploreSelection,
    exploreDeleteRef,
  });
  deleteRef.current = handleDelete;

  // ── Feed items ──
  const feedItems = useStudioFeed(items, dbHistory);

  // ── Video progress ──
  const { progressMap, setProgressMap, inFlightRef, reconnectDbVideos } =
    useVideoProgress(items, setItems, mutateHistory);

  // ── Visible item detection ──
  const observedVisibleId = useVisibleItem(feedRef, itemRefs, scrollingFromClick, feedItems.length);
  useEffect(() => {
    if (observedVisibleId) setVisibleId(observedVisibleId);
  }, [observedVisibleId]);

  // ── Hydrate client-only state (avoid SSR mismatch) ──
  // Merge instead of replace — reconnect effect may have already added items.
  useEffect(() => {
    const inflight = loadInflightVideos();
    const images = loadGeneratedImages();
    const restored = [...inflight, ...images];
    if (restored.length > 0) {
      setItems((prev) => {
        if (prev.length === 0) return restored;
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = restored.filter((i) => !existingIds.has(i.id));
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }
  }, []);

  // ── Persist generated images to sessionStorage (unauthenticated users) ──
  const imagesSavedRef = useRef(false);
  useEffect(() => {
    // Skip mount — items were just loaded FROM sessionStorage
    if (!imagesSavedRef.current) { imagesSavedRef.current = true; return; }
    saveGeneratedImages(items);
  }, [items]);

  // ── Reconnect pending videos from DB ──
  useEffect(() => {
    reconnectDbVideos(dbHistory as Parameters<typeof reconnectDbVideos>[0]);
  }, [dbHistory, reconnectDbVideos]);

  // ── Reconcile in-memory items with DB history ──
  // 1. Completed items already in DB are removed from `items` so they
  //    appear at their correct chronological position in dbHistory instead
  //    of being stuck at the top from sessionStorage restoration.
  // 2. In-flight videos that actually completed are updated.
  useEffect(() => {
    if (dbHistory.length === 0) return;
    const dbMap = new Map(dbHistory.map((h) => [h.id, h]));
    const reconciledIds: string[] = [];

    startTransition(() => setItems((prev) => {
      const next: GeneratedItem[] = [];
      let changed = false;

      for (const item of prev) {
        const dbItem = dbMap.get(item.id);

        // Completed item already in DB — drop from in-memory so
        // dbHistory shows it in the correct chronological position.
        if (dbItem && (dbItem.image_url || dbItem.video_url)) {
          const isCompleted =
            (item.mode === "image" && (item.base64 || item.imageUrl)) ||
            (item.mode === "video" && (item.videoStatus === "completed" || item.videoStatus === "failed"));
          if (isCompleted) {
            changed = true;
            continue; // drop — dbHistory handles it
          }

          // In-flight video that actually completed server-side
          if (
            item.mode === "video" &&
            item.videoStatus !== "completed" &&
            item.videoStatus !== "failed" &&
            dbItem.video_url
          ) {
            changed = true;
            reconciledIds.push(item.id);
            next.push({
              ...item,
              videoStatus: "completed" as const,
              videoUrl: dbItem.video_url,
              imageUrl: dbItem.image_url || item.imageUrl,
              muxPlaybackId: dbItem.mux_playback_id ?? undefined,
            });
            continue;
          }
        }

        next.push(item);
      }

      return changed ? next : prev;
    }));

    for (const id of reconciledIds) {
      const entry = inFlightRef.current.get(id);
      if (entry) {
        clearInterval(entry.interval);
        entry.abort.abort();
        inFlightRef.current.delete(id);
      }
    }
    if (reconciledIds.length > 0) {
      setProgressMap((prev) => {
        const next = new Map(prev);
        for (const id of reconciledIds) next.delete(id);
        return next;
      });
    }
  }, [dbHistory, inFlightRef, setProgressMap]);

  // ── Navigation (URL sync, popstate, close handlers) ──
  const { closeExploreSelection, closeGenerationSelection } =
    useStudioNavigation({
      showExplore,
      exploreSearch,
      exploreSelection,
      generationSelection,
      visibleId,
      setShowExplore,
      setExploreSelection,
      setGenerationSelection,
      setExploreSearch,
      feedRef,
      exploreScrollY,
    });

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    lightbox,
    exploreSelection,
    generationSelection,
    exploreSearch,
    visibleId,
    onCloseLightbox: () => setLightbox(null),
    onCloseExploreSelection: closeExploreSelection,
    onCloseGenerationSelection: closeGenerationSelection,
    onClearSearch: () => setExploreSearch(""),
    onDelete: (id) => deleteRef.current?.(id),
  });

  // ── Generate + Cancel ──
  const { handleGenerate, handleCancelItem } = useStudioGenerate({
    promptRef,
    aspectRatioRef,
    modeRef,
    durationRef,
    attachmentRef,
    videoAttachmentRef,
    setPrompt,
    setAttachment,
    setVideoAttachment,
    setError,
    setShowExplore,
    setExploreSelection,
    setGenerationSelection,
    setItems,
    setVisibleId,
    setActiveGenerations,
    setProgressMap,
    inFlightRef,
    feedRef,
    mutateHistory,
  });

  // ── Assemble context values ──
  const stateValue = useMemo<StudioStateValue>(
    () => ({
      prompt,
      mode,
      aspectRatio,
      duration,
      attachment,
      videoAttachment,
      items,
      error,
      showExplore,
      exploreSearch,
      lightbox,
      visibleId,
      scrollTarget: initialScrollTarget ?? null,
      user,
      dbHistory,
      feedItems,
    }),
    [
      prompt,
      mode,
      aspectRatio,
      duration,
      attachment,
      videoAttachment,
      items,
      error,
      showExplore,
      exploreSearch,
      lightbox,
      visibleId,
      initialScrollTarget,
      user,
      dbHistory,
      feedItems,
    ],
  );

  const selectionValue = useMemo<StudioSelectionValue>(
    () => ({ exploreSelection, generationSelection }),
    [exploreSelection, generationSelection],
  );

  const actionsValue = useMemo<StudioActionsValue>(
    () => ({
      generate: handleGenerate,
      cancelItem: handleCancelItem,
      deleteItem: handleDelete,
      setPrompt,
      setMode,
      setAspectRatio,
      setDuration,
      setAttachment,
      setVideoAttachment,
      setShowExplore,
      setExploreSearch,
      setExploreSelection,
      setGenerationSelection,
      setLightbox,
      setVisibleId,
      setError,
      closeExploreSelection,
      closeGenerationSelection,
      handleAuthComplete,
      openAuth,
      handleLogout,
      handleEdit,
      handleDownload,
      handleCopy,
      handleEditExplore,
      handleDownloadExplore,
      handleDeleteExplore,
  
      feedRef,
      itemRefs,
      scrollingFromClick,
      exploreDeleteRef,
      exploreScrollY,
      toBase64Attachment,
    }),
    [
      handleGenerate,
      handleCancelItem,
      handleDelete,
      closeExploreSelection,
      closeGenerationSelection,
      handleAuthComplete,
      openAuth,
      handleLogout,
      handleEdit,
      handleDownload,
      handleCopy,
      handleEditExplore,
      handleDownloadExplore,
      handleDeleteExplore,
  
      toBase64Attachment,
    ],
  );

  const metaValue = useMemo<StudioMetaValue>(
    () => ({
      isGenerating: activeGenerations > 0,
      activeGenerations,
      sessionLoading,
      isHistoryLoading,
      historyTotalCount,
      historyHasMore,
      historyLoadMore,
      isHistoryLoadingMore,
    }),
    [activeGenerations, sessionLoading, isHistoryLoading, historyTotalCount, historyHasMore, historyLoadMore, isHistoryLoadingMore],
  );

  const progressValue = useMemo<StudioProgressValue>(
    () => ({ progressMap }),
    [progressMap],
  );

  return (
    <StudioStateContext.Provider value={stateValue}>
      <StudioActionsContext.Provider value={actionsValue}>
        <StudioSelectionContext.Provider value={selectionValue}>
          <StudioMetaContext.Provider value={metaValue}>
            <StudioProgressContext.Provider value={progressValue}>
              {children}
            </StudioProgressContext.Provider>
          </StudioMetaContext.Provider>
        </StudioSelectionContext.Provider>
      </StudioActionsContext.Provider>
    </StudioStateContext.Provider>
  );
}
