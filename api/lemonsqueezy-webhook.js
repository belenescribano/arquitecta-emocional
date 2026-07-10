import crypto from 'node:crypto';

const PRODUCTO_POR_VARIANT = {
  [process.env.VARIANT_ID_VOCABULARIO]: 'vocabulario-emocional',
};

const NOMBRES_PRODUCTO = {
  'vocabulario-emocional': 'Vocabulario Emocional',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');

  const signature = req.headers['x-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expected) {
    return res.status(401).send('Firma inválida');
  }

  const event = JSON.parse(rawBody);
  if (event.meta.event_name !== 'order_created') {
    return res.status(200).send('OK (evento ignorado)');
  }

  const variantId = String(event.data.attributes.first_order_item.variant_id);
  const email = event.data.attributes.user_email;
  const producto = PRODUCTO_POR_VARIANT[variantId];

  if (!producto) {
    return res.status(200).send('OK (producto no gateado)');
  }

  const token = signToken(
    { producto, email, iat: Date.now() },
    process.env.ACCESS_TOKEN_SECRET
  );
  const accessUrl = `https://www.arquitecta-emocional.com/app/${producto}?token=${token}`;

  console.log('Link generado para', email, ':', accessUrl);

  try {
    await enviarCorreoDeAcceso(email, producto, accessUrl);
    console.log('Correo enviado correctamente a', email);
  } catch (err) {
    console.error('Error enviando correo:', err.message);
  }

  return res.status(200).send('OK');
}

function signToken(payloadObj, secret) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

async function enviarCorreoDeAcceso(email, producto, accessUrl) {
  const nombreProducto = NOMBRES_PRODUCTO[producto] || producto;

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;background:#F5F0E8;padding:40px 20px;color:#3D3830;">
      <div style="max-width:520px;margin:0 auto;background:#FFFFFF;padding:48px 40px;border-radius:8px;">
        <h1 style="font-size:22px;font-weight:500;margin:0 0 24px;color:#3D3830;">
          Tu acceso a ${nombreProducto} está listo
        </h1>
        <p style="font-size:16px;line-height:1.7;margin:0 0 24px;">
          Gracias por tu compra. Este es tu link personal de acceso — ábrelo cuando quieras y guárdalo en un lugar seguro:
        </p>
        <p style="margin:32px 0;text-align:center;">
          <a href="${accessUrl}" style="display:inline-block;background:#C9AA7C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:4px;font-weight:500;">
            Acceder a ${nombreProducto}
          </a>
        </p>
        <p style="font-size:14px;line-height:1.6;color:#6B655E;margin:24px 0 0;">
          Este link es único para ti. Si tienes dudas o problemas para acceder, respóndele a este correo y te ayudamos.
        </p>
        <p style="font-size:14px;line-height:1.6;color:#6B655E;margin:24px 0 0;">
          Con cuidado,<br>
          Belén · Arquitecta Emocional
        </p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Arquitecta Emocional <hola@arquitecta-emocional.com>',
      to: email,
      subject: `Tu acceso a ${nombreProducto} está listo`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend respondió ${response.status}: ${errorText}`);
  }
}
