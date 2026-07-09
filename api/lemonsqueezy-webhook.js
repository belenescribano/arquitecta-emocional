import crypto from 'node:crypto';

const PRODUCTO_POR_VARIANT = {
  [process.env.VARIANT_ID_VOCABULARIO]: 'vocabulario-emocional',
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

  console.log('Webhook recibido. Firma coincide:', signature === expected);

  if (signature !== expected) {
    return res.status(401).send('Firma inválida');
  }

  const event = JSON.parse(rawBody);
  console.log('Evento:', event.meta.event_name);

  if (event.meta.event_name !== 'order_created') {
    return res.status(200).send('OK (evento ignorado)');
  }

  const variantId = String(event.data.attributes.first_order_item.variant_id);
  const email = event.data.attributes.user_email;
  const producto = PRODUCTO_POR_VARIANT[variantId];

  console.log('Variant ID recibido:', variantId, '| Producto mapeado:', producto);

  if (!producto) {
    return res.status(200).send('OK (producto no gateado)');
  }

  const token = signToken(
    { producto, email, iat: Date.now() },
    process.env.ACCESS_TOKEN_SECRET
  );
  const accessUrl = `https://www.arquitecta-emocional.com/app/${producto}?token=${token}`;

  console.log('Link de acceso generado:', accessUrl);

  return res.status(200).send('OK');
}

function signToken(payloadObj, secret) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
