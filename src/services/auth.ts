import { env } from '../config/env';
import { verifyCredential } from './password';

/**
 * Sign-in for the MVP, entirely in the browser.
 *
 * - Owner account: email + password checked against the PBKDF2 hash in
 *   VITE_OWNER_CREDENTIAL (create it with `npm run owner:credential`).
 * - Demo account: the shared demo login, for local development. Disable it on
 *   public builds with VITE_ENABLE_DEMO_LOGIN=false.
 *
 * This keeps casual visitors out but is not server-grade security: the session
 * lives in sessionStorage. Replace `signIn` with a call to a real auth backend
 * (e.g. POST /auth/login) when one exists; the rest of the app only uses this API.
 */
export type Role = 'owner' | 'demo';

export interface AuthUser {
  email: string;
  name: string;
  role: Role;
}

const SESSION_KEY = 'zainab-crm:session';

function readSession(): { token: string; user: AuthUser } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    // Sessions from before roles existed are treated as signed out.
    return parsed?.user?.role ? parsed : null;
  } catch {
    return null;
  }
}

const INVALID = 'That email and password don’t match. Check both and try again.';

export const authService = {
  currentUser(): AuthUser | null {
    return readSession()?.user ?? null;
  },

  getToken(): string | null {
    return readSession()?.token ?? null;
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const normalized = email.trim().toLowerCase();
    let user: AuthUser | null = null;

    if (env.ownerCredential && (await verifyCredential(env.ownerCredential, normalized, password))) {
      user = { email: normalized, name: env.ownerName, role: 'owner' };
    } else if (env.demoLoginEnabled && normalized === env.demoEmail.toLowerCase() && password === env.demoPassword) {
      user = { email: env.demoEmail, name: 'Zainab', role: 'demo' };
    }

    if (!user) {
      // Small fixed delay so failed attempts all take the same time.
      await new Promise((r) => setTimeout(r, 400));
      throw new Error(INVALID);
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: `${user.role}-${Date.now()}`, user }));
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
