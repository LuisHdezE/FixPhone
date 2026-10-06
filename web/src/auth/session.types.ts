export type SessionUser = {
  id: string;
  displayName: string;
};

export type SessionContextValue = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  signIn: (displayName: string) => void;
  signOut: () => void;
};
