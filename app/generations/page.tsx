import type { Metadata } from "next";
import { getExploreManifest } from "@/lib/explore-queries";
import { StudioProvider } from "@/components/studio/studio-context";
import { LayoutProvider } from "@/components/studio/layout-context";
import { StudioShell } from "@/components/studio/studio-shell";

export const metadata: Metadata = {
  title: "My Work — Grok Creative Studio",
  description: "Your AI-generated images and videos.",
};

export default async function Page() {
  const manifest = await getExploreManifest();

  return (
    <StudioProvider
      initialSession={null}
      initialHistory={[]}
      initialPath="/generations"
    >
      <LayoutProvider>
        <StudioShell initialExploreManifest={manifest} />
      </LayoutProvider>
    </StudioProvider>
  );
}
