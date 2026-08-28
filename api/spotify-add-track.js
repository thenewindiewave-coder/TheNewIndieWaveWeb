// Serverless Function: /api/spotify-add-track
// Añade físicamente una canción a la playlist correspondiente en Spotify
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';

const PLAYLIST_ID_MAP = {
  "Rock indie para manejar de noche sin rumbo": "2APaz3JDupY9fNUczoKMUP",
  "Rock indie para cuando no puedes dormir y piensas demasiado": "5gh1rPce7FnEENWk1POIse",
  "Rock indie sucio y crudo para sentirte rebelde": "2QlvwB1vEhxQ4CM4jrbC8g",
  "Pop indie para estar feliz y triste al mismo tiempo": "36ribRboGB3DwM821oYokl",
  "Pop indie íntimo para escuchar solo en tu cuarto": "0Ty7tTNh1ONGyOLuasPREj",
  "Pop indie suave para domingos sin hacer nada": "20uF7xCOW8zldDCiAowxuF",
  "Hard rock para sacar la rabia y el enojo acumulado": "6cuhRpfYmEt0vYCT9mFLKc",
  "Metal intenso para liberar toda tu energía": "5OLiBaOPAe5cBEdV1AoSd1",
  "Música urbana con flow y ritmo para moverte": "7bbYPZ5ia4IGRP2fT47kXr",
  "Darkwave oscuro y atmosférico para la madrugada": "4mcJJz8GiKTuxieL9Jziln"
};

function extractTrackId(input) {
  if (!input) return null;
  const str = input.trim();
  if (str.includes('track/')) {
    return str.split('track/')[1].split('?')[0].split('&')[0].split('/')[0].trim();
  }
  if (str.includes('spotify:track:')) {
    return str.split('spotify:track:')[1].split('?')[0].trim();
  }
  if (/^[a-zA-Z0-9]{15,30}$/.test(str)) {
    return str;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { spotify_url, playlist_name, refresh_token } = req.body || {};

  const rToken = refresh_token || process.env.SPOTIFY_REFRESH_TOKEN;
  if (!rToken) {
    return res.status(400).json({
      error: 'No se encontró refresh_token de Spotify. Vincula tu cuenta de Spotify primero en el panel.',
      needs_auth: true
    });
  }

  const trackId = extractTrackId(spotify_url);
  if (!trackId) {
    return res.status(400).json({ error: 'Enlace de track de Spotify no válido' });
  }

  const playlistId = PLAYLIST_ID_MAP[playlist_name];
  if (!playlistId) {
    return res.status(400).json({ error: 'Playlist destino no reconocida: ' + playlist_name });
  }

  try {
    // 1. Obtener Access Token fresco desde el Refresh Token
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: rToken
      }).toString()
    });

    if (!refreshRes.ok) {
      const errTxt = await refreshRes.text();
      throw new Error('Error al refrescar token de Spotify: ' + errTxt);
    }

    const tokenData = await refreshRes.json();
    const accessToken = tokenData.access_token;

    // 2. Insertar track físicamente en la playlist de Spotify
    const trackUri = `spotify:track:${trackId}`;
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [trackUri]
      })
    });

    if (!addRes.ok) {
      const addErr = await addRes.json();
      throw new Error('Spotify API Error: ' + (addErr.error ? addErr.error.message : 'Error desconocido al añadir track'));
    }

    const addData = await addRes.json();

    return res.status(200).json({
      success: true,
      snapshot_id: addData.snapshot_id,
      playlist_id: playlistId,
      track_id: trackId,
      message: '¡Track añadido con éxito a la playlist de Spotify!'
    });
  } catch(err) {
    console.error('Error in spotify-add-track:', err);
    return res.status(500).json({ error: err.message });
  }
}
