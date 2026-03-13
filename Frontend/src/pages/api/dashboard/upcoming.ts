export const prerender = false;

export async function GET() {
  return Response.json([
    {
      id: 1,
      title: "Design Review Meeting",
      time: "Today, 2:00 PM",
      project: "Metro Station",
      participants: 8,
    },
    {
      id: 2,
      title: "Client Presentation",
      time: "Tomorrow, 10:00 AM",
      project: "Metro Station",
      participants: 6,
    },
    {
      id: 3,
      title: "Coordination Meeting",
      time: "Dec 12, 3:00 PM",
      project: "Metro Station",
      participants: 5,
    },
  ]);
}
