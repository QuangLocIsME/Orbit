async function redirectIfAuthenticated(params) {
  const { accessToken, backendUrl, redirect, to = "/home" } = params;
  if (!accessToken) return null;
  try {
    const res = await fetch(`${backendUrl}/api/auth/me`, {
      headers: {
        Cookie: `accessToken=${accessToken}`,
        Accept: "application/json"
      },
      credentials: "include"
    });
    if (res.ok) return redirect(to);
  } catch {
  }
  return null;
}

export { redirectIfAuthenticated as r };
