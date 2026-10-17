import { createContext } from 'react';
import type { StoreCustomer, StoreCredentials } from '../infrastructure/storefrontApi';

export interface StorefrontSessionContextValue {
  customer: StoreCustomer | null;
  loading: boolean;
  sessionError: string;
  signIn: (mode: 'sign-in' | 'register', credentials: StoreCredentials) => Promise<void>;
  signOut: () => Promise<void>;
}
export const StorefrontSessionContext = createContext<StorefrontSessionContextValue | undefined>(undefined);
