import { readBody } from './_shopify.js';

const COOKIE_NAME = 'scc_admin';
const MAX_AGE     = 60 * 60 * 24 * 7; // 7 days

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { password } = await readBody(req);
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const token = Buffer.from(process.env.ADMIN_PASSWORD).toString('base64');
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict`
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`
    );
    res.setHeader('Location', '/login.html');
    return res.status(302).end();
  }

  res.status(405).end();
}
