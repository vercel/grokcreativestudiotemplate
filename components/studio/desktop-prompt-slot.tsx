"use client";

import { PromptInput } from "@/components/prompt-input";
import { useStudioState, useStudioActions } from "./studio-context";

export function DesktopPromptSlot() {
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
    <div className="hidden min-w-0 flex-1 md:block">
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
      />
    </div>
  );
}
