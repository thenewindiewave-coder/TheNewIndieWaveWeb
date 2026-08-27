// Serverless Function para Vercel: /api/status?id=TNIW-XXXX
// Consulta el estado en tiempo real del track en Supabase

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(200).json({
      success: true,
      mock: true,
      data: {
        track_id: id,
        artist_name: 'Artista Demo',
        song_title: 'Canción Demo',
        playlist: 'Rock indie para manejar de noche',
        status: 'queue',
        created_at: new Date().toISOString()
      }
    });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/submissions?track_id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Error al consultar Supabase');
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    return res.status(200).json({ success: true, data: rows[0] });

  } catch (error) {
    console.error('Status API error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
