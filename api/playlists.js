// Serverless Function para Vercel: /api/playlists
// Sincroniza automáticamente las playlists desde Spotify
// Si el usuario vinculó su cuenta, usa User OAuth para reflejar en vivo altas, bajas y cambios de nombre

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
const SPOTIFY_USER_ID = process.env.SPOTIFY_USER_ID || '31vxac7th7vonsgtzbeyixk32ftu';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

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

async function getClientCredentialsToken() {
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
    throw new Error('Error al autenticar con Spotify API (Client Credentials)');
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function getUserAccessToken(refreshToken) {
  if (!refreshToken) return null;
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  });

  if (!refreshRes.ok) {
    return null;
  }

  const tokenData = await refreshRes.json();
  return tokenData.access_token;
}

// Extrae géneros automáticamente de la descripción o título
function extractGenres(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
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
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  const cats = [];
  if (text.includes('metal') || text.includes('hard rock') || text.includes('grunge')) cats.push('heavy');
  if (text.includes('pop') || text.includes('bedroom') || text.includes('suave') || text.includes('cuarto')) cats.push('pop');
  if (text.includes('darkwave') || text.includes('post-punk') || text.includes('gothic') || text.includes('madrugada')) cats.push('darkwave');
  if (text.includes('urbano') || text.includes('trap') || text.includes('reggaetón') || text.includes('dembow') || text.includes('flow')) cats.push('urbano');
  if (text.includes('shoegaze') || text.includes('dream pop') || text.includes('slowcore')) cats.push('shoegaze');
  if (text.includes('folk') || text.includes('acoustic') || text.includes('acústico')) cats.push('folk');
  if (text.includes('punk') || text.includes('garage') || text.includes('garaje')) cats.push('punk');
  if (text.includes('synth') || text.includes('electronic') || text.includes('electrónica')) cats.push('electronic');
  if (cats.length === 0 || text.includes('rock') || text.includes('indie')) cats.push('rock');
  return cats.join(' ');
}

