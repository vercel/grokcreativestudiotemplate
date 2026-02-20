import { Suspense } from "react";
import { preload } from "react-dom";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getExploreManifest, getExploreItem } from "@/lib/explore-queries";
import type { ExploreRow } from "@/lib/explore-queries";
import type { CompactManifest } from "@/lib/compact-manifest";
import { StudioProvider } from "@/components/studio/studio-context";
import { LayoutProvider } from "@/components/studio/layout-context";
import { StudioShell } from "@/components/studio/studio-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getExploreItem(id);

  if (!item) {
    return { title: "Not found — Grok Creative Studio" };
  }

  const title = item.prompt.length > 60
    ? item.prompt.slice(0, 57) + "…"
    : item.prompt;
  const description = `Created by ${item.user_name || "Anonymous"} on Grok Creative Studio`;
  const image = item.image_url || undefined;

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

function buildSelection(item: ExploreRow & { blurDataURL?: string }) {
  return {
    id: `explore-${item.id}`,
    src: (item.video_url || item.image_url) as string,
    alt: item.prompt,
    isVideo: item.mode === "video" && !!item.video_url,
    userId: item.user_id,
    poster: item.image_url || undefined,
  };
}

export default async function ExploreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const manifest = await getExploreManifest();

  return (
    <Suspense
      fallback={
        <StudioProvider
          initialSession={null}
          initialHistory={[]}
          initialPath="/explore"
        >
          <LayoutProvider>
            <StudioShell initialExploreManifest={manifest} />
          </LayoutProvider>
        </StudioProvider>
      }
    >
      <DynamicContent params={params} manifest={manifest} />
    </Suspense>
  );
}

async function DynamicContent({
  params,
  manifest,
}: {
  params: Promise<{ id: string }>;
  manifest: CompactManifest;
}) {
  await connection();
  const { id } = await params;

  const item = await getExploreItem(id);
  if (!item) notFound();

  const initialSelection = buildSelection(item);

  return (
    <StudioProvider
      initialSession={null}
      initialHistory={[]}
      initialPath="/explore"
      initialExploreSelection={initialSelection}
    >
      <LayoutProvider>
        <StudioShell initialExploreManifest={manifest} />
      </LayoutProvider>
    </StudioProvider>
  );
}
