// Vercel Serverless Function: POST /api/send-results
// Envía a la usuaria su Mapa de Funcionamiento completo y una copia detallada a la mentora.
// Variables de entorno: BREVO_API_KEY (obligatoria), MENTORA_EMAIL (opcional)
// El servidor recalcula todo a partir de las 16 respuestas: los textos no vienen del navegador.

import { CONTENT } from './_content.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const CALENDLY = 'https://calendly.com/belenescribanosb/30min';
const SITE = 'https://www.arquitecta-emocional.com';
const INSTAGRAM = 'https://www.instagram.com/arquitecta.emocional.cl';
const SENDER = { name: 'Arquitecta Emocional', email: 'hola@arquitecta-emocional.com' };
const ORDER = ['emocional', 'corporal', 'identidad', 'relacional'];

const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "Inter,Arial,Helvetica,sans-serif";
const C = { marfil: '#F5F0E8', beige: '#E8DFD0', taupe: '#8A7E6E', dorado: '#C9AA7C', carbon: '#3D3830', doradoSuave: '#EFE4D0' };

const DOLOR_LABELS = {
  ansiedad: 'Siento ansiedad y no entiendo de dónde viene',
  tca: 'Mi relación con la comida se siente fuera de control',
  duelo: 'Perdí algo importante y no logro recomponerme',
  automatico: 'Funciono en automático y no sé cómo salir de ahí',
  indefinido: 'No estoy segura, solo sé que algo no está bien',
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, '');

function nivel4(p) { if (p <= 32) return 'bajo'; if (p <= 52) return 'medio'; if (p <= 68) return 'alto'; return 'intenso'; }
function dimBand(p) { if (p <= 32) return 'bajo'; if (p <= 52) return 'medio'; return 'alto'; }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function safeResultUrl(u) {
  try {
    const url = new URL(String(u || ''));
    const ok = url.protocol === 'https:' && (url.hostname.endsWith('arquitecta-emocional.com') || url.hostname.endsWith('.vercel.app'));
    return ok ? url.toString() : null;
  } catch { return null; }
}

// ── Cálculo (idéntico al del mapa)
function calcular(valores, dolorEntrada) {
  const raw = { emocional: 0, corporal: 0, identidad: 0, relacional: 0 };
  CONTENT.QUESTIONS.forEach((q, i) => { raw[q.dim] += valores[i]; });
  const total = valores.reduce((a, b) => a + b, 0);
  const dims = ORDER.map((k, i) => {
    const puntaje = Math.round((raw[k] / 20) * 80);
    return { key: k, i, label: CONTENT.DIMS[k].label, color: CONTENT.DIMS[k].color, puntaje, nivel: nivel4(puntaje), textos: CONTENT.DIM_TEXTS[k][dimBand(puntaje)] };
  });
  const ord = [...dims].sort((a, b) => b.puntaje - a.puntaje || a.i - b.i);
  const top = ord[0], second = ord[1];
  const profile = CONTENT.PROFILES.find((p) => total >= p.min && total <= p.max) || CONTENT.PROFILES[CONTENT.PROFILES.length - 1];
  const dolor = CONTENT.DOLOR_TEXTS[dolorEntrada] ? dolorEntrada : 'indefinido';
  return {
    total, dims, top, second, profile, dolor,
    personal: CONTENT.DOLOR_TEXTS[dolor].replace('{dim}', CONTENT.DOLOR_DIM_NAMES[top.key]),
    capa1: CONTENT.TEXTOS_CAPA1[top.key],
    capa2: CONTENT.TEXTOS_CAPA2[[top.key, second.key].sort().join('_')],
    capa3: CONTENT.TEXTO_CAPA3,
  };
}

