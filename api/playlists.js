// Serverless Function para Vercel: /api/playlists
// Sincroniza automáticamente las playlists desde Spotify
// Si el usuario vinculó su cuenta, usa User OAuth para reflejar en vivo altas, bajas y cambios de nombre

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
const SPOTIFY_USER_ID = process.env.SPOTIFY_USER_ID || '31vxac7th7vonsgtzbeyixk32ftu';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

const FALLBACK_PLAYLIST_IDS = [
  '56UTFQQSDPuY5cjxDol5Ob',
  '79SKuyss3MfkzvOJGnaisB',
  '4mcJJz8GiKTuxieL9Jziln',
  '7bbYPZ5ia4IGRP2fT47kXr',
  '5OLiBaOPAe5cBEdV1AoSd1',
  '6cuhRpfYmEt0vYCT9mFLKc',
  '20uF7xCOW8zldDCiAowxuF',
  '0Ty7tTNh1ONGyOLuasPREj',
  '36ribRboGB3DwM821oYokl'
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
    'urbano', 'reggaetón', 'reggaeton', 'trap', 'dembow', 'latin trap', 'afrobeat',
    'funk', 'disco', 'pop punk', 'soul', 'r&b',
    'corridos tumbados', 'regional mexicano', 'regional urbano',
    'darkwave', 'synthwave', 'coldwave', 'gothic rock', 'industrial',
    'synthpop', 'indie pop', 'dance pop', 'nu disco'
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
  if (text.includes('metal') || text.includes('hard rock') || text.includes('grunge') || text.includes('rabia')) cats.push('heavy');
  if (text.includes('pop') || text.includes('bedroom') || text.includes('suave') || text.includes('cuarto')) cats.push('pop');
  if (text.includes('darkwave') || text.includes('post-punk') || text.includes('gothic') || text.includes('madrugada')) cats.push('darkwave');
  if (text.includes('urbano') || text.includes('trap') || text.includes('reggaetón') || text.includes('dembow') || text.includes('flow') || text.includes('aura')) cats.push('urbano');
  if (text.includes('shoegaze') || text.includes('dream pop') || text.includes('slowcore')) cats.push('shoegaze');
  if (text.includes('folk') || text.includes('acoustic') || text.includes('acústico')) cats.push('folk');
  if (text.includes('punk') || text.includes('garage') || text.includes('garaje')) cats.push('punk');
  if (text.includes('synth') || text.includes('electronic') || text.includes('electrónica') || text.includes('bailar')) cats.push('electronic');
  if (cats.length === 0 || text.includes('rock') || text.includes('indie')) cats.push('rock');
  return cats.join(' ');
}

