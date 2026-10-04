import { env } from '../config/env';

/**
 * Placeholder authentication for the MVP.
 *
 * Accepts the demo credentials from env and keeps a session token in
 * sessionStorage. Replace `signIn` with a call to the real auth provider
 * (e.g. POST /auth/login, Supabase, Auth0) — the rest of the app only uses
 * this interface.
 */
export interface AuthUser {
  email: string;
  name: string;
}

const SESSION_KEY = 'zainab-crm:session';

function readSession(): { token: string; user: AuthUser } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const authService = {
  currentUser(): AuthUser | null {
    return readSession()?.user ?? null;
  },

  getToken(): string | null {
    return readSession()?.token ?? null;
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    await new Promise((r) => setTimeout(r, 300));
    const ok = email.trim().toLowerCase() === env.demoEmail.toLowerCase() && password === env.demoPassword;
    if (!ok) throw new Error('That email and password don’t match. Check both and try again.');
    const user: AuthUser = { email: env.demoEmail, name: 'Zainab' };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: `demo-${Date.now()}`, user }));
    } catch {
      // Private mode: session lasts only until reload.
    }
    return user;
  },

  signOut() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  },
};