const FALLBACK_STATIC_PLAYLISTS = [
  { id: '2APaz3JDupY9fNUczoKMUP', name: 'Rock indie para manejar de noche sin rumbo', description: 'Curaduría oficial por The New Indie Wave.', followers: 2450, tracks_count: 50, spotify_url: 'https://open.spotify.com/playlist/2APaz3JDupY9fNUczoKMUP', category: 'rock', genres: ['Indie rock', 'Alternative', 'Post-punk'] },
  { id: '5gh1rPce7FnEENWk1POIse', name: 'Rock indie para cuando no puedes dormir y piensas demasiado', description: 'Curaduría oficial por The New Indie Wave.', followers: 1890, tracks_count: 45, spotify_url: 'https://open.spotify.com/playlist/5gh1rPce7FnEENWk1POIse', category: 'rock', genres: ['Indie rock', 'Slowcore', 'Dream pop'] },
  { id: '2QlvwB1vEhxQ4CM4jrbC8g', name: 'Rock indie sucio y crudo para sentirte rebelde', description: 'Curaduría oficial por The New Indie Wave.', followers: 1420, tracks_count: 40, spotify_url: 'https://open.spotify.com/playlist/2QlvwB1vEhxQ4CM4jrbC8g', category: 'rock', genres: ['Garage rock', 'Punk', 'Grunge'] },
  { id: '36ribRboGB3DwM821oYokl', name: 'Pop indie para estar feliz y triste al mismo tiempo', description: 'Curaduría oficial por The New Indie Wave.', followers: 1680, tracks_count: 48, spotify_url: 'https://open.spotify.com/playlist/36ribRboGB3DwM821oYokl', category: 'pop', genres: ['Indie pop', 'Bedroom pop'] },
  { id: '0Ty7tTNh1ONGyOLuasPREj', name: 'Pop indie íntimo para escuchar solo en tu cuarto', description: 'Curaduría oficial por The New Indie Wave.', followers: 1210, tracks_count: 38, spotify_url: 'https://open.spotify.com/playlist/0Ty7tTNh1ONGyOLuasPREj', category: 'pop', genres: ['Bedroom pop', 'Lo-fi', 'Acoustic'] },
  { id: '20uF7xCOW8zldDCiAowxuF', name: 'Pop indie suave para domingos sin hacer nada', description: 'Curaduría oficial por The New Indie Wave.', followers: 980, tracks_count: 35, spotify_url: 'https://open.spotify.com/playlist/20uF7xCOW8zldDCiAowxuF', category: 'pop', genres: ['Chillwave', 'Acoustic', 'Folk pop'] },
  { id: '6cuhRpfYmEt0vYCT9mFLKc', name: 'Hard rock para sacar la rabia y el enojo acumulado', description: 'Curaduría oficial por The New Indie Wave.', followers: 850, tracks_count: 42, spotify_url: 'https://open.spotify.com/playlist/6cuhRpfYmEt0vYCT9mFLKc', category: 'heavy', genres: ['Hard rock', 'Alternative metal'] },
  { id: '5OLiBaOPAe5cBEdV1AoSd1', name: 'Metal intenso para liberar toda tu energía', description: 'Curaduría oficial por The New Indie Wave.', followers: 790, tracks_count: 36, spotify_url: 'https://open.spotify.com/playlist/5OLiBaOPAe5cBEdV1AoSd1', category: 'heavy', genres: ['Metal', 'Metalcore', 'Hardcore'] },
  { id: '7bbYPZ5ia4IGRP2fT47kXr', name: 'Música urbana con flow y ritmo para moverte', description: 'Curaduría oficial por The New Indie Wave.', followers: 640, tracks_count: 30, spotify_url: 'https://open.spotify.com/playlist/7bbYPZ5ia4IGRP2fT47kXr', category: 'urbano', genres: ['Urbano', 'Trap', 'Flow'] },
  { id: '4mcJJz8GiKTuxieL9Jziln', name: 'Darkwave oscuro y atmosférico para la madrugada', description: 'Curaduría oficial por The New Indie Wave.', followers: 1150, tracks_count: 40, spotify_url: 'https://open.spotify.com/playlist/4mcJJz8GiKTuxieL9Jziln', category: 'darkwave', genres: ['Darkwave', 'Synthwave', 'Post-punk'] }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120'); // Cache corto de 1 min para reflejar cambios

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { refresh_token: queryRefreshToken } = req.query || {};
    let rToken = queryRefreshToken || process.env.SPOTIFY_REFRESH_TOKEN;

    // Si no viene en query, buscar refresh_token en Supabase
    if (!rToken) {
      try {
        const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/radar_artists?id=eq.spotify_auth_config&select=short_bio`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (dbRes.ok) {
          const rows = await dbRes.json();
          if (rows && rows.length > 0 && rows[0].short_bio) {
            rToken = rows[0].short_bio;
          }
        }
      } catch (dbErr) {
        console.warn('Supabase token read error (falling back):', dbErr.message);
      }
    }

    let userAccessToken = null;
    if (rToken) {
      try {
        userAccessToken = await getUserAccessToken(rToken);
      } catch (tokErr) {
        console.warn('Could not refresh user token:', tokErr.message);
      }
    }

    let rawPlaylists = [];
    let activeToken = userAccessToken;

    // 1. Si tenemos token de usuario, consultar /v1/me/playlists (obtiene en vivo todas las playlists actuales de Rodrigo)
    if (userAccessToken) {
      try {
        const mePlaylistsRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
          headers: { 'Authorization': `Bearer ${userAccessToken}` }
        });
        if (mePlaylistsRes.ok) {
          const meData = await mePlaylistsRes.json();
          if (meData.items && meData.items.length > 0) {
            rawPlaylists = meData.items;
          }
        }
      } catch (meErr) {
        console.warn('Error fetching user /me/playlists:', meErr.message);
      }
    }

    // 2. Si no obtuvimos playlists del usuario, intentar vía Client Credentials
    if (rawPlaylists.length === 0) {
      try {
        const clientToken = await getClientCredentialsToken();
        activeToken = clientToken;

        const userRes = await fetch(`https://api.spotify.com/v1/users/${SPOTIFY_USER_ID}/playlists?limit=50`, {
          headers: { 'Authorization': `Bearer ${clientToken}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.items && userData.items.length > 0) {
            rawPlaylists = userData.items;
          }
        }
      } catch (uErr) {
        console.warn('Error fetching public user playlists:', uErr.message);
      }
    }

    // 3. Si aún no hay playlists, usar la lista de IDs de respaldo
    let finalPlaylistItems = [];

    if (rawPlaylists.length > 0) {
      // Mapear y obtener seguidores reales si no vienen en la lista
      const detailPromises = rawPlaylists.map(async (p) => {
        if (!p || !p.id) return null;
        let followers = (p.followers && typeof p.followers.total === 'number') ? p.followers.total : null;
        let imageUrl = (p.images && p.images.length > 0) ? p.images[0].url : null;
        let tracksCount = (p.tracks && typeof p.tracks.total === 'number') ? p.tracks.total : 0;

        // Si falta seguidores o imagen, consultar detalle
        if (followers === null && activeToken) {
          try {
            const detailRes = await fetch(`https://api.spotify.com/v1/playlists/${p.id}?fields=followers,images,tracks.total`, {
              headers: { 'Authorization': `Bearer ${activeToken}` }
            });
            if (detailRes.ok) {
              const dData = await detailRes.json();
              if (dData.followers) followers = dData.followers.total;
              if (dData.images && dData.images.length > 0) imageUrl = dData.images[0].url;
              if (dData.tracks) tracksCount = dData.tracks.total;
            }
          } catch(e) {}
        }

        return {
          id: p.id,
          name: p.name || 'Playlist The New Indie Wave',
          description: p.description || '',
          followers: followers || 0,
          tracks_count: tracksCount,
          image: imageUrl,
          spotify_url: (p.external_urls && p.external_urls.spotify) ? p.external_urls.spotify : `https://open.spotify.com/playlist/${p.id}`,
          category: detectCategory(p.name, p.description),
          genres: extractGenres(p.name, p.description)
        };
      });

      finalPlaylistItems = (await Promise.all(detailPromises)).filter(Boolean);
    } else {
      // Fallback a IDs conocidos
      try {
        const clientToken = activeToken || await getClientCredentialsToken();
        const fallbackPromises = FALLBACK_PLAYLIST_IDS.map(async (pId) => {
          try {
            const pRes = await fetch(`https://api.spotify.com/v1/playlists/${pId}?fields=id,name,description,followers,images,tracks.total,external_urls`, {
              headers: { 'Authorization': `Bearer ${clientToken}` }
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
          } catch (e) {}
          return null;
        });
        finalPlaylistItems = (await Promise.all(fallbackPromises)).filter(Boolean);
      } catch (fbErr) {}
    }

    if (finalPlaylistItems.length === 0) {
      finalPlaylistItems = FALLBACK_STATIC_PLAYLISTS;
    }

    // 4. Ordenar de mayor a menor según seguidores reales (o tracks)
    const sortedPlaylists = [...finalPlaylistItems].sort((a, b) => (b.followers - a.followers) || (b.tracks_count - a.tracks_count));

    // 5. Los primeros 3 son el Top del Momento
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
    console.error('Playlists API graceful fallback:', error);
    return res.status(200).json({
      success: true,
      fallback: true,
      user_id: SPOTIFY_USER_ID,
      total: FALLBACK_STATIC_PLAYLISTS.length,
      updated_at: new Date().toISOString(),
      topPlaylists: FALLBACK_STATIC_PLAYLISTS.slice(0, 3),
      allPlaylists: FALLBACK_STATIC_PLAYLISTS
    });
  }
}
