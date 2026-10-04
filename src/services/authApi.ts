import { env } from '../config/env';
import { nowISO } from '../lib/format';
import { assignableRoles, can, canManageUser, type Role } from '../lib/permissions';
import { ValidationError } from '../lib/validation';
import { request } from './httpRepository';
import { hashCredential, verifyCredential } from './password';
import type { KeyValueStore } from './localRepository';

/**
 * Sign-in and user management.
 *
 * HttpAuthApi talks to the PHP API (server-side sessions, roles enforced on the
 * server). LocalAuthApi mirrors the same rules in the browser for offline
 * development and tests (VITE_DATA_SOURCE=local); it is not access control.
 */

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export type AuthUser = UserAccount;

export interface NewUserInput {
  name: string;
  email: string;
  role: Role;
}

export interface UserPatch {
  name?: string;
  email?: string;
  role?: Role;
  active?: boolean;
}

export interface AuthApi {
  me(): Promise<AuthUser | null>;
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<AuthUser>;
  listUsers(): Promise<UserAccount[]>;
  createUser(input: NewUserInput): Promise<{ user: UserAccount; temporaryPassword: string }>;
  updateUser(id: string, patch: UserPatch): Promise<UserAccount>;
  resetPassword(id: string): Promise<{ temporaryPassword: string }>;
  deleteUser(id: string): Promise<void>;
}

export class HttpAuthApi implements AuthApi {
  private readonly base: string;
  constructor(base: string) {
    this.base = base;
  }
  async me() {
    return (await request<{ user: AuthUser | null }>(this.base, 'GET', '/auth/me')).user;
  }
  async login(email: string, password: string) {
    return (await request<{ user: AuthUser }>(this.base, 'POST', '/auth/login', { email, password }, { skipAuthEvent: true })).user;
  }
  async logout() {
    await request<void>(this.base, 'POST', '/auth/logout');
  }
  async changePassword(currentPassword: string, newPassword: string) {
    return (await request<{ user: AuthUser }>(this.base, 'POST', '/auth/password', { currentPassword, newPassword })).user;
  }
  listUsers() {
    return request<UserAccount[]>(this.base, 'GET', '/users');
  }
  createUser(input: NewUserInput) {
    return request<{ user: UserAccount; temporaryPassword: string }>(this.base, 'POST', '/users', input);
  }
  updateUser(id: string, patch: UserPatch) {
    return request<UserAccount>(this.base, 'PATCH', `/users/${encodeURIComponent(id)}`, patch);
  }
  resetPassword(id: string) {
    return request<{ temporaryPassword: string }>(this.base, 'POST', `/users/${encodeURIComponent(id)}/reset-password`);
  }
  async deleteUser(id: string) {
    await request<void>(this.base, 'DELETE', `/users/${encodeURIComponent(id)}`);
  }
}

// ---------------- Local (offline) implementation ----------------

interface StoredUser extends UserAccount {
  credential: string;
}

const USERS_KEY = 'zainab-crm:users:v1';
const SESSION_KEY = 'zainab-crm:session:v2';

const strip = ({ credential: _c, ...u }: StoredUser): UserAccount => u;

export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes]
    .map((b) => alphabet[b % alphabet.length])
    .join('')
    .match(/.{4}/g)!
    .join('-');
}

function fail(message: string, fields?: Record<string, string>): never {
  if (fields) throw new ValidationError({ _form: message, ...fields });
  throw new Error(message);
}

export class LocalAuthApi implements AuthApi {
  private readonly store: KeyValueStore;
  private readonly session: KeyValueStore;
  constructor(store: KeyValueStore = localStorage, session: KeyValueStore = sessionStorage) {
    this.store = store;
    this.session = session;
  }

