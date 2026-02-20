import { Suspense } from "react";
import type { Metadata } from "next";
import { after, connection } from "next/server";
import { getExploreManifest, getSearchResults } from "@/lib/explore-queries";
import { StudioProvider } from "@/components/studio/studio-context";
import { LayoutProvider } from "@/components/studio/layout-context";
import { StudioShell } from "@/components/studio/studio-shell";
import { DataInjector } from "@/components/studio/data-injector";
import { preloadFromCompact } from "@/lib/preload-images";
import { warmFromCompact } from "@/lib/warm-image-cache";

export const metadata: Metadata = {
  title: "Explore — Grok Creative Studio",
  description: "Browse AI-generated images and videos created by the community.",
};

export default async function ExplorePage_({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const manifest = await getExploreManifest();
  preloadFromCompact(manifest.items);
  after(() => warmFromCompact(manifest.items));

  return (
    <StudioProvider
      initialSession={null}
      initialHistory={[]}
      initialPath="/explore"
    >
      <LayoutProvider>
        <StudioShell initialExploreManifest={manifest} />
      </LayoutProvider>
      <Suspense fallback={null}>
        <DynamicData searchParams={searchParams} />
      </Suspense>
    </StudioProvider>
  );
}

async function DynamicData({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const query = params?.q?.trim() || "";

  const searchResults = query ? await getSearchResults(query) : null;

  return (
    <DataInjector
      history={[]}
      searchQuery={query}
      searchResults={searchResults}
    />
  );
}
