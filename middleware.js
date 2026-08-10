import { verifySessionToken, COOKIE_NAME } from './session.js';

export const config = { matcher: '/:path*' };

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  // Always allow the login page, auth endpoint, and public assets
  if (pathname === '/login.html' || pathname.startsWith('/api/auth')) return;
  if (/\.(ico|png|jpg|svg|css|woff2?)$/.test(pathname)) return;

  const cookies = request.headers.get('cookie') || '';
  const token   = cookies.split(';').map(c => c.trim())
    .find(c => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(`${COOKIE_NAME}=`.length);

  if (await verifySessionToken(token)) return;

  const loginUrl = new URL('/login.html', request.url);
  return Response.redirect(loginUrl, 302);
}
