/**
 * Credential hashing for the owner login (Web Crypto, PBKDF2-SHA256).
 *
 * The stored credential is `pbkdf2:<iterations>:<salt b64>:<hash b64>`, computed over
 * `<lowercased email>\n<password>`, so neither the email nor the password appears in
 * the shipped JavaScript. Generate one with `npm run owner:credential`.
 * scripts/owner-credential.mjs uses the same format; keep the two in step.
 */

const encoder = new TextEncoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const credentialInput = (email: string, password: string) => `${email.trim().toLowerCase()}\n${password}`;

async function derive(input: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(input), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashCredential(email: string, password: string, iterations = 210_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(credentialInput(email, password), salt, iterations);
  return `pbkdf2:${iterations}:${toB64(salt)}:${toB64(hash)}`;
}

/** Constant-time comparison of the derived hash with the stored one. */
export async function verifyCredential(stored: string, email: string, password: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split(':');
  const iterations = Number(iter);
  if (scheme !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1 || !saltB64 || !hashB64) return false;
  let expected: Uint8Array;
  let salt: Uint8Array;
  try {
    expected = fromB64(hashB64);
    salt = fromB64(saltB64);
  } catch {
    return false;
  }
  const actual = await derive(credentialInput(email, password), salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
