import { Suspense } from "react";
import { preload } from "react-dom";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGeneration } from "@/lib/queries/generation";
import type { ExploreRow } from "@/lib/explore-queries";
import { getExploreManifest } from "@/lib/explore-queries";
import { StudioProvider } from "@/components/studio/studio-context";
import { LayoutProvider } from "@/components/studio/layout-context";
import { StudioShell } from "@/components/studio/studio-shell";
import type { GenerationSelectionType } from "@/components/studio/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getGeneration(id);

  if (!item) {
    return { title: "Not found — Grok Creative Studio" };
  }

  const title = item.prompt.length > 60
    ? item.prompt.slice(0, 57) + "…"
    : item.prompt;
  const description = `Created by ${item.user_name || "Anonymous"} on Grok Creative Studio`;
  const image = item.image_url || undefined;

  // Preload the LCP image — React Float API injects <link rel="preload">
  // into the HTML head so the browser starts fetching before Suspense resolves.
  if (image) {
    preload(image, { as: "image" });
  }

  return {
    title: `${title} — Grok Creative Studio`,
    description,
    openGraph: {
      title,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
      type: item.video_url ? "video.other" : "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function buildSelection(item: ExploreRow): NonNullable<GenerationSelectionType> {
  return {
    id: item.id,
    src: (item.video_url || item.image_url) as string,
    alt: item.prompt,
    isVideo: item.mode === "video" && !!item.video_url,
    userId: item.user_id,
    poster: item.mode === "video" ? (item.image_url || undefined) : undefined,
    aspectRatio: item.aspect_ratio,
  };
}

export default async function GenerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <StudioProvider
          initialSession={null}
          initialHistory={[]}
          initialPath="/generations"
        >
          <LayoutProvider>
            <StudioShell />
          </LayoutProvider>
        </StudioProvider>
      }
    >
      <DynamicContent params={params} />
    </Suspense>
  );
}

async function DynamicContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const [item, manifest] = await Promise.all([
    getGeneration(id),
    getExploreManifest(),
  ]);

  // If generation has media, show it
  if (item) {
    const initialSelection = buildSelection(item);

    return (
      <StudioProvider
        initialSession={null}
        initialHistory={[]}
        initialPath="/generations"
        initialGenerationSelection={initialSelection}
      >
        <LayoutProvider>
          <StudioShell initialExploreManifest={manifest} />
        </LayoutProvider>
      </StudioProvider>
    );
  }

  // No DB record — render shell anyway so client can load from sessionStorage
  return (
    <StudioProvider
      initialSession={null}
      initialHistory={[]}
      initialPath="/generations"
      initialScrollTarget={id}
    >
      <LayoutProvider>
        <StudioShell initialExploreManifest={manifest} />
      </LayoutProvider>
    </StudioProvider>
  );
}
