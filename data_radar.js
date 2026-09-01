var SUPABASE_URL = 'https://bsmnzbdnffdxxveyifmc.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

async function syncRadarFromSupabase() {
  try {
    var res = await fetch(SUPABASE_URL + '/rest/v1/radar_artists?select=*', {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    });
    if (res.ok) {
      var data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        var cleanList = data.map(function(item) {
          if (item.other_url && item.other_url.startsWith('{')) {
            try {
              var parsed = JSON.parse(item.other_url);
              if (parsed.career_notes) item.career_notes = parsed.career_notes;
              if (parsed.events_note) item.events_note = parsed.events_note;
              if (parsed.facebook_url) item.facebook_url = parsed.facebook_url;
              if (parsed.order !== undefined && parsed.order !== null && !isNaN(parsed.order)) {
                item.order = parseInt(parsed.order, 10);
              }
            } catch(e) {}
          }
          if (item.order === undefined || item.order === null || isNaN(item.order)) {
            var match = (item.id || '').match(/radar-(\d+)/);
            item.order = match ? parseInt(match[1], 10) : 999;
          }
          return item;
        });

        // Ordenamiento determinista y fijo según la posición guardada
        cleanList.sort(function(a, b) {
          return (parseInt(a.order, 10) || 999) - (parseInt(b.order, 10) || 999);
        });

        localStorage.setItem('tniw_radar_artists', JSON.stringify(cleanList));
        if (typeof window !== 'undefined') {
          window.RADAR_ARTISTS = cleanList.filter(function(a){ return a && a.id !== 'spotify_auth_config' && a.type !== 'config'; });
        }
        return cleanList;
      }
    }
  } catch(e) {}
  return null;
}

