export const prerender = false;

export async function GET() {
  return Response.json({
    user: { name: "Thao Duyen" },
    favorites: [
      { id: 1, name: "Metro Station - Phase 2" },
      { id: 2, name: "Office Complex Tower A" },
    ],
    shared: [
      { id: 3, name: "Residential Building" },
      { id: 4, name: "Shopping Mall Extension" },
    ],
    privateProjects: [
      { id: 5, name: "Hospital Renovation" },
      { id: 6, name: "School Campus" },
    ],
  });
}
