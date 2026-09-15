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
      const errorCodes = cfVerifyResult['error-codes'] || [];
      console.warn('Cloudflare Turnstile failure:', errorCodes);
      if (errorCodes.includes('timeout-or-duplicate')) {
        return res.status(400).json({ error: 'La verificación de seguridad expiró por tiempo. Se ha renovado automáticamente, por favor presiona "Enviar" nuevamente.' });
      }
      return res.status(400).json({ error: 'Fallo la verificación de seguridad (Captcha). Se ha renovado, intenta presionar "Enviar" de nuevo.' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Error de configuración en base de datos. Por favor contacta a soporte.' });
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
    const insertedItem = data[0] || data;

    // --- NOTIFICACIÓN EN TIEMPO REAL A TELEGRAM ---
    try {
      await sendTelegramNotification({
        artist_name,
        song_title,
        genre,
        playlist,
        country,
        email,
        instagram,
        tiktok,
        notes,
        spotify_url,
        track_id: insertedItem.track_id || track_id
      });
    } catch (tgErr) {
      console.warn('Telegram notification failed non-critically:', tgErr.message);
    }

    return res.status(200).json({ success: true, data: insertedItem });

  } catch (error) {
    console.error('Submit API error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

async function sendTelegramNotification(item) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8942664442:AAEDXBeqpfsYGZMkPVg6dpn2ndZRnHJZX9I';
  const chatId = process.env.TELEGRAM_CHAT_ID || '5821470884';

  if (!botToken || !chatId) {
    return;
  }

  const message = [
    `🎵 *¡NUEVA CANCIÓN RECIBIDA EN CURADURÍA!*`,
    ``,
    `👤 *Artista:* ${escapeMarkdown(item.artist_name || 'N/A')}`,
    `🎶 *Track:* ${escapeMarkdown(item.song_title || 'N/A')}`,
    `🏷️ *Género:* ${escapeMarkdown(item.genre || 'Indie')}`,
    `🎯 *Playlist:* ${escapeMarkdown(item.playlist || 'N/A')}`,
    `📍 *País:* ${escapeMarkdown(item.country || 'N/A')}`,
    `✉️ *Email:* ${escapeMarkdown(item.email || 'N/A')}`,
    item.instagram ? `📸 *Instagram:* @${escapeMarkdown(item.instagram.replace('@',''))}` : null,
    item.tiktok ? `📱 *TikTok:* @${escapeMarkdown(item.tiktok.replace('@',''))}` : null,
    item.notes ? `💬 *Nota:* _"${escapeMarkdown(item.notes)}"_` : null,
    ``,
    `🔗 [Abrir Canción en Spotify](${item.spotify_url})`,
    `🎛️ [Abrir Panel de Curador](https://thenewindiewave.online/curador.html)`
  ].filter(Boolean).join('\n');

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    })
  });
}

function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString().replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
