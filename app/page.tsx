import { getExploreManifest } from "@/lib/explore-queries";
import { StudioProvider } from "@/components/studio/studio-context";
import { LayoutProvider } from "@/components/studio/layout-context";
import { StudioShell } from "@/components/studio/studio-shell";
import { preloadFromCompact } from "@/lib/preload-images";

export default async function Page() {
  const manifest = await getExploreManifest();
  preloadFromCompact(manifest.items);

  return (
    <StudioProvider
      initialSession={null}
      initialHistory={[]}
      initialPath="/"
    >
      <LayoutProvider>
        <StudioShell initialExploreManifest={manifest} />
      </LayoutProvider>
    </StudioProvider>
  );
}
