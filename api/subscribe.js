// Vercel Serverless Function — POST /api/subscribe
// Variables de entorno requeridas (Vercel > Settings > Environment Variables):
//   MAILERLITE_API_KEY
//   MAILERLITE_GROUP_ID_01   (Presencia con fisuras · 0-32)
//   MAILERLITE_GROUP_ID_02   (Fragmentación silenciosa · 33-52)
//   MAILERLITE_GROUP_ID_03   (Fragmentación activa · 53-68)
//   MAILERLITE_GROUP_ID_04   (Fragmentación profunda · 69-80)  [opcional: si falta, usa el 03]

const MAILERLITE_ENDPOINT = 'https://connect.mailerlite.com/api/subscribers';

function resolveGroupId(resultGroup) {
  const map = {
    '01': process.env.MAILERLITE_GROUP_ID_01,
    '02': process.env.MAILERLITE_GROUP_ID_02,
    '03': process.env.MAILERLITE_GROUP_ID_03,
    '04': process.env.MAILERLITE_GROUP_ID_04 || process.env.MAILERLITE_GROUP_ID_03,
  };
  return map[String(resultGroup)] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error('[subscribe] MAILERLITE_API_KEY no está configurada');
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  // Vercel ya parsea JSON, pero aceptamos string por si acaso
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { name, email, resultGroup, resultName, resultLevel, score, dimensions } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email inválido' });
  }

  const groupId = resolveGroupId(resultGroup);

  const payload = {
    email,
    fields: {
      name: name || '',
      // Campos personalizados: créalos en MailerLite como texto/número con estas claves
      perfil: resultName || '',
      nivel: resultLevel || '',
      puntaje: typeof score === 'number' ? score : null,
      dim_estructural: dimensions?.emocional ?? null,
      dim_corporal: dimensions?.corporal ?? null,
      dim_identidad: dimensions?.identidad ?? null,
      dim_limites: dimensions?.relacional ?? null,
    },
    status: 'active',
  };
  if (groupId) payload.groups = [String(groupId)];

  try {
    const r = await fetch(MAILERLITE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error('[subscribe] MailerLite error', r.status, JSON.stringify(data));
      return res.status(502).json({ ok: false, status: r.status, error: data?.message || 'MailerLite error', details: data?.errors || null });
    }

    return res.status(200).json({ ok: true, id: data?.data?.id || null, grouped: Boolean(groupId) });
  } catch (err) {
    console.error('[subscribe] fetch falló', err);
    return res.status(500).json({ ok: false, error: 'Network error' });
  }
}
