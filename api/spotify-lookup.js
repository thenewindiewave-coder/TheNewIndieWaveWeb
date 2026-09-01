// Serverless Function para Vercel: /api/spotify-lookup
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    throw new Error('Error al obtener token de Spotify');
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, id, type } = req.query || {};
  let targetId = id;
  let isPlaylist = type === 'playlist';

  if (!targetId && url) {
    const raw = url.trim();
    if (raw.includes('playlist/')) {
      isPlaylist = true;
      targetId = raw.split('playlist/')[1].split('?')[0].split('&')[0].split('/')[0];
    } else if (raw.includes('spotify:playlist:')) {
      isPlaylist = true;
      targetId = raw.split('spotify:playlist:')[1].split('?')[0];
    } else if (raw.includes('track/')) {
      isPlaylist = false;
      targetId = raw.split('track/')[1].split('?')[0].split('&')[0].split('/')[0];
    } else if (raw.includes('spotify:track:')) {
      isPlaylist = false;
      targetId = raw.split('spotify:track:')[1].split('?')[0];
    } else {
      targetId = raw;
    }
  }

  if (targetId) {
    targetId = targetId.split('?')[0].split('&')[0].split('/')[0].trim();
  }

  if (!targetId) {
    return res.status(400).json({ error: 'No se encontró un enlace o ID de Spotify válido.' });
  }

  try {
    const token = await getAccessToken();

    // 1. Manejo de Playlists
    if (isPlaylist) {
      const pRes = await fetch(`https://api.spotify.com/v1/playlists/${targetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!pRes.ok) {
        return res.status(404).json({ error: 'Playlist no encontrada en Spotify.' });
      }

      const pData = await pRes.json();
      const title = pData.name;
      const description = pData.description || '';
      const cover = (pData.images && pData.images.length > 0) ? pData.images[0].url : '';
      const spotify_url = pData.external_urls ? pData.external_urls.spotify : `https://open.spotify.com/playlist/${targetId}`;

      return res.status(200).json({
        success: true,
        type: 'playlist',
        playlist_id: targetId,
        title,
        description,
        cover,
        spotify_url,
        followers: pData.followers ? pData.followers.total : 0,
        tracks_total: pData.tracks ? pData.tracks.total : 0
      });
    }

    // 2. Manejo de Tracks
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${targetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!trackRes.ok) {
      return res.status(404).json({ error: 'Canción no encontrada en Spotify.' });
    }

    const track = await trackRes.json();
    const title = track.name;
    const artist = track.artists ? track.artists.map(a => a.name).join(', ') : 'Artista Desconocido';
    const cover = (track.album && track.album.images && track.album.images.length > 0)
      ? track.album.images[0].url
      : '';
    const spotify_url = track.external_urls ? track.external_urls.spotify : `https://open.spotify.com/track/${targetId}`;

    return res.status(200).json({
      success: true,
      type: 'track',
      track_id: targetId,
      title,
      artist,
      cover,
      spotify_url,
      preview_url: track.preview_url
    });
  } catch (err) {
    console.error('Spotify Lookup Error:', err);
    return res.status(500).json({ error: 'Error al consultar Spotify API: ' + err.message });
  }
}
