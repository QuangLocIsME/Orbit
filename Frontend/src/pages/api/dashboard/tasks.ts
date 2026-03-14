export const prerender = false;

export async function GET() {
  return Response.json([
    {
      id: 1,
      title: "Update floor plans",
      project: "Office Complex",
      due: "Tomorrow",
      priority: "High",
    },
    {
      id: 2,
      title: "Clash detection report",
      project: "Residential Building",
      due: "Dec 15",
      priority: "Medium",
    },
    {
      id: 3,
      title: "Review structural calculations",
      project: "Metro Station",
      due: "Today",
      priority: "Low",
    },
  ]);
}
