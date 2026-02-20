"use client";

import { useStudioState, useStudioActions, useStudioSelection } from "../studio-context";
import { ItemDetailContent } from "./item-detail-content";

export function ExploreSelectionView() {
  const { user } = useStudioState();
  const { exploreSelection } = useStudioSelection();
  const {
    closeExploreSelection,
    setLightbox,
    handleEditExplore,
    handleDownloadExplore,
    handleDeleteExplore,
  } = useStudioActions();

  if (!exploreSelection) return null;

  const isOwner = !!user?.id && user.id === exploreSelection.userId;

  return (
    <ItemDetailContent
      item={exploreSelection}
      isOwner={isOwner}
      onClose={closeExploreSelection}
      onEdit={() => handleEditExplore(exploreSelection)}
      onDownload={() => handleDownloadExplore(exploreSelection)}
      onDelete={isOwner ? () => handleDeleteExplore(exploreSelection) : undefined}
      onLightbox={setLightbox}
      showMobileBack
      downloadLabel="Download"
    />
  );
}
