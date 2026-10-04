/**
 * Roles and what they allow. The server (api/lib/auth.php) enforces the same
 * rules; the UI uses these to hide controls a user can't use.
 */
export type Role = 'admin' | 'owner' | 'editor' | 'viewer';
export type Action = 'read' | 'write' | 'settings' | 'manageUsers' | 'resetData';

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Everything, including assigning Admins' },
  { value: 'owner', label: 'Owner', description: 'Everything except assigning or changing Admins' },
  { value: 'editor', label: 'Edit / Write', description: 'Add and change customers, bookings and services' },
  { value: 'viewer', label: 'View / Read-only', description: 'See everything, change nothing' },
];

export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label])) as Record<Role, string>;

export function can(role: Role | undefined, action: Action): boolean {
  if (!role) return false;
  switch (action) {
    case 'read':
      return true;
    case 'write':
      return role === 'admin' || role === 'owner' || role === 'editor';
    case 'settings':
    case 'manageUsers':
    case 'resetData':
      return role === 'admin' || role === 'owner';
  }
}

export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === 'admin') return ['admin', 'owner', 'editor', 'viewer'];
  if (actorRole === 'owner') return ['owner', 'editor', 'viewer'];
  return [];
}

/** Whether `actor` may change or remove `target`. Nobody manages their own access. */
export function canManageUser(actor: { id: string; role: Role }, target: { id: string; role: Role }): boolean {
  if (actor.id === target.id || !can(actor.role, 'manageUsers')) return false;
  return actor.role === 'admin' || target.role !== 'admin';
}
