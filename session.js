export const COOKIE_NAME = 'scc_admin';
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function getKey() {
  const secret = process.env.ADMIN_PASSWORD || '';
  const material = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`scc-shop-admin-session:${secret}`)
  );
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(expiry) {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(expiry)));
  return `${expiry}.${toBase64Url(sig)}`;
}

// Opaque, HMAC-signed session token — the cookie value never encodes the
// password itself, so leaking it doesn't leak the admin password.
export async function createSessionToken() {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  return sign(expiry);
}

export async function verifySessionToken(token) {
  if (!token) return false;
  const [expiryStr, sig] = token.split('.');
  const expiry = Number(expiryStr);
  if (!expiry || !sig || Date.now() > expiry) return false;
  const expected = await sign(expiry);
  return timingSafeEqual(expected, `${expiryStr}.${sig}`);
}
