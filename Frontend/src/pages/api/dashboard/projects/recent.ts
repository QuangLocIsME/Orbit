export const prerender = false;

export async function GET() {
  return Response.json([
    { id: 1, name: "E-commerce Platform v2.0", description: "AI-powered shopping experience", image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnVpbGRpbmd8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60", status: "active", category: "software", progress: 68, members: 15, issues: 23, updatedAt: "1 hour ago" },
    { id: 2, name: "Mobile Banking App", description: "Secure financial management", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8YnVpbGRpbmd8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60", status: "active", category: "software", progress: 82, members: 12, issues: 8, updatedAt: "30 minutes ago" },
  ]);
}
