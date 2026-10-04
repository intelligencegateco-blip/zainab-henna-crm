import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

/** Fresh database: run first-time setup and keep the temporary passwords for the tests. */
export default async function globalSetup() {
  const api = 'http://127.0.0.1:8098/api';
  // The PHP server may have created tables on a previous run; start from an empty file.
  mkdirSync('.tmp', { recursive: true });
  rmSync('.tmp/e2e-api.sqlite', { force: true });
  const res = await fetch(`${api}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'zainab-crm', 'X-Setup-Token': 'local-test-setup-token' },
    body: JSON.stringify({
      users: [
        { name: 'Test Admin', email: 'admin@test.example', role: 'admin' },
        { name: 'Test Owner', email: 'owner@test.example', role: 'owner' },
        { name: 'Workflow Admin', email: 'e2e@test.example', role: 'admin' },
      ],
    }),
  });
  if (res.status !== 201) throw new Error(`Setup failed: ${res.status} ${await res.text()}`);
  const { users } = await res.json();
  // The workflow suite signs in as e2e@test.example with a fixed password.
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'zainab-crm' },
    body: JSON.stringify({ email: 'e2e@test.example', password: users[2].temporaryPassword }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  const changed = await fetch(`${api}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'zainab-crm', Cookie: cookie },
    body: JSON.stringify({ currentPassword: users[2].temporaryPassword, newPassword: 'Workflow-pass-2026' }),
  });
  if (!changed.ok) throw new Error(`Workflow admin setup failed: ${changed.status} ${await changed.text()}`);
  writeFileSync(
    '.tmp/e2e-api-users.json',
    JSON.stringify({ admin: users[0].temporaryPassword, owner: users[1].temporaryPassword }),
  );
}
