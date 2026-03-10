export const prerender = false;

export async function GET() {
  return Response.json([
    {
      id: 1,
      name: "Metro Station - Phase 2",
      description: "Underground metro station construction",
      image: "https://picsum.photos/400/200",
      status: "Active",
      progress: 75,
    },
    {
      id: 2,
      name: "Office Complex Tower A",
      description: "High-rise office development",
      image: "https://picsum.photos/400/300",
      status: "Planning",
      progress: 20,
    },
  ]);
}
