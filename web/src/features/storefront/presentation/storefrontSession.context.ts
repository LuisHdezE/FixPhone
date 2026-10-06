import { createContext } from 'react';
import type { StorefrontCustomerSession } from '../application/storefront.session';

export interface StorefrontSessionContextValue {
  customer: StorefrontCustomerSession | null;
  signIn: (customer: StorefrontCustomerSession) => void;
  signOut: () => void;
}

export const StorefrontSessionContext = createContext<StorefrontSessionContextValue | undefined>(undefined);