const FALLBACK_STATIC_PLAYLISTS = [
  { id: '56UTFQQSDPuY5cjxDol5Ob', name: 'Electrónica emergente para perder el control en la pista', description: 'Sonidos sintéticos fuera del radar. Beats emergentes, vanguardia y producciones independientes que van del Indie Dance, IDM y Electronica hasta el Synthwave y Melodic Techno. Dale play y descubre el futuro. THE NEW INDIE WAVE!', followers: 0, tracks_count: 0, spotify_url: 'https://open.spotify.com/playlist/56UTFQQSDPuY5cjxDol5Ob', category: 'electronic', genres: ['Indie Dance', 'IDM', 'Electronica', 'Melodic Techno', 'Synthwave'] },
  { id: '79SKuyss3MfkzvOJGnaisB', name: 'Mezcla de rolas urbanas para farmear Aura', description: 'Ritmos de asfalto, humo y cantina. Curada por The New Indie Wave.', followers: 1450, tracks_count: 25, spotify_url: 'https://open.spotify.com/playlist/79SKuyss3MfkzvOJGnaisB', category: 'urbano', genres: ['Urbano', 'Rap', 'Reggae', 'Latino'] },
  { id: '4mcJJz8GiKTuxieL9Jziln', name: 'Darkwave oscuro y atmosférico para la madrugada', description: 'Sintetizadores fríos y una ciudad que respira distinto. Curada por The New Indie Wave.', followers: 1650, tracks_count: 60, spotify_url: 'https://open.spotify.com/playlist/4mcJJz8GiKTuxieL9Jziln', category: 'darkwave', genres: ['Darkwave', 'Synthwave', 'Post-punk', 'Coldwave'] },
  { id: '7bbYPZ5ia4IGRP2fT47kXr', name: 'Música urbana con flow y ritmo para moverte', description: 'El beat que te levanta del sillón antes de que decidas si querías bailar o no.', followers: 1200, tracks_count: 48, spotify_url: 'https://open.spotify.com/playlist/7bbYPZ5ia4IGRP2fT47kXr', category: 'urbano', genres: ['Urbano', 'Trap', 'Reggaetón', 'Flow'] },
  { id: '5OLiBaOPAe5cBEdV1AoSd1', name: 'Metal intenso para liberar toda tu energía', description: 'Sin freno, sin disculpas, la descarga que necesitas cuando el día te queda chico.', followers: 1380, tracks_count: 52, spotify_url: 'https://open.spotify.com/playlist/5OLiBaOPAe5cBEdV1AoSd1', category: 'heavy', genres: ['Metal', 'Metalcore', 'Hardcore', 'Thrash metal'] },
  { id: '6cuhRpfYmEt0vYCT9mFLKc', name: 'Rock para sacar la rabia y el enojo acumulado', description: 'Cuando las palabras no alcanzan, los riffs sí dicen todo lo que traes por dentro.', followers: 1850, tracks_count: 60, spotify_url: 'https://open.spotify.com/playlist/6cuhRpfYmEt0vYCT9mFLKc', category: 'heavy rock', genres: ['Hard rock', 'Grunge', 'Alternative metal'] },
  { id: '20uF7xCOW8zldDCiAowxuF', name: 'SoftSongs para esos domingos sin hacer nada', description: 'Café que se enfría, cobijas que no se quitan, y planes que se posponen para mañana.', followers: 1520, tracks_count: 47, spotify_url: 'https://open.spotify.com/playlist/20uF7xCOW8zldDCiAowxuF', category: 'pop', genres: ['Indie pop', 'Chillwave', 'Acoustic', 'Folk pop'] },
  { id: '0Ty7tTNh1ONGyOLuasPREj', name: 'Dreamy Songs para escuchar en la intimidad de tu habitación', description: 'Como si alguien te cantara al oído, solo para ti, con la puerta cerrada.', followers: 1730, tracks_count: 45, spotify_url: 'https://open.spotify.com/playlist/0Ty7tTNh1ONGyOLuasPREj', category: 'pop shoegaze', genres: ['Dream pop', 'Bedroom pop', 'Lo-fi'] },
  { id: '36ribRboGB3DwM821oYokl', name: 'SynthPop para cuando solo quieres bailar', description: 'Cuando el indie se encuentra con la pista de bailar. Synths, bajos profundos y ritmos irresistibles.', followers: 1980, tracks_count: 59, spotify_url: 'https://open.spotify.com/playlist/36ribRboGB3DwM821oYokl', category: 'pop electronic', genres: ['Synthpop', 'Indie dance', 'Nu disco'] }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30'); // Cache corto para reflejar cambios

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { refresh_token: queryRefreshToken } = req.query || {};
    let rToken = queryRefreshToken || process.env.SPOTIFY_REFRESH_TOKEN;
    let targetOwnerId = SPOTIFY_USER_ID;

    // Si no viene en query, buscar refresh_token en Supabase
    if (!rToken) {
      try {
        const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/radar_artists?id=eq.spotify_auth_config&select=short_bio,city`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (dbRes.ok) {
          const rows = await dbRes.json();
          if (rows && rows.length > 0) {
            if (rows[0].short_bio) rToken = rows[0].short_bio;
            if (rows[0].city) targetOwnerId = rows[0].city;
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

    // Si tenemos token de usuario, obtener el ID verificado de la cuenta conectada (/v1/me)
    if (userAccessToken) {
      try {
        const meRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${userAccessToken}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData && meData.id) {
            targetOwnerId = meData.id;
          }
        }
      } catch (meProfileErr) {
        console.warn('Could not fetch user /me profile:', meProfileErr.message);
      }
    }

    let rawPlaylists = [];
    let activeToken = userAccessToken;

    // 1. Si tenemos token de usuario, paginar /v1/me/playlists para obtener todas las listas de la cuenta
    if (userAccessToken) {
      try {
        let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
        let pageCount = 0;
        while (nextUrl && pageCount < 5) {
          pageCount++;
          const mePlaylistsRes = await fetch(nextUrl, {
            headers: { 'Authorization': `Bearer ${userAccessToken}` }
          });
          if (!mePlaylistsRes.ok) break;
          const meData = await mePlaylistsRes.json();
          if (meData.items && meData.items.length > 0) {
            rawPlaylists = rawPlaylists.concat(meData.items);
          }
          nextUrl = meData.next;
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

    // FILTRO ESTRICTO: SOLO playlists creadas por Rodrigo (donde el usuario es OWNER).
    // Se excluyen 100% las playlists de terceros que el usuario simplemente sigue en Spotify.
    const ownedPlaylists = rawPlaylists.filter(p => {
      if (!p || !p.owner) return false;
      const pOwnerId = String(p.owner.id || '').trim().toLowerCase();
      const targetId = String(targetOwnerId || SPOTIFY_USER_ID).trim().toLowerCase();
      const officialId = '31vxac7th7vonsgtzbeyixk32ftu';
      return pOwnerId === targetId || pOwnerId === officialId;
    });

    // 3. Procesar las playlists propias obtenidas o recurrir a respaldo oficial de IDs
    let finalPlaylistItems = [];

    if (ownedPlaylists.length > 0) {
      // Mapear y obtener seguidores reales si no vienen en la lista
      const detailPromises = ownedPlaylists.map(async (p) => {
        if (!p || !p.id) return null;
        let followers = (p.followers && typeof p.followers.total === 'number') ? p.followers.total : null;
        let imageUrl = (p.images && p.images.length > 0) ? p.images[0].url : null;
        let tracksCount = (p.tracks && typeof p.tracks.total === 'number') ? p.tracks.total : (p.items && typeof p.items.total === 'number' ? p.items.total : 0);

        // Si falta seguidores o imagen, consultar detalle
        if (followers === null && activeToken) {
          try {
            const detailRes = await fetch(`https://api.spotify.com/v1/playlists/${p.id}?fields=followers,images`, {
              headers: { 'Authorization': `Bearer ${activeToken}` }
            });
            if (detailRes.ok) {
              const dData = await detailRes.json();
              if (dData.followers && typeof dData.followers.total === 'number') followers = dData.followers.total;
              if (dData.images && dData.images.length > 0) imageUrl = dData.images[0].url;
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
          genres: extractGenres(p.name, p.description),
          owner_id: p.owner ? p.owner.id : null,
          is_owner: true
        };
      });

      finalPlaylistItems = (await Promise.all(detailPromises)).filter(Boolean);
    } else {
      // Fallback a IDs oficiales de Rodrigo
      try {
        const clientToken = activeToken || await getClientCredentialsToken();
        const fallbackPromises = FALLBACK_PLAYLIST_IDS.map(async (pId) => {
          try {
            const pRes = await fetch(`https://api.spotify.com/v1/playlists/${pId}?fields=id,name,description,followers,images,external_urls`, {
              headers: { 'Authorization': `Bearer ${clientToken}` }
            });
            if (pRes.ok) {
              const data = await pRes.json();
              return {
                id: data.id,
                name: data.name || 'Playlist The New Indie Wave',
                description: data.description || '',
                followers: data.followers ? data.followers.total : 0,
                tracks_count: 50,
                image: (data.images && data.images.length > 0) ? data.images[0].url : null,
                spotify_url: data.external_urls ? data.external_urls.spotify : `https://open.spotify.com/playlist/${data.id}`,
                category: detectCategory(data.name, data.description),
                genres: extractGenres(data.name, data.description),
                is_owner: true
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
      user_id: targetOwnerId || SPOTIFY_USER_ID,
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
