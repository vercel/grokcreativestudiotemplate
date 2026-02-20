"use client";

import dynamic from "next/dynamic";
import { useStudioState, useStudioActions } from "./studio-context";

const Lightbox = dynamic(
  () => import("@/components/lightbox").then((m) => m.Lightbox),
  { ssr: false },
);

export function LightboxPortal() {
  const { lightbox } = useStudioState();
  const { setLightbox } = useStudioActions();

  if (!lightbox) return null;

  return (
    <Lightbox
      src={lightbox.src}
      alt={lightbox.alt}
      onClose={() => setLightbox(null)}
    />
  );
}