  private async users(): Promise<StoredUser[]> {
    const raw = this.store.getItem(USERS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as StoredUser[];
      } catch {
        // fall through to re-seed
      }
    }
    // Seed: the demo account is an Admin with a known password (local development only).
    const ts = nowISO();
    const seeded: StoredUser[] = [
      {
        id: 'U-001',
        email: env.demoEmail.toLowerCase(),
        name: 'Zainab',
        role: 'admin',
        active: true,
        mustChangePassword: false,
        createdAt: ts,
        lastLoginAt: null,
        credential: await hashCredential(env.demoEmail, env.demoPassword, 10_000),
      },
    ];
    this.save(seeded);
    return seeded;
  }

  private save(users: StoredUser[]) {
    this.store.setItem(USERS_KEY, JSON.stringify(users));
  }

  private async actor(): Promise<StoredUser> {
    const id = this.session.getItem(SESSION_KEY);
    const u = (await this.users()).find((x) => x.id === id && x.active);
    if (!u) fail('Your session has ended. Sign in again.');
    return u;
  }

  private async manager(): Promise<StoredUser> {
    const a = await this.actor();
    if (!can(a.role, 'manageUsers')) fail('Only Admins and Owners can do that.');
    return a;
  }

  async me() {
    try {
      return strip(await this.actor());
    } catch {
      return null;
    }
  }

  async login(email: string, password: string) {
    const users = await this.users();
    const u = users.find((x) => x.email === email.trim().toLowerCase() && x.active);
    if (!u || !(await verifyCredential(u.credential, email, password))) {
      await new Promise((r) => setTimeout(r, 300));
      fail('That email and password don’t match. Check both and try again.');
    }
    u.lastLoginAt = nowISO();
    this.save(users);
    this.session.setItem(SESSION_KEY, u.id);
    return strip(u);
  }

  async logout() {
    this.session.removeItem(SESSION_KEY);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const users = await this.users();
    const me = await this.actor();
    const u = users.find((x) => x.id === me.id)!;
    if (!(await verifyCredential(u.credential, u.email, currentPassword))) {
      fail('Your current password is not correct.', { currentPassword: 'Your current password is not correct.' });
    }
    if (newPassword.length < 10) fail('Use at least 10 characters.', { newPassword: 'Use at least 10 characters.' });
    if (newPassword === currentPassword) fail('Choose a different password.', { newPassword: 'Choose a different password.' });
    u.credential = await hashCredential(u.email, newPassword, 10_000);
    u.mustChangePassword = false;
    this.save(users);
    return strip(u);
  }

  async listUsers() {
    await this.manager();
    return (await this.users()).map(strip);
  }

  async createUser(input: NewUserInput) {
    const actor = await this.manager();
    const users = await this.users();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (name.length < 2) fail('Enter a name', { name: 'Enter a name' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email', { email: 'Enter a valid email' });
    if (!assignableRoles(actor.role).includes(input.role)) fail('Owners can’t assign the Admin role.', { role: 'You can’t assign this role.' });
    if (users.some((u) => u.email === email)) fail('A user with that email already exists.', { email: 'Already in use' });
    const temporaryPassword = generatePassword();
    const max = users.reduce((m, u) => Math.max(m, Number(u.id.slice(2)) || 0), 0);
    const user: StoredUser = {
      id: `U-${String(max + 1).padStart(3, '0')}`,
      email,
      name,
      role: input.role,
      active: true,
      mustChangePassword: true,
      createdAt: nowISO(),
      lastLoginAt: null,
      credential: await hashCredential(email, temporaryPassword, 10_000),
    };
    users.push(user);
    this.save(users);
    return { user: strip(user), temporaryPassword };
  }

  async updateUser(id: string, patch: UserPatch) {
    const actor = await this.manager();
    const users = await this.users();
    const target = users.find((u) => u.id === id) ?? fail('That user was not found.');
    const changesAccess = (patch.role && patch.role !== target.role) || (patch.active !== undefined && patch.active !== target.active);
    if (actor.id === id && changesAccess) fail('You can’t change your own role or disable your own account.');
    if (actor.id !== id && !canManageUser(actor, target)) fail('Only Admins can change Admin accounts.');
    if (patch.role && patch.role !== target.role && !assignableRoles(actor.role).includes(patch.role)) fail('Owners can’t assign the Admin role.');
    const activeAdmins = users.filter((u) => u.role === 'admin' && u.active).length;
    if (target.role === 'admin' && target.active && activeAdmins <= 1 && ((patch.role && patch.role !== 'admin') || patch.active === false)) {
      fail('Keep at least one active Admin.');
    }
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email', { email: 'Enter a valid email' });
      if (users.some((u) => u.email === email && u.id !== id)) fail('A user with that email already exists.', { email: 'Already in use' });
      patch = { ...patch, email };
    }
    if (patch.name !== undefined && patch.name.trim().length < 2) fail('Enter a name', { name: 'Enter a name' });
    Object.assign(target, patch);
    this.save(users);
    return strip(target);
  }

  async resetPassword(id: string) {
    const actor = await this.manager();
    const users = await this.users();
    const target = users.find((u) => u.id === id) ?? fail('That user was not found.');
    if (!canManageUser(actor, target)) fail('Only Admins can change Admin accounts.');
    const temporaryPassword = generatePassword();
    target.credential = await hashCredential(target.email, temporaryPassword, 10_000);
    target.mustChangePassword = true;
    this.save(users);
    return { temporaryPassword };
  }

  async deleteUser(id: string) {
    const actor = await this.manager();
    const users = await this.users();
    const target = users.find((u) => u.id === id) ?? fail('That user was not found.');
    if (actor.id === id) fail('You can’t delete your own account.');
    if (!canManageUser(actor, target)) fail('Only Admins can change Admin accounts.');
    if (target.role === 'admin' && target.active && users.filter((u) => u.role === 'admin' && u.active).length <= 1) {
      fail('Keep at least one active Admin.');
    }
    this.save(users.filter((u) => u.id !== id));
  }
}
