"use client";

import React, { useRef, useEffect, useState } from "react";
import type { AspectRatio, GenerationMode } from "@/lib/types";
import { VALID_RATIOS } from "@/lib/constants";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (value: AspectRatio) => void;
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  attachment: string | null;
  onAttachmentChange: (base64: string | null) => void;
  videoAttachment: string | null;
  onVideoAttachmentChange: (url: string | null) => void;
  duration: 5 | 10;
  onDurationChange: (d: 5 | 10) => void;
  variant?: "inline" | "stacked";
  generationDisabled?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  aspectRatio,
  onAspectRatioChange,
  mode,
  onModeChange,
  attachment,
  onAttachmentChange,
  videoAttachment,
  onVideoAttachmentChange,
  duration,
  onDurationChange,
  variant = "inline",
  generationDisabled = false,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [settingsOpen]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Global key capture: redirect typing to prompt bar when nothing is focused.
  // Only on desktop (variant="inline") to avoid triggering mobile keyboard.
  useEffect(() => {
    if (variant !== "inline") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      // Skip if already in an input, textarea, contenteditable, or dialog
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active as HTMLElement)?.isContentEditable ||
        (active as HTMLElement)?.closest("dialog, [role='dialog']")
      ) return;
      // Skip modifier combos (Ctrl+C, Cmd+A, etc.) and non-printable keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      // Focus the textarea — the keypress will naturally type the character
      textareaRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  const attachImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) {
        onAttachmentChange(base64);
        if (mode !== "image") onModeChange("image");
      }
    };
    reader.readAsDataURL(file);
  };

  const blobUrlRef = useRef<string | null>(null);

  const attachVideo = (file: File) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    onVideoAttachmentChange(url);
    if (mode !== "video") onModeChange("video");
  };

  useEffect(() => {
    if (!videoAttachment && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [videoAttachment]);

  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      attachImage(file);
    } else if (isVideoFile(file)) {
      attachVideo(file);
    }
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        attachImage(file);
        break;
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const isVideoFile = (f: File) =>
    f.type.startsWith("video/") ||
    /\.(mp4|mov|webm|avi|mkv)$/i.test(f.name);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        attachImage(file);
      } else if (isVideoFile(file)) {
        attachVideo(file);
      }
    }
  };

  const dragProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  const attachmentSrc = attachment
    ? attachment.startsWith("data:") || attachment.startsWith("http")
      ? attachment
      : `data:image/png;base64,${attachment}`
    : null;

  const attachmentThumb = attachmentSrc && (
    <div className="relative mx-2 flex shrink-0 items-center self-center">
      <img
        src={attachmentSrc}
        alt="Attached"
        className="h-8 w-8 border border-border object-cover"
      />
      <button
        type="button"
        onClick={() => onAttachmentChange(null)}
        className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background"
        aria-label="Remove attachment"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );

  const videoAttachmentThumb = videoAttachment && (
    <div className="relative mx-2 flex shrink-0 items-center self-center">
      <div className="relative h-8 w-8 border border-border bg-muted">
        {/* Fallback icon shown behind video until first frame loads */}
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/70">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2.5 1v10l8.5-5z" />
          </svg>
        </div>
        <video
          src={videoAttachment}
          muted
          playsInline
          preload="metadata"
          className="relative h-full w-full object-cover"
        />
      </div>
      <button
        type="button"
        onClick={() => onVideoAttachmentChange(null)}
        className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background"
        aria-label="Remove video attachment"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );

  const uploadBtn = !attachment && !videoAttachment && (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      className={`flex shrink-0 items-center gap-1.5 self-stretch px-3 font-pixel text-[10px] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
        isDragOver
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
      title="Upload image or video to edit (or drag & drop)"
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 10V3M4 5.5L7 2.5L10 5.5" />
        <path d="M2 9v2.5h10V9" />
      </svg>
      Upload
    </button>
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*,video/*"
      className="hidden"
      onChange={handleFileSelect}
    />
  );

  const textArea = (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={
        attachment || videoAttachment
          ? "Describe edits…"
          : mode === "image"
            ? "Describe image…"
            : "Describe video…"
      }
      rows={1}
      className="max-h-[3.25rem] flex-1 resize-none self-center overflow-y-auto bg-transparent px-2 py-2 font-pixel text-base leading-tight text-foreground placeholder:text-muted-foreground/60 scrollbar-none focus:outline-none md:text-lg"
    />
  );

  const submitBtn = (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!value.trim() || generationDisabled}
      className="flex shrink-0 items-center self-stretch bg-foreground px-5 font-pixel text-[10px] uppercase text-background transition-colors hover:bg-foreground/80 disabled:bg-muted disabled:text-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1"
      aria-label={`Generate ${mode}`}
      title={generationDisabled ? "Generation disabled — AI_GATEWAY_API_KEY not set" : undefined}
    >
      {attachment || videoAttachment ? "Edit" : "Generate"}
    </button>
  );

  const modeToggles = (
    <>
      <button
        type="button"
        onClick={() => onModeChange("image")}
        className={`flex shrink-0 items-center self-stretch px-3 font-pixel text-[10px] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
          mode === "image"
            ? "bg-muted-foreground/20 text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Image
      </button>
      <button
        type="button"
        onClick={() => onModeChange("video")}
        className={`flex shrink-0 items-center self-stretch px-3 font-pixel text-[10px] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
          mode === "video"
            ? "bg-muted-foreground/20 text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Video
      </button>
    </>
  );

  const settingsDropdown = (
    <div ref={settingsRef} className="relative shrink-0 self-stretch">
      <button
        type="button"
        onClick={() => setSettingsOpen(!settingsOpen)}
        className={`flex h-full items-center gap-1 px-3 font-pixel text-[10px] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 ${
          settingsOpen
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Settings
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`}
        >
          <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      {settingsOpen && (
        <div className={`absolute z-50 min-w-[140px] border border-border bg-background ${variant === "stacked" ? "bottom-full right-0" : "right-0 top-full"}`}>
          {/* Aspect ratio */}
          <div className="border-b border-border/50 px-3 py-1.5">
            <span className="font-pixel text-[8px] uppercase text-muted-foreground/70">Ratio</span>
          </div>
          {VALID_RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onAspectRatioChange(r)}
              className={`block w-full px-4 py-1.5 text-left font-pixel text-[10px] uppercase ${
                aspectRatio === r
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
          {/* Duration — only in video mode */}
          {mode === "video" && (
            <>
              <div className="border-t border-border/50 px-3 py-1.5">
                <span className="font-pixel text-[8px] uppercase text-muted-foreground/70">Duration</span>
              </div>
              {([5, 10] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  className={`block w-full px-4 py-1.5 text-left font-pixel text-[10px] uppercase ${
                    duration === d
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {d}s
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );

  if (variant === "stacked") {
    return (
      <div className="flex flex-col pb-[env(safe-area-inset-bottom)]" {...dragProps}>
        {fileInput}
        {/* Row 1: controls */}
        <div className="flex h-9 items-center border-b border-border/50 px-1">
          {modeToggles}
          {settingsDropdown}
        </div>
        {/* Row 2: input + submit */}
        <div className="flex min-h-11 items-stretch">
          <div className="min-w-0 flex-1" onClick={() => textareaRef.current?.focus()}>{textArea}</div>
          {uploadBtn}
          {attachmentThumb}
          {videoAttachmentThumb}
          {submitBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-16 items-center" {...dragProps}>
      {fileInput}
      <div className="flex min-w-0 flex-1 items-center self-stretch" onClick={() => textareaRef.current?.focus()}>
        {textArea}
      </div>
      {uploadBtn}
      {attachmentThumb}
      {videoAttachmentThumb}
      {submitBtn}
      {modeToggles}
      {settingsDropdown}
    </div>
  );
}
