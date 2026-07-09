export const config = { matcher: ['/app/:path*'] };

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const secret = process.env.ACCESS_TOKEN_SECRET;

    if (!secret) {
      console.error('ACCESS_TOKEN_SECRET no definida');
      return redirectTo('/acceso-no-valido.html', request.url);
    }

    const tokenFromQuery = url.searchParams.get('token');
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenFromCookie = cookieHeader
      .split('; ')
      .find(c => c.startsWith('access_token='))
      ?.split('=')[1];

    const token = tokenFromQuery || tokenFromCookie;
    const producto = url.pathname.split('/')[2];

    if (!token) {
      return redirectTo('/acceso-no-valido.html', request.url);
    }

    const payload = await verifyToken(token, secret);
    console.log('Payload decodificado:', JSON.stringify(payload), 'Producto ruta:', producto);

    if (!payload) {
      return redirectTo('/acceso-no-valido.html', request.url);
    }

    if (payload.producto !== producto) {
      console.log('Producto no coincide. Token:', payload.producto, 'URL:', producto);
      return redirectTo('/acceso-no-valido.html', request.url);
    }

    if (tokenFromQuery) {
      const cleanUrl = new URL(url.pathname, request.url).toString();
      return new Response(null, {
        status: 302,
        headers: {
          Location: cleanUrl,
          'Set-Cookie': `access_token=${token}; Path=/app; HttpOnly; Secure; SameSite=Lax; Max-Age=94608000`,
        },
      });
    }

    return;
  } catch (err) {
    console.error('Error en middleware:', err.message, err.stack);
    return redirectTo('/acceso-no-valido.html', request.url);
  }
}

function redirectTo(path, base) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(path, base).toString() },
  });
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

    if (expectedHex !== sig) {
      console.log('Firma no coincide');
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const binary = atob(padded);
    return JSON.parse(binary);
  } catch (err) {
    console.error('Error verificando token:', err.message);
    return null;
  }
}
