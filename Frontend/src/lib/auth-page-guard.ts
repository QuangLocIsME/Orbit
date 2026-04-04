export async function redirectIfAuthenticated(params: {
  accessToken?: string;
  backendUrl: string;
  redirect: (path: string) => Response;
  to?: string;
}): Promise<Response | null> {
  const { accessToken, backendUrl, redirect, to = '/home' } = params;

  if (!accessToken) return null;

  try {
    const res = await fetch(`${backendUrl}/api/auth/me`, {
      headers: {
        Cookie: `accessToken=${accessToken}`,
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (res.ok) return redirect(to);
  } catch {
    // keep user on current auth page
  }

  return null;
}
