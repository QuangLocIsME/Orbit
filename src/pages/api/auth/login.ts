export const prerender = false;

export async function POST({ request }) {
  const { username, password } = await request.json();
  // TODO: validate và kết nối backend thật
  return Response.json({
    token: "demo-token",
    user: { username },
  });
}