// ── Gráfico radar como imagen (los clientes de correo no muestran SVG)
function radarImageUrl(r) {
  const cfg = {
    type: 'radar',
    data: {
      labels: r.dims.map((d) => `${d.label}  ${d.puntaje}`),
      datasets: [{
        data: r.dims.map((d) => d.puntaje),
        backgroundColor: hexA(r.top.color, 0.15),
        borderColor: 'rgba(61,56,48,0.6)', borderWidth: 2,
        pointBackgroundColor: r.dims.map((d) => d.color),
        pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 6,
      }],
    },
    options: {
      legend: { display: false },
      scale: {
        ticks: { min: 0, max: 80, stepSize: 20, display: false },
        gridLines: { color: C.beige }, angleLines: { color: C.beige },
        pointLabels: { fontColor: C.carbon, fontSize: 13, fontFamily: 'Helvetica' },
      },
    },
  };
  return `https://quickchart.io/chart?w=400&h=400&devicePixelRatio=2&bkg=${encodeURIComponent(C.marfil)}&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

// ── Piezas del correo
const label = (t, color = C.taupe) =>
  `<p style="margin:0 0 8px;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${color};">${esc(t)}</p>`;
const para = (t, extra = '') =>
  `<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.75;color:${C.carbon};${extra}">${esc(t)}</p>`;
const spacer = (h) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;
const sectionTitle = (t) =>
  `<tr><td align="center" style="padding:0 0 22px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.carbon};">${esc(t)}</td></tr>`;

function barra(d) {
  const pct = Math.round((d.puntaje / 80) * 100);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
    ${pct > 0 ? `<td width="${pct}%" style="background:${d.color};height:5px;font-size:0;line-height:0;">&nbsp;</td>` : ''}
    ${pct < 100 ? `<td width="${100 - pct}%" style="background:${C.beige};height:5px;font-size:0;line-height:0;">&nbsp;</td>` : ''}
  </tr></table>`;
}

function construirEmailResultados({ nombre, r, resultUrl }) {
  const p = r.profile;
  const saludo = nombre ? `Hola, ${esc(nombre)}` : 'Hola';

  const dimsResumen = [r.dims.slice(0, 2), r.dims.slice(2, 4)].map((fila) => `<tr>${fila.map((d) => `
      <td width="50%" valign="top" style="padding:8px 6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding-right:8px;"><div style="width:9px;height:9px;border-radius:50%;background:${d.color};font-size:0;line-height:0;">&nbsp;</div></td>
          <td valign="middle" style="font-family:${SANS};font-size:13px;color:${C.carbon};">${esc(d.label)} <strong>${d.puntaje}</strong></td>
        </tr></table>
      </td>`).join('')}</tr>`).join('');

  const capas = [
    ['Lo que se ve', r.capa1],
    ['Lo que sostiene el patrón', r.capa2],
    ['Lo que organiza todo', r.capa3],
  ].map(([t, txt]) => `
      <tr><td style="padding:4px 0 4px 20px;border-left:2px solid ${C.dorado};">
        ${label(t, C.dorado)}${para(txt)}
      </td></tr>${spacer(22)}`).join('');

  const detalle = r.dims.map((d) => `
      <tr><td style="padding:26px 0;border-top:1px solid ${C.beige};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${SERIF};font-size:22px;color:${d.color};">${esc(d.label)}</td>
            <td align="right" style="font-family:${SANS};font-size:13px;color:${C.carbon};white-space:nowrap;"><strong>${d.puntaje}/80</strong> &nbsp;<span style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.taupe};">nivel ${esc(d.nivel)}</span></td>
          </tr>
          <tr><td colspan="2" style="padding:10px 0 18px;">${barra(d)}</td></tr>
          <tr><td colspan="2" style="padding:0 0 16px;">${label('Qué significa')}${para(d.textos.significa)}</td></tr>
          <tr><td colspan="2" style="padding:0 0 16px;">${label('En tu día a día')}${para(d.textos.diaadia)}</td></tr>
          <tr><td colspan="2">${label('Dónde empezar')}${para(d.textos.dondeempezar)}</td></tr>
        </table>
      </td></tr>`).join('');

  const insights = [[p.insight1_label, p.insight1], [p.insight2_label, p.insight2]].map(([t, txt]) => `
      <tr><td style="padding:24px 26px;background:${C.beige};border-radius:8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr>
          <td valign="middle" style="padding-right:10px;"><div style="width:7px;height:7px;border-radius:50%;background:${C.dorado};font-size:0;line-height:0;">&nbsp;</div></td>
          <td valign="middle" style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.carbon};">${esc(t)}</td>
        </tr></table>
        ${para(txt)}
      </td></tr>${spacer(14)}`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>Tu Mapa de Funcionamiento</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.marfil};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.marfil};">
<tr><td align="center" style="padding:40px 18px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

  <!-- 1 Header -->
  <tr><td align="center" style="font-family:${SERIF};font-size:20px;letter-spacing:6px;text-transform:uppercase;color:${C.carbon};">Arquitecta Emocional</td></tr>
  <tr><td align="center" style="padding:16px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="56" style="height:1px;background:${C.dorado};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
  <tr><td align="center" style="font-family:${SERIF};font-style:italic;font-size:18px;color:${C.taupe};">Tu Mapa de Funcionamiento</td></tr>
  ${spacer(44)}

  <!-- 2 Saludo -->
  <tr><td style="font-family:${SERIF};font-size:26px;color:${C.carbon};padding-bottom:10px;">${saludo}</td></tr>
  <tr><td>${para('Aquí tienes tu resultado completo. Guárdalo, vuelve a él cuando lo necesites.')}</td></tr>
  ${spacer(40)}

  <!-- 3 Puntaje general -->
  <tr><td align="center" style="padding:36px 24px;border-top:1px solid ${C.beige};border-bottom:1px solid ${C.beige};">
    <p style="margin:0;font-family:${SERIF};font-size:72px;line-height:1;color:${C.carbon};">${r.total}</p>
    <p style="margin:4px 0 16px;font-family:${SERIF};font-size:16px;color:${C.taupe};">de 80</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px;"><tr>
      <td style="border:1px solid ${C.dorado};padding:6px 14px;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.carbon};">nivel ${esc(String(p.level).toLowerCase())}</td>
    </tr></table>
    <p style="margin:0 0 8px;font-family:${SERIF};font-size:30px;line-height:1.2;color:${C.carbon};">${esc(stripTags(p.name))}</p>
    <p style="margin:0 0 18px;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.5;color:${C.taupe};">${esc(p.sub)}</p>
    <p style="margin:0 auto;max-width:340px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.taupe};">Un puntaje más alto indica mayor intensidad en tus patrones automáticos.</p>
  </td></tr>
  ${spacer(32)}

  <!-- 4 Párrafo personalizado -->
  <tr><td style="padding:32px 34px;background:${C.beige};font-family:${SERIF};font-style:italic;font-size:19px;line-height:1.6;color:${C.carbon};">${esc(r.personal)}</td></tr>
  ${spacer(48)}

  <!-- 5 Radar -->
  ${sectionTitle('Tu Mapa')}
  <tr><td align="center">
    <img src="${radarImageUrl(r)}" width="400" height="400" alt="Tu gráfico radar" style="display:block;width:100%;max-width:400px;height:auto;border:1px solid ${C.dorado};">
  </td></tr>
  <tr><td style="padding:14px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${dimsResumen}</table></td></tr>
  ${resultUrl ? `<tr><td align="center" style="padding:14px 0 0;"><a href="${esc(resultUrl)}" target="_blank" style="font-family:${SANS};font-size:12px;color:${C.carbon};text-decoration:underline;">Ver mi Mapa en línea y descargarlo</a></td></tr>` : ''}
  ${spacer(52)}

  <!-- 6 Tres capas -->
  ${sectionTitle('Lo que tu Mapa revela')}
  ${capas}
  ${spacer(28)}

  <!-- 7 Detalle por dimensión -->
  ${sectionTitle('Tu Mapa en detalle')}
  ${detalle}
  ${spacer(36)}

  <!-- 8 Insights -->
  ${insights}
  ${spacer(18)}

  <!-- 9 Primer paso -->
  <tr><td style="padding:30px 32px;background:${C.doradoSuave};border-top:2px solid ${C.dorado};">
    ${label('Tu primer paso', C.carbon)}
    <p style="margin:0;font-family:${SERIF};font-size:19px;line-height:1.6;color:${C.carbon};">${esc(p.primerPaso)}</p>
  </td></tr>
  ${spacer(52)}

  <!-- 10 CTA -->
  <tr><td align="center" style="padding:0 20px 22px;">${para('Si quieres conversar sobre lo que tu mapa reveló, puedes agendar una conversación gratuita de 30 minutos.', 'text-align:center;')}</td></tr>
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${C.dorado};"><a href="${CALENDLY}" target="_blank" style="display:inline-block;padding:16px 30px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${C.carbon};text-decoration:none;">Agendar mi conversación gratuita</a></td>
    </tr></table>
  </td></tr>
  <tr><td align="center" style="padding:14px 0 0;font-family:${SANS};font-size:12px;color:${C.taupe};">Sin compromiso. Sin presión.</td></tr>
  ${spacer(56)}

  <!-- 11 Footer -->
  <tr><td align="center" style="padding:28px 0 0;border-top:1px solid ${C.beige};font-family:${SANS};font-size:12px;line-height:1.9;color:${C.taupe};">
    <span style="font-family:${SERIF};font-size:16px;letter-spacing:3px;text-transform:uppercase;color:${C.carbon};">Arquitecta Emocional</span><br>
    <a href="${INSTAGRAM}" target="_blank" style="color:${C.taupe};text-decoration:none;">@arquitecta.emocional.cl</a><br>
    <a href="${SITE}" target="_blank" style="color:${C.taupe};text-decoration:none;">www.arquitecta-emocional.com</a><br>
    Belén Escribano · Santiago, Chile<br><br>
    <span style="font-size:11px;">Este Mapa no es un diagnóstico. Es una fotografía de cómo funciona tu sistema emocional hoy.</span><br>
    <span style="font-size:11px;">Si no quieres recibir más correos, puedes <a href="mailto:hola@arquitecta-emocional.com?subject=Darme%20de%20baja" style="color:${C.taupe};text-decoration:underline;">darte de baja aquí</a>.</span>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function construirEmailMentora({ nombre, email, r, valores, resultUrl }) {
  const filasDims = r.dims.map((d) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.beige};">${esc(d.label)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid ${C.beige};"><strong>${d.puntaje}/80</strong> · ${esc(d.nivel)}</td></tr>`).join('');
  const filasResp = CONTENT.QUESTIONS.map((q, i) => `
    <tr>
      <td valign="top" style="padding:8px 8px 8px 0;border-bottom:1px solid ${C.beige};color:${C.taupe};width:24px;">${i + 1}</td>
      <td valign="top" style="padding:8px 0;border-bottom:1px solid ${C.beige};">${esc(q.text)}<br><span style="font-size:11px;color:${C.taupe};">${esc(CONTENT.DIMS[q.dim].label)}</span></td>
      <td valign="top" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid ${C.beige};font-size:18px;"><strong>${valores[i]}</strong></td>
    </tr>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:${C.marfil};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${C.carbon};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;">
  <tr><td style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.dorado};padding-bottom:6px;">Nuevo Mapa de Funcionamiento</td></tr>
  <tr><td style="font-family:Georgia,serif;font-size:26px;padding-bottom:4px;">${esc(nombre || 'Sin nombre')}</td></tr>
  <tr><td style="padding-bottom:20px;"><a href="mailto:${esc(email)}" style="color:${C.carbon};">${esc(email)}</a></td></tr>
  <tr><td style="padding:16px 18px;background:#FFFFFF;border:1px solid ${C.beige};">
    <strong>Puerta de entrada:</strong> ${esc(DOLOR_LABELS[r.dolor])}<br>
    <strong>Perfil:</strong> ${esc(stripTags(r.profile.name))} · ${r.total}/80 · nivel ${esc(r.profile.level)}<br>
    <strong>Dimensiones más altas:</strong> ${esc(r.top.label)} y ${esc(r.second.label)}
  </td></tr>
  ${resultUrl ? `<tr><td style="padding:20px 0 0;"><a href="${esc(resultUrl)}" target="_blank" style="display:inline-block;padding:12px 22px;border:1px solid ${C.carbon};color:${C.carbon};text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Abrir su resultado completo</a></td></tr>` : ''}
  <tr><td style="padding:28px 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.taupe};">Dimensiones</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filasDims}</table></td></tr>
  <tr><td style="padding:28px 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.taupe};">Respuestas (1 casi nunca · 5 casi siempre)</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filasResp}</table></td></tr>
