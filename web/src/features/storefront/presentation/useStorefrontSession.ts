import { useContext } from 'react';
import { StorefrontSessionContext } from './storefrontSession.context';

export function useStorefrontSession() {
  const value = useContext(StorefrontSessionContext);
  if (!value) throw new Error('useStorefrontSession must be used inside StorefrontSessionProvider.');
  return value;
}
