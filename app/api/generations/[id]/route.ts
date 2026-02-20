import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { hasDatabase, sql } from "@/lib/db";
import { hasMixedbread, deleteFileFromStore } from "@/lib/mixedbread-store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!hasDatabase) {
    return Response.json({ error: "No database configured" }, { status: 501 });
  }

  const rows = await sql`
    DELETE FROM generations
    WHERE id = ${id}
    RETURNING mux_asset_id
  `;

  revalidateTag("explore", "max");
  revalidateTag("search", "max");
  revalidateTag(`explore-item-${id}`, "max");
  revalidateTag(`generation-${id}`, "max");

  const muxAssetId = rows[0]?.mux_asset_id as string | undefined;

  after(async () => {
    if (hasMixedbread) {
      try {
        await deleteFileFromStore(id);
      } catch (e) {
        console.error("[store] Delete error:", e);
      }
    }
    if (muxAssetId && process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
      try {
        const { default: Mux } = await import("@mux/mux-node");
        const mux = new Mux({
          tokenId: process.env.MUX_TOKEN_ID,
          tokenSecret: process.env.MUX_TOKEN_SECRET,
        });
        await mux.video.assets.delete(muxAssetId);
      } catch (e) {
        console.error("[mux] Asset delete error:", e);
      }
    }
  });

  return Response.json({ ok: true });
}
