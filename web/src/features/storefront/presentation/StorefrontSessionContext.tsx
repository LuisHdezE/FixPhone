import { useMemo, useState, type ReactNode } from 'react';
import type { StorefrontCustomerSession } from '../application/storefront.session';
import { StorefrontSessionContext, type StorefrontSessionContextValue } from './storefrontSession.context';

export function StorefrontSessionProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<StorefrontCustomerSession | null>(null);

  const value = useMemo<StorefrontSessionContextValue>(() => ({
    customer,
    signIn: setCustomer,
    signOut: () => setCustomer(null),
  }), [customer]);

  return <StorefrontSessionContext.Provider value={value}>{children}</StorefrontSessionContext.Provider>;
}
