export const prerender = false;

export async function GET() {
  return Response.json([
    { id: 1, name: "Digital Products", projectCount: 5 },
    { id: 2, name: "Infrastructure", projectCount: 3 },
  ]);
}
