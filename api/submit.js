// Serverless Function para Vercel: /api/submit
// Inserta el envío del artista directamente en Supabase de forma segura

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      track_id,
      artist_name,
      email,
      country,
      song_title,
      spotify_url,
      language,
      genre,
      playlist,
      instagram,
      tiktok,
      notes,
      tier = 'free',
      cfResponse
    } = req.body;

    if (!artist_name || !email || !song_title || !spotify_url || !playlist) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    if (!cfResponse) {
      return res.status(400).json({ error: 'Validación anti-spam (Captcha) requerida.' });
    }

    // 1. Validar Captcha Turnstile con Cloudflare
    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    
    const verifyData = new URLSearchParams();
    verifyData.append('secret', TURNSTILE_SECRET);
    verifyData.append('response', cfResponse);

    const cfVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyData
    });
    
    const cfVerifyResult = await cfVerify.json();
    if (!cfVerifyResult.success) {
      return res.status(400).json({ error: 'Fallo la validación anti-spam (Captcha inválido).' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Error de configuración: Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
    }

    // --- PROTECCIÓN ANTI-SPAM (Por Email e IP) ---
    // Extraer la IP del cliente (Vercel lo inyecta en x-forwarded-for)
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    // Consultar envíos de este email O esta IP en los últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateLimit = sevenDaysAgo.toISOString();

    // Filtro or=(email.eq.correo,ip_address.eq.ip)
    const spamCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions?or=(email.eq.${encodeURIComponent(email)},ip_address.eq.${encodeURIComponent(clientIp)})&created_at=gte.${dateLimit}&select=id,spotify_url,email,ip_address`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (spamCheckRes.ok) {
      const recentSubmissions = await spamCheckRes.json();
      
      // 1. Validar máximo 5 envíos por semana en total (ya sea misma IP o mismo email)
      if (recentSubmissions.length >= 5) {
        return res.status(429).json({ error: 'Has alcanzado el límite de 5 canciones enviadas esta semana. Por favor, intenta de nuevo en unos días.' });
      }

      // 2. Validar que no envíe el mismo track exacto repetidamente
      const alreadySubmitted = recentSubmissions.find(sub => sub.spotify_url === spotify_url);
      if (alreadySubmitted) {
        return res.status(409).json({ error: 'Ya enviaste esta canción recientemente. Por favor espera a que sea evaluada.' });
      }
    }
    // --- FIN PROTECCIÓN ANTI-SPAM ---

    // Insertar vía REST API de Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        track_id: track_id || `TNIW-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        artist_name,
        email,
        country,
        song_title,
        spotify_url,
        language: language || 'Español',
        genre,
        playlist,
        instagram,
        tiktok,
        notes,
        tier,
        status: 'pending',
        ip_address: clientIp
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase Error: ${errText}`);
    }

    const data = await response.json();
    return res.status(200).json({ success: true, data: data[0] || data });

  } catch (error) {
    console.error('Submit API error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
