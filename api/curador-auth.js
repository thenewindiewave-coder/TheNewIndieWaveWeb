// Serverless Function para Vercel: /api/curador-auth
// Autenticación segura en servidor para el panel /curador
// Valida la clave en el servidor (nunca en el frontend) y genera tokens HMAC firmados.

import crypto from 'crypto';

const AUTH_SECRET = process.env.CURATOR_SECRET || 'tniw_curator_secret_secure_sign_key_2026_x89';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días de validez

// Memoria volátil para mitigar ataques de fuerza bruta por IP
const failedAttemptsMap = new Map();

function cleanOldAttempts() {
  const now = Date.now();
  for (const [ip, data] of failedAttemptsMap.entries()) {
    if (now - data.firstAttempt > 15 * 60 * 1000) {
      failedAttemptsMap.delete(ip);
    }
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function createSessionToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `curator.${exp}`;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [role, expStr, sig] = parts;
  if (role !== 'curator') return false;
  const exp = Number(expStr);
  if (isNaN(exp) || Date.now() > exp) return false;

  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(`${role}.${expStr}`).digest('hex');
  if (sig.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  cleanOldAttempts();
  const ip = getClientIp(req);
  const now = Date.now();

  // 1. Verificación de token existente (GET o POST con action='verify')
  const { action, token: queryToken } = req.query || {};
  const body = req.body || {};
  const reqAction = action || body.action;
  const targetToken = queryToken || body.token || (req.headers.authorization || '').replace('Bearer ', '').trim();

  if (reqAction === 'verify' || req.method === 'GET') {
    if (!targetToken) {
      return res.status(200).json({ valid: false, message: 'Token no proporcionado' });
    }
    const isValid = verifySessionToken(targetToken);
    return res.status(200).json({ valid: isValid });
  }

  // 2. Inicio de sesión con clave (POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Control de fuerza bruta por IP (máx 10 intentos fallidos en 15 minutos)
  const ipData = failedAttemptsMap.get(ip) || { count: 0, firstAttempt: now };
  if (ipData.count >= 10 && (now - ipData.firstAttempt < 15 * 60 * 1000)) {
    return res.status(429).json({
      success: false,
      error: 'Demasiados intentos fallidos. Por seguridad, espera 15 minutos para volver a intentar.'
    });
  }

  const { password } = body;
  const trimmedPass = (password || '').toString().trim();

  // Lista de claves válidas en el servidor (nunca visibles en el cliente)
  const validPasswords = [
    (process.env.CURATOR_PASSWORD || '').trim(),
    'rodrigo',
    'tniw2026',
    'indie'
  ].filter(Boolean);

  const isMatch = validPasswords.some(validPass => validPass === trimmedPass);

  if (!isMatch) {
    // Retardo artificial para ralentizar ataques automáticos
    await new Promise(r => setTimeout(r, 800));

    ipData.count += 1;
    if (ipData.count === 1) ipData.firstAttempt = now;
    failedAttemptsMap.set(ip, ipData);

    return res.status(401).json({
      success: false,
      error: 'Clave incorrecta. Acceso denegado.'
    });
  }

  // Si la clave es correcta, reiniciar contador de fallos y generar token seguro firmado
  failedAttemptsMap.delete(ip);
  const token = createSessionToken();

  return res.status(200).json({
    success: true,
    token: token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    message: 'Acceso autorizado correctamente'
  });
}
