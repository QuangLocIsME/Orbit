export const prerender = false;

export async function POST({ request }) {
  const data = await request.json();
  // TODO: validate và lưu vào database
  return Response.json({
    success: true,
    message: "Account created successfully",
  });
}
