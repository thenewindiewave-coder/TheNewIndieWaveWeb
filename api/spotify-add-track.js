// Serverless Function: /api/spotify-add-track
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

const PLAYLIST_ID_MAP = {
  // 8 Playlists Oficiales de Spotify (Nombres exactos en el perfil de Rodrigo)
  "Mezcla de rolas urbanas para farmear Aura": "79SKuyss3MfkzvOJGnaisB",
  "Darkwave oscuro y atmosférico para la madrugada": "4mcJJz8GiKTuxieL9Jziln",
  "Música urbana con flow y ritmo para moverte": "7bbYPZ5ia4IGRP2fT47kXr",
  "Metal intenso para liberar toda tu energía": "5OLiBaOPAe5cBEdV1AoSd1",
  "Rock para sacar la rabia y el enojo acumulado": "6cuhRpfYmEt0vYCT9mFLKc",
  "SoftSongs para esos domingos sin hacer nada": "20uF7xCOW8zldDCiAowxuF",
  "Dreamy Songs para escuchar en la intimidad de tu habitación": "0Ty7tTNh1ONGyOLuasPREj",
  "SynthPop para cuando solo quieres bailar": "36ribRboGB3DwM821oYokl",

  // Variantes compatibles y sin acentos
  "Soft Pop suave para esos domingos sin hacer nada": "20uF7xCOW8zldDCiAowxuF",
  "Soft Pop suave para domingos sin hacer nada": "20uF7xCOW8zldDCiAowxuF",
  "Pop indie suave para domingos sin hacer nada": "20uF7xCOW8zldDCiAowxuF",
  "Dream Pop intimo para escuchar solo en tu cuarto": "0Ty7tTNh1ONGyOLuasPREj",
  "Dream Pop íntimo para escuchar solo en tu cuarto": "0Ty7tTNh1ONGyOLuasPREj",
  "Dreamy Songs para escuchar en la intimidad de tu habitacion": "0Ty7tTNh1ONGyOLuasPREj",
  "Hard rock para sacar la rabia y el enojo acumulado": "6cuhRpfYmEt0vYCT9mFLKc",
  "Rock indie para manejar de noche sin rumbo": "6cuhRpfYmEt0vYCT9mFLKc",
  "Rock indie para cuando no puedes dormir y piensas demasiado": "0Ty7tTNh1ONGyOLuasPREj",
  "Rock indie sucio y crudo para sentirte rebelde": "6cuhRpfYmEt0vYCT9mFLKc",
  "Punk sucio y crudo para sentirte rebelde": "6cuhRpfYmEt0vYCT9mFLKc",
  "Pop indie para estar feliz y triste al mismo tiempo": "36ribRboGB3DwM821oYokl"
};

// Mapeo por palabras clave si el título varía
const KEYWORD_PLAYLIST_MAP = [
  { keys: ['aura'], id: '79SKuyss3MfkzvOJGnaisB', name: 'Mezcla de rolas urbanas para farmear Aura' },
  { keys: ['darkwave', 'madrugada'], id: '4mcJJz8GiKTuxieL9Jziln', name: 'Darkwave oscuro y atmosférico para la madrugada' },
  { keys: ['flow', 'ritmo', 'moverte'], id: '7bbYPZ5ia4IGRP2fT47kXr', name: 'Música urbana con flow y ritmo para moverte' },
  { keys: ['metal', 'energia', 'intenso'], id: '5OLiBaOPAe5cBEdV1AoSd1', name: 'Metal intenso para liberar toda tu energía' },
  { keys: ['rabia', 'enojo', 'acumulado'], id: '6cuhRpfYmEt0vYCT9mFLKc', name: 'Rock para sacar la rabia y el enojo acumulado' },
  { keys: ['softsongs', 'soft pop', 'domingos'], id: '20uF7xCOW8zldDCiAowxuF', name: 'SoftSongs para esos domingos sin hacer nada' },
  { keys: ['dreamy', 'cuarto', 'intimidad', 'habitacion', 'dream pop'], id: '0Ty7tTNh1ONGyOLuasPREj', name: 'Dreamy Songs para escuchar en la intimidad de tu habitación' },
  { keys: ['synthpop', 'bailar'], id: '36ribRboGB3DwM821oYokl', name: 'SynthPop para cuando solo quieres bailar' }
];

