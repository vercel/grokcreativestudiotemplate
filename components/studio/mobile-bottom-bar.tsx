"use client";

import { PromptInput } from "@/components/prompt-input";
import { useStudioState, useStudioActions } from "./studio-context";

export function MobileBottomBar() {
  const { prompt, aspectRatio, mode, duration, attachment, videoAttachment } =
    useStudioState();
  const {
    setPrompt,
    setAspectRatio,
    setMode,
    setDuration,
    setAttachment,
    setVideoAttachment,
    generate,
  } = useStudioActions();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden">
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={generate}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        mode={mode}
        onModeChange={setMode}
        duration={duration}
        onDurationChange={setDuration}
        attachment={attachment}
        onAttachmentChange={setAttachment}
        videoAttachment={videoAttachment}
        onVideoAttachmentChange={setVideoAttachment}
        variant="stacked"
      />
    </div>
  );
}
