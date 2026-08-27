// Serverless Function para Vercel: /api/playlists
// Obtiene automáticamente las playlists de Spotify, consulta sus seguidores reales
// y las ordena para determinar el "Top Playlists del Momento"

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';

// Lista de IDs oficiales de playlists del colectivo
const PLAYLIST_IDS = [
  { id: '2APaz3JDupY9fNUczoKMUP', category: 'rock', defaultName: 'Rock indie para manejar de noche sin rumbo', genres: ['Indie rock', 'Alternative', 'Post-punk', 'Shoegaze', 'Britpop'] },
  { id: '5gh1rPce7FnEENWk1POIse', category: 'rock', defaultName: 'Rock indie para cuando no puedes dormir y piensas demasiado', genres: ['Indie rock', 'Slowcore', 'Dream pop', 'Ambient', 'Sadcore'] },
  { id: '2QlvwB1vEhxQ4CM4jrbC8g', category: 'rock', defaultName: 'Rock indie sucio y crudo para sentirte rebelde', genres: ['Garage rock', 'Punk', 'Lo-fi rock', 'Grunge', 'Noise rock'] },
  { id: '36ribRboGB3DwM821oYokl', category: 'pop', defaultName: 'Pop indie para estar feliz y triste al mismo tiempo', genres: ['Indie pop', 'Bedroom pop', 'Dream pop', 'Twee pop', 'Sadpop'] },
  { id: '0Ty7tTNh1ONGyOLuasPREj', category: 'pop', defaultName: 'Pop indie íntimo para escuchar solo en tu cuarto', genres: ['Bedroom pop', 'Lo-fi', 'Singer-songwriter', 'Acoustic', 'Folk'] },
  { id: '20uF7xCOW8zldDCiAowxuF', category: 'pop', defaultName: 'Pop indie suave para domingos sin hacer nada', genres: ['Indie pop', 'Chillwave', 'Acoustic', 'Folk pop', 'Soft rock'] },
  { id: '6cuhRpfYmEt0vYCT9mFLKc', category: 'heavy', defaultName: 'Hard rock para sacar la rabia y el enojo acumulado', genres: ['Hard rock', 'Alternative metal', 'Grunge', 'Nu metal', 'Stoner'] },
  { id: '5OLiBaOPAe5cBEdV1AoSd1', category: 'heavy', defaultName: 'Metal intenso para liberar toda tu energía', genres: ['Metal', 'Metalcore', 'Hardcore', 'Thrash metal', 'Death metal'] },
  { id: '7bbYPZ5ia4IGRP2fT47kXr', category: 'vibes', defaultName: 'Música urbana con flow y ritmo para moverte', genres: ['Urbano', 'Trap', 'Dembow', 'Latin trap', 'Afrobeat'] },
  { id: '4mcJJz8GiKTuxieL9Jziln', category: 'vibes', defaultName: 'Darkwave oscuro y atmosférico para la madrugada', genres: ['Darkwave', 'Synthwave', 'Post-punk', 'Coldwave', 'Industrial'] }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200'); // Cache 10 min

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    // Consultar cada playlist en paralelo para obtener seguidores en tiempo real
    const playlistPromises = PLAYLIST_IDS.map(async (meta) => {
      try {
        const pRes = await fetch(`https://api.spotify.com/v1/playlists/${meta.id}?fields=id,name,description,followers,images,tracks.total,external_urls`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (pRes.ok) {
          const data = await pRes.json();
          return {
            id: meta.id,
            name: data.name || meta.defaultName,
            description: data.description || '',
            followers: data.followers ? data.followers.total : 0,
            tracks_count: data.tracks ? data.tracks.total : 0,
            image: (data.images && data.images.length > 0) ? data.images[0].url : null,
            spotify_url: data.external_urls ? data.external_urls.spotify : `https://open.spotify.com/playlist/${meta.id}`,
            category: meta.category,
            genres: meta.genres
          };
        }
      } catch (e) {
        console.error(`Error fetching playlist ${meta.id}:`, e);
      }

      // Fallback
      return {
        id: meta.id,
        name: meta.defaultName,
        description: '',
        followers: 0,
        tracks_count: 0,
        category: meta.category,
        genres: meta.genres
      };
    });

    const results = await Promise.all(playlistPromises);

    // Ordenar de mayor a menor número de seguidores
    const sortedPlaylists = [...results].sort((a, b) => b.followers - a.followers);

    // Los primeros 3 son el Top del Momento
    const topPlaylists = sortedPlaylists.slice(0, 3);

    return res.status(200).json({
      success: true,
      updated_at: new Date().toISOString(),
      topPlaylists,
      allPlaylists: sortedPlaylists
    });

  } catch (error) {
    console.error('Playlists API Error:', error);
    // Fallback estático
    return res.status(200).json({
      success: false,
      topPlaylists: PLAYLIST_IDS.slice(0, 3),
      allPlaylists: PLAYLIST_IDS
    });
  }
}
