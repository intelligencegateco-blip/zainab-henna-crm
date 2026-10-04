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
});
