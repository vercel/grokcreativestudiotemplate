export type ExploreSelectionType = {
  id: string;
  src: string;
  alt: string;
  isVideo?: boolean;
  userId: string;
  poster?: string;
  color?: string;
  muxPlaybackId?: string | null;
} | null;

export type GenerationSelectionType = {
  id: string;
  src: string;
  alt: string;
  isVideo: boolean;
  userId: string;
  poster?: string;
  aspectRatio: string;
} | null;

export type FeedEntry =
  | (import("@/lib/types").GeneratedItem & { isDb: false })
  | {
      id: string;
      mode: string;
      prompt: string;
      aspectRatio: import("@/lib/types").AspectRatio;
      src: string;
      posterUrl: string | null;
      muxPlaybackId: string | null;
      isVideo: boolean;
      isDb: true;
    };
