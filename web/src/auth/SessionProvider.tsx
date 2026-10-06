import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { SessionContext } from '@/auth/session.context';
import type { SessionContextValue, SessionUser } from '@/auth/session.types';

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn: (displayName) => {
        const normalizedName = displayName.trim();

        if (!normalizedName) {
          throw new Error('A display name is required to start the demo session.');
        }

        setUser({ id: 'mock-user', displayName: normalizedName });
      },
      signOut: () => setUser(null),
    }),
    [user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
