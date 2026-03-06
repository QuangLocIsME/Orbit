export const prerender = false;

export async function GET({ params }) {
  const { projectId } = params;

  // Simple demo/mock response — adapt to your real backend
  const project = {
    projectId,
    projectName: "Metro Station - Phase 2",
    description: "Underground metro station construction with integrated transport hub",
    status: "Active",
    progress: 75,
    startDate: "Jan 15, 2024",
    deadline: "Dec 15, 2025",
    documentsCount: 48,
    versionsCount: 124,
    membersCount: 12,
    openClashes: 5,
    coverImage: "/images/sample.jpg",
    updated: "Last updated 2 hours ago",
    members: [
      { id: 1, name: "Minh Anh", role: "Project Manager", color: "#ff2056", initials: "MA", online: true },
      { id: 2, name: "Hoàng Nam", role: "Lead Architect", color: "#615fff", initials: "HN", online: true },
      { id: 3, name: "Thu Trang", role: "Structural Engineer", color: "#00bc7d", initials: "TT" },
      { id: 4, name: "Tuấn Kiệt", role: "MEP Engineer", color: "#fe9a00", initials: "TK" },
    ],
    activities: [
      { id: 1, title: "Version 3.2 approved", meta: "Minh Anh • 2 hours ago", bg: "#ecfdf5" },
      { id: 2, title: "New clash detected", meta: "System • 3 hours ago", bg: "#fff1f2" },
      { id: 3, title: "Document uploaded", meta: "Thu Trang • 5 hours ago", bg: "#f0f9ff" },
      { id: 4, title: "Change request submitted", meta: "Tuấn Kiệt • 1 day ago", bg: "#fffbeb" },
    ],
    milestones: [
      { id: 1, title: "Foundation Complete", date: "Jan 15, 2024", status: "completed", statusLabel: "completed", dotColor: "#00c950" },
      { id: 2, title: "Structural Framing", date: "Apr 20, 2024", status: "in-progress", statusLabel: "in-progress", dotColor: "#2b7fff" },
      { id: 3, title: "MEP Installation", date: "Jul 30, 2024", status: "upcoming", statusLabel: "upcoming", dotColor: "#d1d5dc" },
      { id: 4, title: "Final Inspection", date: "Dec 15, 2025", status: "upcoming", statusLabel: "upcoming", dotColor: "#d1d5dc" },
    ],
    tasksOverview: { todo: 8, inProgress: 12, review: 5, done: 34 },
  };

  return Response.json(project);
}
