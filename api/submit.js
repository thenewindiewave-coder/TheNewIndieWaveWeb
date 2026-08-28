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
        whatsapp: whatsapp || '',
      whatsapp,
      song_title,
      spotify_url,
      language,
      genre,
      playlist,
      instagram,
      tiktok,
      notes,
      tier = 'free'
    } = req.body;

    if (!artist_name || !email || !song_title || !spotify_url || !playlist) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Fallback amigable si aún no se configuran variables de entorno
      return res.status(200).json({
        success: true,
        mock: true,
        track_id: track_id || 'TNIW-DEMO',
        message: 'Envío recibido (Modo Local/Mock).'
      });
    }

    // Insertar vía REST API de Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        track_id: track_id || `TNIW-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        artist_name,
        email,
        country,
        whatsapp: whatsapp || '',
      whatsapp,
        song_title,
        spotify_url,
        language: language || 'Español',
        genre,
        playlist,
        instagram,
        tiktok,
        notes,
        tier,
        status: 'pending'
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
