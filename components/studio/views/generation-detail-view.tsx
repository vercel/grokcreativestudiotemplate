"use client";

import { useStudioState, useStudioActions, useStudioSelection } from "../studio-context";
import { ItemDetailContent } from "./item-detail-content";
import { downloadOrOpen } from "@/lib/utils";

export function GenerationDetailView() {
  const { user } = useStudioState();
  const { generationSelection } = useStudioSelection();
  const {
    closeGenerationSelection,
    setLightbox,
    setMode,
    setPrompt,
    setAttachment,
    setVideoAttachment,
    deleteItem,
    toBase64Attachment,
  } = useStudioActions();

  if (!generationSelection) return null;

  const isOwner = !!user?.id && user.id === generationSelection.userId;

  const handleEdit = () => {
    if (generationSelection.isVideo) {
      setVideoAttachment(generationSelection.src);
      setMode("video");
      setPrompt("");
    } else {
      setMode("image");
      setPrompt("");
      toBase64Attachment(generationSelection.src).then((b64) => {
        if (b64) setAttachment(b64);
      });
    }
  };

  const handleDownload = () => {
    const ext = generationSelection.isVideo ? "mp4" : "png";
    downloadOrOpen(generationSelection.src, `grok-${generationSelection.id.slice(0, 8)}.${ext}`);
  };

  const handleDelete = () => {
    const id = generationSelection.id;
    closeGenerationSelection();
    deleteItem(id);
  };

  return (
    <ItemDetailContent
      item={generationSelection}
      isOwner={isOwner}
      onClose={closeGenerationSelection}
      onEdit={handleEdit}
      onDownload={handleDownload}
      onDelete={isOwner ? handleDelete : undefined}
      onLightbox={setLightbox}
      downloadLabel="Download"
    />
  );
}