function parseSpotifyInput(input) {
  if (!input) return { type: null, id: null };
  const str = input.trim();

  // Track directo
  const trackMatch = str.match(/track[/:]([a-zA-Z0-9]{15,30})/);
  if (trackMatch) return { type: 'track', id: trackMatch[1] };

  // Álbum o Single
  const albumMatch = str.match(/album[/:]([a-zA-Z0-9]{15,30})/);
  if (albumMatch) return { type: 'album', id: albumMatch[1] };

  // ID directo
  if (/^[a-zA-Z0-9]{15,30}$/.test(str)) {
    return { type: 'track', id: str };
  }

  return { type: null, id: null };
}

async function fetchSupabaseRefreshToken() {
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
        return rows[0].short_bio.trim();
      }
    }
  } catch (e) {
    console.warn('Error al leer token de Supabase:', e.message);
  }
  return null;
}

async function refreshAccessToken(refreshToken) {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error('Error al refrescar token de Spotify: ' + errTxt);
  }

  const data = await res.json();
  return data.access_token;
}

async function resolveTrackId(parsed, songTitle, accessToken) {
  if (parsed.type === 'track') {
    return {
      trackId: parsed.id,
      trackUrl: `https://open.spotify.com/track/${parsed.id}`
    };
  }

  if (parsed.type === 'album') {
    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${parsed.id}/tracks?limit=50`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!albumRes.ok) {
      throw new Error('No se pudo acceder al contenido del álbum en Spotify (código ' + albumRes.status + ')');
    }

    const albumData = await albumRes.json();
    const tracks = albumData.items || [];
    if (tracks.length === 0) {
      throw new Error('El enlace de álbum de Spotify no contiene canciones disponibles.');
    }

    if (tracks.length === 1) {
      return {
        trackId: tracks[0].id,
        trackUrl: `https://open.spotify.com/track/${tracks[0].id}`
      };
    }

    // Si tiene varios tracks, intentar emparejar por título
    if (songTitle) {
      const normalize = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const normTitle = normalize(songTitle);
      const match = tracks.find(t => {
        const tNorm = normalize(t.name);
        return tNorm === normTitle || tNorm.includes(normTitle) || normTitle.includes(tNorm);
      });
      if (match) {
        return {
          trackId: match.id,
          trackUrl: `https://open.spotify.com/track/${match.id}`
        };
      }
    }

    // Fallback al primer track del álbum/sencillo
    return {
      trackId: tracks[0].id,
      trackUrl: `https://open.spotify.com/track/${tracks[0].id}`
    };
  }

  return { trackId: null, trackUrl: null };
}

