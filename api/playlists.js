// Serverless Function para Vercel: /api/playlists
// Sincroniza automáticamente las playlists desde el perfil de Spotify de Rodrigo
// Perfil: https://open.spotify.com/user/31vxac7th7vonsgtzbeyixk32ftu

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
const SPOTIFY_USER_ID = process.env.SPOTIFY_USER_ID || '31vxac7th7vonsgtzbeyixk32ftu';

// Playlists fijas por defecto (como respaldo seguro)
const FALLBACK_PLAYLIST_IDS = [
  '2APaz3JDupY9fNUczoKMUP',
  '5gh1rPce7FnEENWk1POIse',
  '2QlvwB1vEhxQ4CM4jrbC8g',
  '36ribRboGB3DwM821oYokl',
  '0Ty7tTNh1ONGyOLuasPREj',
  '20uF7xCOW8zldDCiAowxuF',
  '6cuhRpfYmEt0vYCT9mFLKc',
  '5OLiBaOPAe5cBEdV1AoSd1',
  '7bbYPZ5ia4IGRP2fT47kXr',
  '4mcJJz8GiKTuxieL9Jziln'
];

async function getSpotifyAccessToken() {
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenRes.ok) {
    throw new Error('Error al autenticar con Spotify API');
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Extrae géneros automáticamente de la descripción o título
function extractGenres(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  const found = [];

  const commonGenres = [
    'indie rock', 'alternative', 'post-punk', 'shoegaze', 'britpop',
    'slowcore', 'dream pop', 'ambient', 'sadcore', 'emo',
    'garage rock', 'punk', 'lo-fi rock', 'grunge', 'noise rock',
    'bedroom pop', 'twee pop', 'chamber pop', 'sadpop', 'folk',
    'chillwave', 'acoustic', 'folk pop', 'soft rock',
    'hard rock', 'alternative metal', 'nu metal', 'stoner',
    'metalcore', 'hardcore', 'thrash metal', 'death metal', 'metal',
    'urbano', 'reggaetón', 'trap', 'dembow', 'latin trap', 'afrobeat',
    'darkwave', 'synthwave', 'coldwave', 'gothic rock', 'industrial'
  ];

  for (const g of commonGenres) {
    if (text.includes(g) && !found.includes(g)) {
      found.push(g.charAt(0).toUpperCase() + g.slice(1));
    }
  }

  return found.length > 0 ? found.slice(0, 5) : ['Indie', 'Alternative'];
}

function detectCategory(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  const cats = [];
  if (text.includes('metal') || text.includes('hard rock') || text.includes('grunge')) cats.push('heavy');
  if (text.includes('pop') || text.includes('bedroom') || text.includes('suave')) cats.push('pop');
  if (text.includes('darkwave') || text.includes('post-punk') || text.includes('gothic')) cats.push('darkwave');
  if (text.includes('urbano') || text.includes('trap') || text.includes('reggaetón') || text.includes('dembow')) cats.push('urbano');
  if (text.includes('shoegaze') || text.includes('dream pop') || text.includes('slowcore')) cats.push('shoegaze');
  if (text.includes('folk') || text.includes('acoustic') || text.includes('acústico')) cats.push('folk');
  if (text.includes('punk') || text.includes('garage') || text.includes('garaje')) cats.push('punk');
  if (text.includes('synth') || text.includes('electronic') || text.includes('electrónica')) cats.push('electronic');
  if (cats.length === 0 || text.includes('rock') || text.includes('indie')) cats.push('rock');
  return cats.join(' ');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200'); // 10 min cache

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    // 1. Intentar consultar las playlists públicas del usuario de Spotify
    let targetIds = [];
    try {
      const userRes = await fetch(`https://api.spotify.com/v1/users/${SPOTIFY_USER_ID}/playlists?limit=50`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.items && userData.items.length > 0) {
          targetIds = userData.items.map(p => p.id);
        }
      }
    } catch (e) {
      console.error('Error fetching user playlists:', e);
    }

    // Si la llamada al usuario no trajo IDs, usamos la lista de respaldo
    if (targetIds.length === 0) {
      targetIds = FALLBACK_PLAYLIST_IDS;
    }

    // 2. Consultar detalles y seguidores reales de cada playlist
    const playlistPromises = targetIds.map(async (pId) => {
      try {
        const pRes = await fetch(`https://api.spotify.com/v1/playlists/${pId}?fields=id,name,description,followers,images,tracks.total,external_urls`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (pRes.ok) {
          const data = await pRes.json();
          return {
            id: data.id,
            name: data.name || 'Playlist The New Indie Wave',
            description: data.description || '',
            followers: data.followers ? data.followers.total : 0,
            tracks_count: data.tracks ? data.tracks.total : 0,
            image: (data.images && data.images.length > 0) ? data.images[0].url : null,
            spotify_url: data.external_urls ? data.external_urls.spotify : `https://open.spotify.com/playlist/${data.id}`,
            category: detectCategory(data.name, data.description),
            genres: extractGenres(data.name, data.description)
          };
        }
      } catch (e) {
        console.error(`Error fetching details for ${pId}:`, e);
      }
      return null;
    });

    const results = (await Promise.all(playlistPromises)).filter(Boolean);

    // 3. Ordenar de mayor a menor según seguidores reales
    const sortedPlaylists = [...results].sort((a, b) => b.followers - a.followers);

    // 4. Los primeros 3 son el Top del Momento
    const topPlaylists = sortedPlaylists.slice(0, 3);

    return res.status(200).json({
      success: true,
      user_id: SPOTIFY_USER_ID,
      total: sortedPlaylists.length,
      updated_at: new Date().toISOString(),
      topPlaylists,
      allPlaylists: sortedPlaylists
    });

  } catch (error) {
    console.error('Playlists API error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
