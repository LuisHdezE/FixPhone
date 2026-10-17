import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ADMIN_REMEMBERED_KEY, ADMIN_SESSION_CHANGED, adminFetch, adminToken, clearAdminToken, endAdminSession, setAdminToken } from '@/auth/adminApiSession';
import { authenticateStore, readStoreResponse, type StoreCustomer } from '../infrastructure/storefrontApi';
import { StorefrontSessionContext, type StorefrontSessionContextValue } from './storefrontSession.context';

export function StorefrontSessionProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => { setCustomer(null); setLoading(true); setRevision(value => value + 1); };
    const storage = (event: StorageEvent) => { if (event.key === ADMIN_REMEMBERED_KEY || event.key === null) changed(); };
    window.addEventListener(ADMIN_SESSION_CHANGED, changed);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(ADMIN_SESSION_CHANGED, changed); window.removeEventListener('storage', storage); };
  }, []);
  useEffect(() => {
    let active = true;
    setSessionError('');
    if (!adminToken()) { setCustomer(null); setLoading(false); return; }
    adminFetch('/api/v1/auth/me', { cache: 'no-store' }).then(async response => {
      if (response.status === 404) { clearAdminToken(); return null; }
      return readStoreResponse<StoreCustomer>(response);
    }).then(principal => { if (active) setCustomer(principal); })
      .catch(() => { if (active) { setCustomer(null); setSessionError('No se pudo verificar tu sesión. Volvé a iniciar sesión para usar el carrito.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const signIn = useCallback<StorefrontSessionContextValue['signIn']>(async (mode, credentials) => {
    const result = await authenticateStore(mode, credentials);
    setAdminToken(result.access_token, true);
    setCustomer(result.user);
    setSessionError('');
    setLoading(false);
  }, []);
  const signOut = useCallback(async () => { await endAdminSession(); setCustomer(null); }, []);
  const value = useMemo(() => ({ customer, loading, sessionError, signIn, signOut }), [customer, loading, sessionError, signIn, signOut]);
  return <StorefrontSessionContext.Provider value={value}>{children}</StorefrontSessionContext.Provider>;
}
