"use client";

import { useCallback } from "react";
import { useDragAndDrop } from "@/hooks/use-drag-and-drop";
import { useStudioActions } from "./studio-context";

export function useDragOverlay() {
  const { setAttachment, setVideoAttachment, setMode } = useStudioActions();

  const handleFileDrop = useCallback(
    (base64: string) => {
      setAttachment(base64);
      setMode("image");
    },
    [setAttachment, setMode],
  );

  const handleVideoDrop = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      setVideoAttachment(url);
      setMode("video");
    },
    [setVideoAttachment, setMode],
  );

  const { isDragging, dragProps } = useDragAndDrop(handleFileDrop, handleVideoDrop);

  return { isDragging, dragProps };
}

export function DragOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="border border-dashed border-foreground/30 px-8 py-6">
        <p className="font-pixel text-xs uppercase text-foreground">
          Drop file to attach
        </p>
      </div>
    </div>
  );
}
