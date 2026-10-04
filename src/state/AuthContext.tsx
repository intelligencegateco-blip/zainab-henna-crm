import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { can, type Action } from '../lib/permissions';
import { authApi } from '../services';
import type { AuthUser } from '../services/authApi';
import { UNAUTHORIZED_EVENT } from '../services/httpRepository';

interface AuthState {
  /** 'loading' while the saved session is being checked with the server. */
  status: 'loading' | 'ready';
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Re-read the signed-in user (e.g. after an Admin edits your name). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch {
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    void refresh();
    // The server ended the session (expired, disabled account): go back to sign-in.
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await authApi.login(email, password));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setUser(await authApi.changePassword(currentPassword, newPassword));
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, changePassword, refresh }),
    [status, user, signIn, signOut, changePassword, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** What the signed-in user may do. Controls they can't use are hidden. */
export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() => {
    const allowed = (action: Action) => Boolean(user && !user.mustChangePassword && can(user.role, action));
    return { can: allowed, canWrite: allowed('write'), role: user?.role };
  }, [user]);
}
