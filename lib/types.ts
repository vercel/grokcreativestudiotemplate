export type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3";

export type GenerationMode = "image" | "video";

export interface VideoProgress {
  status: "pending" | "in_progress" | "completed" | "failed";
  url?: string;
  muxPlaybackId?: string;
  error?: string;
}

export interface GeneratedItem {
  id: string;
  mode: GenerationMode;
  prompt: string;
  aspectRatio: AspectRatio;
  timestamp: number;
  base64?: string;
  imageUrl?: string;
  videoUrl?: string;
  muxPlaybackId?: string;
  videoStatus?: VideoProgress["status"];
  videoError?: string;
  runId?: string;
}
