const SEGMENT_ID = '30bdbd8e-c6a8-490c-bae1-8a98b4d46a5c';

let cachedAudienceId = null;

async function getAudienceId() {
  if (cachedAudienceId) return cachedAudienceId;

  const response = await fetch('https://api.resend.com/audiences', {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo listar audiences: ${response.status}`);
  }

  const data = await response.json();
  const audiences = data.data || [];
  if (audiences.length === 0) {
    throw new Error('No hay audiences en la cuenta');
  }

  cachedAudienceId = audiences[0].id;
  console.log('Audience descubierta:', cachedAudienceId);
  return cachedAudienceId;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.arquitecta-emocional.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const email = (body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // 1. Agregar contacto a la Audience de Resend
    try {
      const audienceId = await getAudienceId();
      const contactResponse = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            unsubscribed: false,
          }),
        }
      );

      if (contactResponse.ok) {
        console.log('Contacto agregado a la audience:', email);
      } else {
        const errorText = await contactResponse.text();
        console.log('Contacto puede que ya exista:', errorText);
      }
    } catch (err) {
      console.error('Error agregando contacto:', err.message);
    }

    // 2. Enviar correo con el link al Test
    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;background:#F5F0E8;padding:40px 20px;color:#3D3830;">
        <div style="max-width:520px;margin:0 auto;background:#FFFFFF;padding:48px 40px;border-radius:8px;">
          <h1 style="font-size:22px;font-weight:500;margin:0 0 24px;color:#3D3830;">
            Tu Test de Fragmentación Emocional
          </h1>
          <p style="font-size:16px;line-height:1.7;margin:0 0 24px;">
            Gracias por escribirme. Este es un cuestionario breve para identificar qué partes de ti se desconectaron en el camino — un mapa suave, no un diagnóstico. Hazlo con calma:
          </p>
          <p style="margin:32px 0;text-align:center;">
            <a href="https://www.arquitecta-emocional.com/gratis/test-fragmentacion" style="display:inline-block;background:#C9AA7C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:4px;font-weight:500;">
              Acceder al Test
            </a>
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B655E;margin:24px 0 0;">
            Guarda este correo para volver al Test cuando quieras. Si tienes dudas, respóndeme aquí — leo cada mensaje.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#6B655E;margin:24px 0 0;">
            Con cuidado,<br>
            Belén · Arquitecta Emocional
          </p>
        </div>
      </div>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Arquitecta Emocional <hola@arquitecta-emocional.com>',
        to: email,
        subject: 'Tu Test de Fragmentación Emocional',
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Error enviando correo:', errorText);
      return res.status(500).json({ error: 'No se pudo enviar el correo' });
    }

    console.log('Suscripción exitosa:', email);
    return res.status(200).json({ ok: true, message: 'Correo enviado' });

  } catch (err) {
    console.error('Error general:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
