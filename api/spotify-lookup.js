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

  if (!res.ok) throw new Error('Error al obtener token de Spotify');
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, id } = req.query || {};
  let trackId = id;

  if (!trackId && url) {
    // Extraer ID de cualquier formato de URL (incluyendo /intl-es/, ?si=, spotify:track:, etc.)
    const match = url.match(/track\/([a-zA-Z0-9]{22})/) || url.match(/spotify:track:([a-zA-Z0-9]{22})/);
    if (match) trackId = match[1];
  }

  if (!trackId) {
    return res.status(400).json({ error: 'No se encontró un ID de track de Spotify válido.' });
  }

  try {
    const token = await getAccessToken();
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!trackRes.ok) {
      return res.status(404).json({ error: 'Canción no encontrada en Spotify.' });
    }

    const track = await trackRes.json();
    const title = track.name;
    const artist = track.artists.map(a => a.name).join(', ');
    const cover = (track.album && track.album.images && track.album.images.length > 0)
      ? track.album.images[0].url
      : '';
    const spotify_url = track.external_urls ? track.external_urls.spotify : `https://open.spotify.com/track/${trackId}`;

    return res.status(200).json({
      success: true,
      track_id: trackId,
      title,
      artist,
      cover,
      spotify_url,
      preview_url: track.preview_url
    });
  } catch (err) {
    console.error('Spotify Lookup Error:', err);
    return res.status(500).json({ error: 'Error al consultar Spotify API' });
  }
};
