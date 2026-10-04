import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { hashCredential, verifyCredential } from '../../src/services/password';

describe('owner credential', () => {
  it('verifies the right email + password and rejects anything else', async () => {
    const stored = await hashCredential('Owner@Example.com', 'correct horse battery', 1000);
    expect(stored).toMatch(/^pbkdf2:1000:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(await verifyCredential(stored, ' owner@example.com ', 'correct horse battery')).toBe(true);
    expect(await verifyCredential(stored, 'owner@example.com', 'wrong')).toBe(false);
    expect(await verifyCredential(stored, 'someone@example.com', 'correct horse battery')).toBe(false);
    expect(await verifyCredential('garbage', 'owner@example.com', 'correct horse battery')).toBe(false);
  });

  it('the CLI script produces credentials the app accepts', async () => {
    const out = execFileSync('node', ['scripts/owner-credential.mjs', 'me@example.com'], {
      env: { ...process.env, OWNER_CREDENTIAL_ONLY: '1' },
    }).toString();
    const { password, credential } = JSON.parse(out);
    expect(password).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);
    expect(credential).not.toContain('me@example.com');
    expect(await verifyCredential(credential, 'me@example.com', password)).toBe(true);
    expect(await verifyCredential(credential, 'me@example.com', password + 'x')).toBe(false);
  });
});
