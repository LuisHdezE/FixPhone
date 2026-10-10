import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ADMIN_REMEMBERED_KEY, ADMIN_SESSION_CHANGED, adminFetch, adminToken, clearAdminToken } from '@/auth/adminApiSession';
import { FixPhoneAdminShell } from '@/shell/FixPhoneAdminShell';

export interface AdminPrincipal {
  id: string;
  name: string;
  email: string;
  role: string | null;
  roles: string[];
  permissions: string[];
}

type SessionState =
  | { kind: 'checking' }
  | { kind: 'authenticated'; principal: AdminPrincipal }
  | { kind: 'unauthenticated' }
  | { kind: 'unavailable'; message: string };

function validPrincipal(value: unknown): value is AdminPrincipal {
  if (typeof value !== 'object' || value === null) return false;
  const principal = value as Partial<AdminPrincipal>;
  return typeof principal.id === 'string' &&
    typeof principal.name === 'string' &&
    typeof principal.email === 'string' &&
    Array.isArray(principal.roles) &&
    Array.isArray(principal.permissions);
}

export function AuthenticatedAdminShell() {
  const location = useLocation();
  const [session, setSession] = useState<SessionState>(() =>
    adminToken() ? { kind: 'checking' } : { kind: 'unauthenticated' },
  );
  const [attempt, setAttempt] = useState(0);

  const validate = useCallback(async (isCurrent: () => boolean) => {
    if (!adminToken()) {
      if (isCurrent()) setSession({ kind: 'unauthenticated' });
      return;
    }

    if (isCurrent()) setSession({ kind: 'checking' });
    try {
      // The API is authoritative: a token existing in browser storage does not
      // prove that it is valid, active, or attached to a real account.
      const response = await adminFetch('/api/v1/auth/me', { cache: 'no-store' });
      if (!isCurrent()) return;

      if (response.status === 404) {
        clearAdminToken();
        setSession({ kind: 'unauthenticated' });
        return;
      }
      if (!response.ok) {
        setSession({
          kind: 'unavailable',
          message: 'No se pudo comprobar la sesión administrativa (HTTP ' + response.status + ').',
        });
        return;
      }

      const body = await response.json() as { data?: unknown };
      if (!validPrincipal(body.data)) {
        setSession({ kind: 'unavailable', message: 'La API devolvió una identidad no válida. Reintentá en unos segundos.' });
        return;
      }
      setSession({ kind: 'authenticated', principal: body.data });
    } catch (error) {
      if (!isCurrent()) return;
      if (!adminToken()) {
        // adminFetch cleared an expired Bearer token after HTTP 401.
        setSession({ kind: 'unauthenticated' });
      } else {
        setSession({
          kind: 'unavailable',
          message: error instanceof Error ? error.message : 'No se pudo verificar la sesión.',
        });
      }
    }
  }, []);

  useEffect(() => {
    let current = true;
    void validate(() => current);
    return () => { current = false; };
  }, [attempt, validate]);

  useEffect(() => {
    const changed = () => setAttempt((value) => value + 1);
    const otherTabChanged = (event: StorageEvent) => {
      if (event.key === ADMIN_REMEMBERED_KEY || event.key === null) changed();
    };
    window.addEventListener(ADMIN_SESSION_CHANGED, changed);
    window.addEventListener('storage', otherTabChanged);
    return () => {
      window.removeEventListener(ADMIN_SESSION_CHANGED, changed);
      window.removeEventListener('storage', otherTabChanged);
    };
  }, []);

  if (session.kind === 'unauthenticated') {
    return <Navigate to="/authentication/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }

  if (session.kind === 'checking') {
    return <div className="grid min-h-dvh place-items-center bg-[var(--surface-page)] px-4 text-sm font-medium text-slate-600" role="status">
      Comprobando tu sesión de FixPhone…
    </div>;
  }

  if (session.kind === 'unavailable') {
    return <main className="grid min-h-dvh place-items-center bg-[var(--surface-page)] px-4">
      <div className="w-full max-w-lg rounded-lg border border-amber-200 bg-white p-5">
        <h1 className="text-base font-bold text-slate-900">No se pudo comprobar tu sesión</h1>
        <p className="mt-2 text-sm text-slate-700" role="alert">{session.message}</p>
        <p className="mt-2 text-xs text-slate-500">No se cerró tu sesión: puede ser un problema temporal de conexión.</p>
        <button type="button" className="mt-4 rounded-md bg-[var(--theme-primary)] px-4 py-2 text-xs font-semibold text-white" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar comprobación
        </button>
      </div>
    </main>;
  }

  return <FixPhoneAdminShell principal={session.principal} />;
}
