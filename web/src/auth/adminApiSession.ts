/** Session-scoped bearer token. Never persist credentials or tokens in valuation records. */
const TOKEN_KEY = 'fixphone.admin.accessToken';

export function adminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = adminToken();
  if (!token) throw new Error('Iniciá sesión para acceder al valuador.');

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', 'Bearer ' + token);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  }
  return response;
}

export async function endAdminSession(): Promise<void> {
  const token = adminToken();
  try {
    if (token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
      });
    }
  } finally {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}
