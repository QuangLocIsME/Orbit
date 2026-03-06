export const prerender = false;

export async function GET() {
  return Response.json([
    { id: 1, name: "Metro Station - Phase 2", updatedAt: "2026-02-26" },
    { id: 2, name: "Office Complex Tower A", updatedAt: "2026-02-25" },
  ]);
}
