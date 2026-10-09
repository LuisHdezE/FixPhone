/**
 * FixPhone administrative API session.
 * Default: sessionStorage (tab-scoped). "Recordarme" explicitly opts into a
 * browser-shared token, with a bounded lifetime and logout/401 cleanup.
 * The Laravel API remains authoritative for validity and permissions.
 */
const SESSION_KEY = 'fixphone.admin.accessToken';
const REMEMBERED_KEY = 'fixphone.admin.rememberedAccessToken';
const REMEMBER_DURATION_MS = 12 * 60 * 60 * 1000;

interface RememberedToken {
  token: string;
  expiresAt: number;
}

function storedRememberedToken(): string | null {
  const raw = localStorage.getItem(REMEMBERED_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as RememberedToken;
    if (typeof session.token === 'string' &&
        session.token.length > 0 &&
        typeof session.expiresAt === 'number' &&
        Number.isFinite(session.expiresAt) &&
        session.expiresAt > Date.now()) {
      return session.token;
    }
  } catch {
    // Clear malformed/obsolete values rather than reusing them.
  }

  localStorage.removeItem(REMEMBERED_KEY);
  return null;
}

export function adminToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY) || storedRememberedToken();
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBERED_KEY);
}

export function setAdminToken(token: string, rememberMe: boolean = false): void {
  clearAdminToken();
  if (rememberMe) {
    const payload: RememberedToken = {
      token,
      expiresAt: Date.now() + REMEMBER_DURATION_MS,
    };
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(payload));
  } else {
    sessionStorage.setItem(SESSION_KEY, token);
  }
}

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = adminToken();
  if (!token) throw new Error('Iniciá sesión para acceder a la administración de FixPhone.');

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', 'Bearer ' + token);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    clearAdminToken();
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
    clearAdminToken();
  }
}
