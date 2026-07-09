export const config = { matcher: ['/app/:path*'] };

export default async function middleware(request) {
  const url = new URL(request.url);
  const secret = process.env.ACCESS_TOKEN_SECRET;

  if (!secret) {
    console.error('ACCESS_TOKEN_SECRET no está definida');
    return Response.redirect(new URL('/acceso-no-valido.html', request.url), 302);
  }

  const tokenFromQuery = url.searchParams.get('token');
  const cookieHeader = request.headers.get('cookie') || '';
  const tokenFromCookie = cookieHeader
    .split('; ')
    .find(c => c.startsWith('access_token='))
    ?.split('=')[1];

  const token = tokenFromQuery || tokenFromCookie;
  const pathParts = url.pathname.split('/');
  const producto = pathParts[2];

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

  return new Response(null, { status: 200 });
}

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expected = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedHex = Array.from(new Uint8Array(expected))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedHex !== sig) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (err) {
    console.error('Error verificando token:', err.message);
    return null;
  }
}