async function saveRadarArtistToSupabase(artist) {
  try {
    var otherData = {};
    if (artist.other_url) {
      if (typeof artist.other_url === 'object') {
        otherData = Object.assign({}, artist.other_url);
      } else if (typeof artist.other_url === 'string' && artist.other_url.startsWith('{')) {
        try { otherData = JSON.parse(artist.other_url); } catch(e) {}
      }
    }
    if (artist.career_notes) otherData.career_notes = artist.career_notes;
    if (artist.events_note) otherData.events_note = artist.events_note;
    if (artist.facebook_url) otherData.facebook_url = artist.facebook_url;
    if (artist.order !== undefined && artist.order !== null && !isNaN(artist.order)) {
      otherData.order = parseInt(artist.order, 10);
    }

    var payload = {
      id: artist.id,
      name: artist.name || '',
      city: artist.city || '',
      genre: artist.genre || '',
      type: artist.type || 'secondary',
      badge: artist.badge || 'SOLISTA',
      media_type: artist.media_type || 'image',
      media_url: artist.media_url || '',
      track_id: artist.track_id || '',
      short_bio: artist.short_bio || '',
      full_review: artist.full_review || '',
      career_notes: artist.career_notes || '',
      events_note: artist.events_note || '',
      spotify_url: artist.spotify_url || '',
      instagram: artist.instagram || '',
      apple_music_url: artist.apple_music_url || '',
      youtube_url: artist.youtube_url || '',
      tiktok_url: artist.tiktok_url || '',
      facebook_url: artist.facebook_url || '',
      bandcamp_url: artist.bandcamp_url || '',
      soundcloud_url: artist.soundcloud_url || '',
      website_url: artist.website_url || '',
      other_url: JSON.stringify(otherData)
    };

    var res = await fetch(SUPABASE_URL + '/rest/v1/radar_artists', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch(e) {
    console.warn('Supabase sync no disponible:', e);
    return false;
  }
}

async function saveAllRadarArtistsOrders(list) {
  if (!list || !Array.isArray(list)) return;
  for (var i = 0; i < list.length; i++) {
    list[i].order = i + 1;
  }
  saveRadarArtists(list);

  try {
    var promises = list.map(function(artist) {
      return saveRadarArtistToSupabase(artist);
    });
    await Promise.all(promises);
  } catch(e) {
    console.warn('Error batch syncing orders to Supabase:', e);
  }
}

// Base de datos oficial de ARTISTAS EN EL RADAR - THE NEW INDIE WAVE
var DEFAULT_RADAR_ARTISTS = [
  {
    "id": "radar-01",
    "name": "Lunar Daydream",
    "city": "CIUDAD DE MÉXICO",
    "genre": "DREAM POP / SHOEGAZE",
    "type": "top3",
    "order": 1,
    "badge": "AGRUPACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&q=80",
    "track_id": "3n3Ppam7vgaVa1iaRUc9Lp",
    "short_bio": "Capas envolventes de reverb, sintetizadores análogos nostálgicos y una melodía hipnótica perfecta para la noche.",
    "full_review": "Originarios del sur de la Ciudad de México, Lunar Daydream mezcla guitarras espaciales cargadas de chorus con cajas de ritmos vintage y melodías etéreas.",
    "spotify_url": "https://open.spotify.com/artist/3n3Ppam7vgaVa1iaRUc9Lp",
    "instagram": "@lunardaydream",
    "apple_music_url": "",
    "youtube_url": "https://www.youtube.com/results?search_query=Lunar+Daydream",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-02",
    "name": "Distorsión Fría",
    "city": "BUENOS AIRES",
    "genre": "POST-PUNK / DARKWAVE",
    "type": "top3",
    "order": 2,
    "badge": "DÚO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=900&q=80",
    "track_id": "0VjIjW4GlUZAMYd2vXMi3b",
    "short_bio": "Líneas de bajo penetrantes, cajas de ritmo ochenteras y líricas existenciales con una ejecución en vivo demoledora.",
    "full_review": "Desde los sótanos de Buenos Aires, este dúo post-punk revitaliza las texturas frías de los sintetizadores analógicos con bajos distorsionados y voces graves.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@distorsionfria",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-03",
    "name": "Cero Tardes",
    "city": "BOGOTÁ",
    "genre": "INDIE POP / FOLK",
    "type": "top3",
    "order": 3,
    "badge": "SOLISTA",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=80",
    "track_id": "7qiZfU4dY1lWllzX7mPBI3",
    "short_bio": "Frescura acústica con arreglos de cuerdas sutiles y ganchos vocales inolvidables para escuchar al atardecer.",
    "full_review": "Con una instrumentación orgánica que combina guitarras acústicas afinadas en abierto, percusiones suaves y armonías vocales a dos voces, Cero Tardes crea paisajes sonoros íntimos.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@cerotardes",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-04",
    "name": "Siluetas de Verano",
    "city": "SANTIAGO DE CHILE",
    "genre": "BEDROOM POP / LO-FI",
    "type": "top3",
    "order": 4,
    "badge": "SOLISTA",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=600&q=80",
    "track_id": "4cOdK2wGLETKBW3PvgPWqT",
    "short_bio": "Texturas de cinta de 4 canales con armonías íntimas grabadas en casa.",
    "full_review": "Composiciones caseras con melodías de ensueño con guitarras jangle y sintes casio.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@siluetasdeverano",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-05",
    "name": "Los Extraviados",
    "city": "MADRID / CDMX",
    "genre": "INDIE ROCK / GARAJE",
    "type": "top3",
    "order": 5,
    "badge": "AGRUPACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&q=80",
    "track_id": "3jjujdUJ72nuh5eMFTpqQB",
    "short_bio": "Potencia rítmica directa, guitarras crudas y coros enérgicos urbanos.",
    "full_review": "Riffs veloces y actitud punk melódica con letras honestas sobre la vida urbana contemporánea.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@losextraviados",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-06",
    "name": "Frecuencia Marina",
    "city": "LIMA",
    "genre": "DREAM POP / SYNTH",
    "type": "top3",
    "order": 6,
    "badge": "TRÍO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80",
    "track_id": "1xK59OXxi2TAAAbmZK0hp9",
    "short_bio": "Sintetizadores acuáticos y melodías envolventes de la bruma costera.",
    "full_review": "Atmósferas espaciales que fusionan el shoegaze latino con beats electrónicos elegantes.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@frecuenciamarina",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-07",
    "name": "Sombras de Neón",
    "city": "MONTERREY",
    "genre": "DARKWAVE / EBM",
    "type": "top3",
    "order": 7,
    "badge": "DÚO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&q=80",
    "track_id": "2takcwOaAZWiRsqPHPb7uy",
    "short_bio": "Secuencias industriales bailables y estéticas retro-futuristas nocturnas.",
    "full_review": "Bajo arpegiado analógico implacable con cajas de ritmo potentes para clubes oscuros.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@sombrasdeneon",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-08",
    "name": "La Última Niebla",
    "city": "VALPARAÍSO",
    "genre": "SHOEGAZE / NOISE",
    "type": "top3",
    "order": 8,
    "badge": "AGRUPACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80",
    "track_id": "7qiZfU4dY1lWllzX7mPBI3",
    "short_bio": "Murallas sónicas de distorsión dulce y melodías sumergidas en delay.",
    "full_review": "Exploración sonora intensa inspirada en el shoegaze de los 90s con un toque sudamericano moderno.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@laultimaniebla",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-09",
    "name": "Río Salvaje",
    "city": "GUADALAJARA",
    "genre": "INDIE FOLK / PSICODELIA",
    "type": "top3",
    "order": 9,
    "badge": "SOLISTA",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
    "track_id": "0VjIjW4GlUZAMYd2vXMi3b",
    "short_bio": "Guitarras acústicas hipnóticas y poesía introspectiva sobre la naturaleza.",
    "full_review": "Folk psicodélico que evoca caminos de montaña y fogatas al aire libre con coros expansivos.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@riosalvaje.musica",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-10",
    "name": "Autopista Central",
    "city": "SAN JOSÉ",
    "genre": "POST-PUNK / GARAJE",
    "type": "secondary",
    "order": 10,
    "badge": "AGRUPACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80",
    "track_id": "3n3Ppam7vgaVa1iaRUc9Lp",
    "short_bio": "Energía cruda con baterías veloces y guitarras filosas llenas de adrenalina.",
    "full_review": "Canciones directas de menos de tres minutos que retratan el caos y la juventud urbana.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@autopistacentral",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-11",
    "name": "Cintas Magnéticas",
    "city": "MEDELLÍN",
    "genre": "LO-FI BEATS / CHILL",
    "type": "secondary",
    "order": 11,
    "badge": "PRODUCER",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80",
    "track_id": "4cOdK2wGLETKBW3PvgPWqT",
    "short_bio": "Samples de vinilo cálidos, pianos nostálgicos y bajos suaves lo-fi.",
    "full_review": "Productor independiente que rescata grabaciones de boleros viejos y las fusiona con texturas modernas.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@cintasmagneticas",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-12",
    "name": "Velo Nocturno",
    "city": "PUEBLA",
    "genre": "GOTH ROCK / DARKWAVE",
    "type": "secondary",
    "order": 12,
    "badge": "AGRUPACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
    "track_id": "3jjujdUJ72nuh5eMFTpqQB",
    "short_bio": "Lirismo gótico elegante, guitarras con flanger y una voz profunda única.",
    "full_review": "Atmósferas victorianas combinadas con ritmos bailables inspirados en el rock gótico clásico.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@velonocturno",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-13",
    "name": "Satélites Olvidados",
    "city": "BARCELONA",
    "genre": "MATH ROCK / EMO INDIE",
    "type": "secondary",
    "order": 13,
    "badge": "AGRUPACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1520523839898-50712825e617?w=600&q=80",
    "track_id": "1xK59OXxi2TAAAbmZK0hp9",
    "short_bio": "Compases intrincados, guitarras tapping brillantes y fuerza catárquica.",
    "full_review": "Técnica musical depurada al servicio de canciones cargadas de nostalgia y fuerza juvenil.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@satelitesolvidados",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  },
  {
    "id": "radar-14",
    "name": "Aurora Estéreo",
    "city": "MONTEVIDEO",
    "genre": "SYNTH POP / NEW WAVE",
    "type": "secondary",
    "order": 14,
    "badge": "DÚO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
    "track_id": "2takcwOaAZWiRsqPHPb7uy",
    "short_bio": "Melodías pop luminosas con sintetizadores brillantes y groove bailable.",
    "full_review": "Herederos del pop refinado del Río de la Plata con arreglos vocales sofisticados.",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@auroraestereo",
    "apple_music_url": "",
    "youtube_url": "",
    "tiktok_url": "",
    "website_url": "",
    "other_url": "",
    "bandcamp_url": "",
    "soundcloud_url": ""
  }
];

function getRadarArtists() {
  try {
    var local = localStorage.getItem('tniw_radar_artists');
    if (local) {
      var parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(function(a) {
          return a && a.id !== 'spotify_auth_config' && a.type !== 'config';
        });
      }
    }
  } catch(e) {
    console.error('Error reading radar artists', e);
  }
  return DEFAULT_RADAR_ARTISTS;
}

function saveRadarArtists(artists) {
  try {
    localStorage.setItem('tniw_radar_artists', JSON.stringify(artists));
    if (typeof window !== 'undefined') {
      window.RADAR_ARTISTS = artists;
    }
  } catch(e) {
    console.error('Error saving radar artists', e);
  }
}

if (typeof window !== 'undefined') {
  window.DEFAULT_RADAR_ARTISTS = DEFAULT_RADAR_ARTISTS;
  window.getRadarArtists = getRadarArtists;
  window.saveRadarArtists = saveRadarArtists;
  window.saveRadarArtistToSupabase = saveRadarArtistToSupabase;
  window.saveAllRadarArtistsOrders = saveAllRadarArtistsOrders;
  window.syncRadarFromSupabase = syncRadarFromSupabase;
  window.RADAR_ARTISTS = getRadarArtists();
}