</table></body></html>`;
}

// Adjunto PNG generado en el navegador: se valida firma y tamaño
function pngAdjunto(b64) {
  if (typeof b64 !== 'string' || b64.length > 1_500_000 || !b64.startsWith('iVBORw0KGgo')) return null;
  return [{ content: b64, name: 'mi-mapa-de-funcionamiento.png' }];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[send-results] BREVO_API_KEY no está configurada');
    return res.status(500).json({ error: 'Server not configured' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
  }
  const { nombre, email, dolorEntrada, respuestas } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' });

  const valores = Array.isArray(respuestas)
    ? respuestas.slice(0, CONTENT.QUESTIONS.length).map((x) => Number(typeof x === 'object' ? x?.valor : x))
    : [];
  if (valores.length !== CONTENT.QUESTIONS.length || valores.some((v) => !(Number.isInteger(v) && v >= 1 && v <= 5))) {
    return res.status(400).json({ error: 'Respuestas inválidas' });
  }

  const nombreLimpio = String(nombre || '').trim().slice(0, 80);
  const resultUrl = safeResultUrl(body.resultUrl);
  const r = calcular(valores, dolorEntrada);
  const attachment = pngAdjunto(body.mapaPng);

  const brevo = (payload) => fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  try {
    const [rUser, rMentora] = await Promise.allSettled([
      brevo({
        sender: SENDER,
        to: [{ email, name: nombreLimpio || email }],
        subject: nombreLimpio ? `${nombreLimpio}, aquí está tu Mapa de Funcionamiento` : 'Aquí está tu Mapa de Funcionamiento',
        htmlContent: construirEmailResultados({ nombre: nombreLimpio, r, resultUrl }),
        ...(attachment ? { attachment } : {}),
      }),
      brevo({
        sender: SENDER,
        to: [{ email: process.env.MENTORA_EMAIL || SENDER.email, name: 'Belén Escribano' }],
        replyTo: { email, name: nombreLimpio || email },
        subject: `Nuevo Mapa: ${nombreLimpio || email} · ${stripTags(r.profile.name)}`,
        htmlContent: construirEmailMentora({ nombre: nombreLimpio, email, r, valores, resultUrl }),
      }),
    ]);
    if (rMentora.status !== 'fulfilled' || !rMentora.value.ok) console.error('[send-results] copia a mentora falló');
    if (rUser.status !== 'fulfilled' || !rUser.value.ok) {
      const data = rUser.status === 'fulfilled' ? await rUser.value.json().catch(() => ({})) : {};
      console.error('[send-results] Brevo error', JSON.stringify(data));
      return res.status(502).json({ error: data?.message || 'Brevo error' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[send-results] fetch falló', err);
    return res.status(500).json({ error: 'Network error' });
  }
}

export { construirEmailResultados, construirEmailMentora, calcular };
