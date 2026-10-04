#!/usr/bin/env node
/**
 * Generate the owner sign-in credential for VITE_OWNER_CREDENTIAL.
 *
 *   npm run owner:credential -- you@example.com            # generates a strong password
 *   npm run owner:credential -- you@example.com "my pass"  # uses your password
 *
 * Prints the password (once) and the value to put in .env.production.local.
 * Same format as src/services/password.ts.
 */
import { webcrypto as crypto } from 'node:crypto';

const [email, givenPassword] = process.argv.slice(2);
if (!email || !email.includes('@')) {
  console.error('Usage: npm run owner:credential -- <email> [password]');
  process.exit(1);
}

const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{4}/g).join('-');
}

const password = givenPassword ?? generatePassword();
if (password.length < 10) {
  console.error('Use a password of at least 10 characters.');
  process.exit(1);
}

const iterations = 210000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${email.trim().toLowerCase()}\n${password}`), 'PBKDF2', false, ['deriveBits']);
const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
const b64 = (u) => Buffer.from(u).toString('base64');
const credential = `pbkdf2:${iterations}:${b64(salt)}:${b64(bits)}`;

if (process.env.OWNER_CREDENTIAL_ONLY) {
  // Machine-readable mode used by tests and scripts.
  console.log(JSON.stringify({ password, credential }));
} else {
  console.log(`Owner email:    ${email}`);
  if (!givenPassword) console.log(`New password:   ${password}   (save it now; it is not stored anywhere)`);
  console.log(`\nAdd this line to .env.production.local (or .env.local), then rebuild:\n`);
  console.log(`VITE_OWNER_CREDENTIAL='${credential}'`);
}
