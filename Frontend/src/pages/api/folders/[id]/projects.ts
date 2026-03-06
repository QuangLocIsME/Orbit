export const prerender = false;

const FOLDER_PROJECTS: Record<string, Array<{
  id: number;
  name: string;
  description: string;
  status: "active" | "review" | "planning";
  category: string;
  progress: number;
  members: number;
  issues: number;
  updatedAt: string;
}>> = {
  "1": [
    { id: 1, name: "E-commerce Platform v2.0", description: "AI-powered shopping experience", status: "active", category: "software", progress: 68, members: 15, issues: 23, updatedAt: "1 hour ago" },
    { id: 2, name: "Mobile Banking App", description: "Secure financial management", status: "active", category: "software", progress: 82, members: 12, issues: 8, updatedAt: "30 minutes ago" },
    { id: 3, name: "CRM System Integration", description: "Enterprise customer management", status: "review", category: "software", progress: 95, members: 6, issues: 2, updatedAt: "3 hours ago" },
    { id: 4, name: "UI/UX Design System", description: "Component library and tokens", status: "active", category: "design", progress: 72, members: 5, issues: 3, updatedAt: "2 hours ago" },
    { id: 5, name: "SaaS Dashboard Platform", description: "Analytics and reporting dashboard", status: "planning", category: "software", progress: 25, members: 8, issues: 7, updatedAt: "1 day ago" },
  ],
  "2": [
    { id: 6, name: "Metro Station - Phase 2", description: "Underground metro station construction", status: "active", category: "construction", progress: 75, members: 10, issues: 5, updatedAt: "2 hours ago" },
    { id: 7, name: "Office Complex Tower A", description: "High-rise office development", status: "planning", category: "construction", progress: 20, members: 4, issues: 12, updatedAt: "1 day ago" },
  ],
};

export async function GET({ params }) {
  const id = params.id;
  const projects = FOLDER_PROJECTS[id] ?? [];
  return Response.json(projects);
}
