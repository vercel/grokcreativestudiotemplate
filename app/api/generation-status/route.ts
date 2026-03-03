export const dynamic = "force-dynamic";

export function GET() {
  const enabled = !!process.env.AI_GATEWAY_API_KEY;
  return Response.json({ generationEnabled: enabled });
}
