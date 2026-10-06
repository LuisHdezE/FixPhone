import { createContext } from 'react';
import type { SessionContextValue } from '@/auth/session.types';

export const SessionContext = createContext<SessionContextValue | null>(null);
