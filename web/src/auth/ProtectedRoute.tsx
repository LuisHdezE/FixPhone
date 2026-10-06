import { Navigate, useLocation } from 'react-router';
import type { PropsWithChildren } from 'react';
import { useSession } from '@/auth/useSession';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthenticated } = useSession();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
