import { readBody } from './_shopify.js';
import { createSessionToken, COOKIE_NAME, MAX_AGE_SECONDS } from '../session.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { password } = await readBody(req);
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const token = await createSessionToken();
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Strict`
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Strict`
    );
    res.setHeader('Location', '/login.html');
    return res.status(302).end();
  }

  res.status(405).end();
}