function resolvePlaylistId(playlistInput) {
  if (!playlistInput) return null;
  const str = playlistInput.trim();

  // 1. Si es directamente un ID de 22 caracteres o URI/URL de playlist
  const plUrlMatch = str.match(/playlist[/:]([a-zA-Z0-9]{15,30})/);
  if (plUrlMatch) return plUrlMatch[1];
  if (/^[a-zA-Z0-9]{15,30}$/.test(str)) {
    return str;
  }

  // 2. Coincidencia exacta en el mapa
  if (PLAYLIST_ID_MAP[str]) {
    return PLAYLIST_ID_MAP[str];
  }

  // 3. Coincidencia normalizada sin acentos
  const normalize = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const normalizedInput = normalize(str);

  for (const [key, val] of Object.entries(PLAYLIST_ID_MAP)) {
    if (normalize(key) === normalizedInput) {
      return val;
    }
  }

  // 4. Coincidencia por palabras clave
  for (const item of KEYWORD_PLAYLIST_MAP) {
    if (item.keys.some(k => normalizedInput.includes(k))) {
      return item.id;
    }
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

  const { spotify_url, playlist_name, playlist_id, song_title, refresh_token } = req.body || {};

  if (!spotify_url) {
    return res.status(400).json({ error: 'Falta el enlace de Spotify de la canción.' });
  }

  // 1. Parsear enlace (track, album, o ID)
  const parsedSpotify = parseSpotifyInput(spotify_url);
  if (!parsedSpotify.id) {
    return res.status(400).json({
      error: 'El enlace de Spotify no es válido. Asegúrate de que sea un enlace a un Track o Álbum de Spotify.'
    });
  }

  // 2. Resolver Access Token fresco (con fallback garantizado a Supabase)
  let accessToken = null;
  let cleanRefreshToken = (refresh_token && refresh_token !== 'null' && refresh_token !== 'undefined' && refresh_token.trim())
    ? refresh_token.trim()
    : null;

  // Intentar primero con el token recibido o de entorno
  let tokenCandidate = cleanRefreshToken || process.env.SPOTIFY_REFRESH_TOKEN;
  let triedSupabase = false;

  if (!tokenCandidate) {
    tokenCandidate = await fetchSupabaseRefreshToken();
    triedSupabase = true;
  }

  if (tokenCandidate) {
    try {
      accessToken = await refreshAccessToken(tokenCandidate);
    } catch (errFirst) {
      console.warn('Fallo al refrescar token candidato:', errFirst.message);
      // Si falló y no habíamos probado el de Supabase, probar con Supabase ahora
      if (!triedSupabase) {
        const supabaseToken = await fetchSupabaseRefreshToken();
        if (supabaseToken && supabaseToken !== tokenCandidate) {
          try {
            accessToken = await refreshAccessToken(supabaseToken);
          } catch (errSupa) {
            console.error('Fallo también con el token de Supabase:', errSupa.message);
          }
        }
      }
    }
  }

  if (!accessToken) {
    return res.status(400).json({
      error: 'No se pudo autenticar con Spotify. Por favor haz clic en "Vincular Spotify" en el panel curador.',
      needs_auth: true
    });
  }

  try {
    // 3. Resolver ID final del track (si era un álbum, consultar y obtener track)
    const { trackId, trackUrl } = await resolveTrackId(parsedSpotify, song_title, accessToken);
    if (!trackId) {
      return res.status(400).json({ error: 'No se pudo resolver el ID del track en Spotify.' });
    }

    // 4. Resolver ID de la Playlist destino
    let resolvedPlaylistId = playlist_id ? resolvePlaylistId(playlist_id) : null;
    if (!resolvedPlaylistId && playlist_name) {
      resolvedPlaylistId = resolvePlaylistId(playlist_name);
    }

    // Si aún no se encuentra, buscar dinámicamente en /me/playlists del usuario
    if (!resolvedPlaylistId && playlist_name) {
      const normalize = s => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const normInput = normalize(playlist_name);
      let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
      while (nextUrl && !resolvedPlaylistId) {
        const plRes = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!plRes.ok) break;
        const plData = await plRes.json();
        for (const p of (plData.items || [])) {
          if (!p) continue;
          if (p.name === playlist_name || normalize(p.name) === normInput) {
            resolvedPlaylistId = p.id;
            break;
          }
        }
        nextUrl = plData.next;
      }
    }

    if (!resolvedPlaylistId) {
      return res.status(400).json({
        error: `No se reconoció la playlist destino "${playlist_name || playlist_id}". Selecciona una de las 8 playlists oficiales.`
      });
    }

    // 5. Insertar track físicamente en la playlist de Spotify
    const trackUri = `spotify:track:${trackId}`;
    let addRes = await fetch(`https://api.spotify.com/v1/playlists/${resolvedPlaylistId}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [trackUri]
      })
    });

    // Fallback al endpoint clásico /tracks si /items responde 404
    if (!addRes.ok && addRes.status === 404) {
      addRes = await fetch(`https://api.spotify.com/v1/playlists/${resolvedPlaylistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [trackUri]
        })
      });
    }

    if (!addRes.ok) {
      const addErr = await addRes.json().catch(() => ({}));
      const msg = (addErr.error && addErr.error.message) ? addErr.error.message : 'Error desconocido al añadir track';
      throw new Error(`Error de Spotify API (${addRes.status}): ${msg}`);
    }

    const addData = await addRes.json().catch(() => ({}));

    // Determinar nombre legible de la playlist
    let finalPlaylistName = playlist_name;
    for (const [name, id] of Object.entries(PLAYLIST_ID_MAP)) {
      if (id === resolvedPlaylistId) {
        finalPlaylistName = name;
        break;
      }
    }

    return res.status(200).json({
      success: true,
      snapshot_id: addData.snapshot_id,
      playlist_id: resolvedPlaylistId,
      playlist_name: finalPlaylistName,
      track_id: trackId,
      track_url: trackUrl,
      message: '¡Track añadido con éxito a la playlist de Spotify!'
    });

  } catch (err) {
    console.error('Error in spotify-add-track:', err);
    return res.status(500).json({
      error: err.message || 'Error interno al procesar la inserción en Spotify'
    });
  }
}
