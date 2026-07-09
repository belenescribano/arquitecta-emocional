export const config = { matcher: ['/app/:path*'] };

export default async function middleware(request) {
  const url = new URL(request.url);
  const secret = process.env.ACCESS_TOKEN_SECRET;

  const tokenFromQuery = url.searchParams.get('token');
  const tokenFromCookie = request.headers.get('cookie')
    ?.split('; ')
    .find(c => c.startsWith('access_token='))
    ?.split('=')[1];

  const token = tokenFromQuery || tokenFromCookie;
  const producto = url.pathname.split('/')[2];

  if (!token) {
    return Response.redirect(new URL('/acceso-no-valido.html', request.url), 302);
  }

  const payload = await verifyToken(token, secret);
  if (!payload || payload.producto !== producto) {
    return Response.redirect(new URL('/acceso-no-valido.html', request.url), 302);
  }

  if (tokenFromQuery) {
    const cleanUrl = new URL(url.pathname, request.url);
    const res = Response.redirect(cleanUrl, 302);
    res.headers.append(
      'Set-Cookie',
      `access_token=${token}; Path=/app; HttpOnly; Secure; SameSite=Lax; Max-Age=94608000`
    );
    return res;
  }

  return;
}

async function verifyToken(token, secret) {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const expected = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedHex = [...new Uint8Array(expected)]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (expectedHex !== sig) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
