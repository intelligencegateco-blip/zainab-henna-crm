import { Copy, KeyRound, MoreHorizontal, Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select } from '../../components/ui/Field';
import { ActionMenu, Avatar, Panel } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { useForm } from '../../hooks/useForm';
import { formatDateTime, errorMessage } from '../../lib/format';
import { assignableRoles, canManageUser, ROLE_LABEL, ROLES, type Role } from '../../lib/permissions';
import { authApi } from '../../services';
import type { UserAccount } from '../../services/authApi';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';

/** Admins and Owners manage who can sign in and what they can do. */
export function UsersPanel() {
  const { user: me, refresh: refreshMe } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<{ user: UserAccount; password: string; reset: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'disable' | 'reset'; user: UserAccount } | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await authApi.listUsers());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me) return null;
  const roleOptions = assignableRoles(me.role);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    } finally {
      await load();
      await refreshMe();
    }
  };

  const changeRole = (u: UserAccount, role: Role) =>
    act(() => authApi.updateUser(u.id, { role }), `${u.name} is now ${ROLE_LABEL[role]}`).catch(() => {});

  return (
    <>
      <Panel
        title="Users"
        subtitle={
          me.role === 'owner'
            ? 'Add people and choose what they can do. Owners can’t assign or change Admins.'
            : 'Add people and choose what they can do.'
        }
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
            Add user
          </Button>
        }
        flush
      >
        {error ? (
          <ErrorState title="Users couldn’t load" message={error} onRetry={() => void load()} />
        ) : !users ? (
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'grid', gap: 10 }}>
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Skeleton height={20} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState compact title="No users yet" />
        ) : (
          <div className="table-wrap">
            <table className="table users-table">
              <caption className="visually-hidden">Users</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const manageable = canManageUser(me, u);
                  const isMe = u.id === me.id;
                  return (
                    <tr key={u.id} data-testid={`user-${u.email}`}>
                      <td>
                        <div className="cell-person">
                          <Avatar name={u.name} />
                          <div>
                            <div className="cell-primary">
                              {u.name} {isMe && <span className="muted small">(you)</span>}
                            </div>
                            <div className="cell-sub">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {manageable ? (
                          <Select
                            aria-label={`Role for ${u.name}`}
                            className="role-select"
                            value={u.role}
                            options={ROLES.filter((r) => roleOptions.includes(r.value) || r.value === u.role).map((r) => ({
                              value: r.value,
                              label: r.label,
                            }))}
                            onChange={(e) => void changeRole(u, e.target.value as Role)}
                          />
                        ) : (
                          <Badge tone={u.role === 'admin' ? 'dark' : u.role === 'owner' ? 'gold' : 'neutral'} dot={false}>
                            {ROLE_LABEL[u.role]}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {!u.active ? (
                          <Badge tone="danger">Disabled</Badge>
                        ) : u.mustChangePassword ? (
                          <Badge tone="warn">Temporary password</Badge>
                        ) : (
                          <Badge tone="ok">Active</Badge>
                        )}
                      </td>
                      <td className="num small">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                      <td className="align-right">
                        {manageable && (
                          <ActionMenu
                            trigger={(t) => (
                              <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />} {...t}>
                                {`Actions for ${u.name}`}
                              </Button>
                            )}
                          >
                            {(close) => (
                              <>
                                <button role="menuitem" onClick={() => { close(); setEditingUser(u); }}>
                                  <Pencil /> Edit name or email
                                </button>
                                <button role="menuitem" onClick={() => { close(); setConfirm({ kind: 'reset', user: u }); }}>
                                  <KeyRound /> Reset password
                                </button>
                                {u.active ? (
                                  <button role="menuitem" onClick={() => { close(); setConfirm({ kind: 'disable', user: u }); }}>
                                    <UserX /> Disable sign-in
                                  </button>
                                ) : (
                                  <button
                                    role="menuitem"
                                    onClick={() => {
                                      close();
                                      void act(() => authApi.updateUser(u.id, { active: true }), `${u.name} can sign in again`).catch(() => {});
                                    }}
                                  >
                                    <UserCheck /> Enable sign-in
                                  </button>
                                )}
                                <hr />
                                <button role="menuitem" className="danger" onClick={() => { close(); setConfirm({ kind: 'delete', user: u }); }}>
                                  <Trash2 /> Delete user
                                </button>
                              </>
                            )}
                          </ActionMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="What each role can do" as="h3">
        <dl className="kv roles-kv">
          {ROLES.map((r) => (
            <div key={r.value} style={{ display: 'contents' }}>
              <dt>{r.label}</dt>
              <dd>{r.description}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {adding && (
        <AddUserModal
          roles={roleOptions}
          onClose={() => setAdding(false)}
          onCreated={async (user, password) => {
            setAdding(false);
            setIssued({ user, password, reset: false });
            toast.success(`${user.name} added`);
            await load();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={async (u) => {
            setEditingUser(null);
            toast.success(`${u.name} updated`);
            await load();
          }}
        />
      )}

      {issued && <TemporaryPasswordModal {...issued} onClose={() => setIssued(null)} />}

      <ConfirmDialog
        open={confirm?.kind === 'reset'}
        tone="primary"
        title={`Reset ${confirm?.user.name}’s password?`}
        message="Their current password stops working right away. You’ll get a temporary password to send them; they choose a new one when they sign in."
        confirmLabel="Reset password"
        onConfirm={async () => {
          if (!confirm) return;
          const u = confirm.user;
          try {
            const { temporaryPassword } = await authApi.resetPassword(u.id);
            setIssued({ user: u, password: temporaryPassword, reset: true });
            await load();
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'disable'}
        title={`Disable ${confirm?.user.name}?`}
        message="They’re signed out and can’t sign in until you enable them again. Their history stays."
        confirmLabel="Disable sign-in"
        onConfirm={() => (confirm ? act(() => authApi.updateUser(confirm.user.id, { active: false }), `${confirm.user.name} can no longer sign in`) : undefined)}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={`Delete ${confirm?.user.name}?`}
        message="This removes their account permanently. Customer records they created are kept. Disable the account instead if they might come back."
        confirmLabel="Delete user"
        onConfirm={() => (confirm ? act(() => authApi.deleteUser(confirm.user.id), `${confirm.user.name} deleted`) : undefined)}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function AddUserModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (user: UserAccount, password: string) => void;
}) {
  const form = useForm({ name: '', email: '', role: roles.includes('editor') ? 'editor' : roles[0] });
  const { bind, errors } = form;
  const save = () =>
    form.submit(async (v) => {
      const { user, temporaryPassword } = await authApi.createUser({ name: v.name, email: v.email, role: v.role as Role });
      onCreated(user, temporaryPassword);
    });
  return (
    <Modal
      open
      onClose={onClose}
      locked={form.submitting}
      title="Add user"
      description="They’ll get a temporary password to change at first sign-in."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={form.submitting}>
            Add user
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {form.formError && <div className="form-alert span-2">{form.formError}</div>}
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} {...bind('name')} autoComplete="off" />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} {...bind('email')} type="email" autoComplete="off" />}
        </Field>
        <Field label="Role" error={errors.role} className="span-2" hint={ROLES.find((r) => r.value === form.values.role)?.description}>
          {(p) => <Select {...p} {...bind('role')} options={ROLES.filter((r) => roles.includes(r.value))} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: UserAccount; onClose: () => void; onSaved: (u: UserAccount) => void }) {
  const form = useForm({ name: user.name, email: user.email });
  const { bind, errors } = form;
  const save = () => form.submit(async (v) => onSaved(await authApi.updateUser(user.id, { name: v.name, email: v.email })));
  return (
    <Modal
      open
      onClose={onClose}
      locked={form.submitting}
      size="sm"
      title={`Edit ${user.name}`}
      description="They sign in with the new email from now on."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={form.submitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {form.formError && <div className="form-alert span-2">{form.formError}</div>}
        <Field label="Name" error={errors.name} className="span-2">
          {(p) => <Input {...p} {...bind('name')} />}
        </Field>
        <Field label="Email" error={errors.email} className="span-2">
          {(p) => <Input {...p} {...bind('email')} type="email" />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function TemporaryPasswordModal({ user, password, reset, onClose }: { user: UserAccount; password: string; reset: boolean; onClose: () => void }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${user.email}\nTemporary password: ${password}`);
      toast.success('Copied');
    } catch {
      toast.error('Copy didn’t work here. Select the password and copy it by hand.');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={reset ? 'New temporary password' : 'User added'}
      description={`Send these details to ${user.name} privately (for example by WhatsApp). This password is shown only once.`}
      footer={
        <>
          <Button icon={<Copy />} onClick={() => void copy()}>
            Copy details
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <dl className="kv">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Role</dt>
        <dd>{ROLE_LABEL[user.role]}</dd>
        <dt>Temporary password</dt>
        <dd>
          <code className="temp-password" data-testid="temporary-password">
            {password}
          </code>
        </dd>
      </dl>
    </Modal>
  );
}
