export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const { pathname } = new URL(request.url);

  // Always allow the login page, auth endpoint, and public assets
  if (pathname === '/login.html' || pathname.startsWith('/api/auth')) return;
  if (/\.(ico|png|jpg|svg|css|woff2?)$/.test(pathname)) return;

  const cookies  = request.headers.get('cookie') || '';
  const token    = cookies.split(';').map(c => c.trim())
    .find(c => c.startsWith('scc_admin='))
    ?.slice('scc_admin='.length);
  const expected = btoa(process.env.ADMIN_PASSWORD || '');

  if (token === expected) return;

  const loginUrl = new URL('/login.html', request.url);
  return Response.redirect(loginUrl, 302);
}
