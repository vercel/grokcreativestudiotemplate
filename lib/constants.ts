import type { AspectRatio } from "@/lib/types";

export const VALID_RATIOS: readonly AspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
] as const;

export function isValidRatio(value: string): value is AspectRatio {
  return (VALID_RATIOS as readonly string[]).includes(value);
}

export const ASPECT_RATIO_CSS: Record<AspectRatio, string> = {
  "1:1": "1/1",
  "16:9": "16/9",
  "9:16": "9/16",
  "4:3": "4/3",
  "3:4": "3/4",
  "3:2": "3/2",
  "2:3": "2/3",
};

export const MAX_PROMPT_LENGTH = 4000;

export const ASPECT_RATIO_FACTOR: Record<AspectRatio, number> = {
  "1:1": 1,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
};
