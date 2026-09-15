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
      if (Array.isArray(data)) {
        var realArtists = data.filter(function(a){
          return a && a.id !== 'spotify_auth_config' && a.type !== 'config';
        });

        var cleanList = realArtists.map(function(item) {
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
          window.RADAR_ARTISTS = cleanList;
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

// Artistas en el radar: sin datos mockeados. Únicamente provienen de Supabase.
var DEFAULT_RADAR_ARTISTS = [];

function getRadarArtists() {
  try {
    var local = localStorage.getItem('tniw_radar_artists');
    if (local) {
      var parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed.filter(function(a) {
          return a && a.id !== 'spotify_auth_config' && a.type !== 'config';
        });
      }
    }
  } catch(e) {
    console.error('Error reading radar artists', e);
  }
  return [];
}

function saveRadarArtists(artists) {
  try {
    localStorage.setItem('tniw_radar_artists', JSON.stringify(artists || []));
    if (typeof window !== 'undefined') {
      window.RADAR_ARTISTS = artists || [];
    }
  } catch(e) {
    console.error('Error saving radar artists', e);
  }
}

if (typeof window !== 'undefined') {
  window.DEFAULT_RADAR_ARTISTS = [];
  window.getRadarArtists = getRadarArtists;
  window.saveRadarArtists = saveRadarArtists;
  window.saveRadarArtistToSupabase = saveRadarArtistToSupabase;
  window.saveAllRadarArtistsOrders = saveAllRadarArtistsOrders;
  window.syncRadarFromSupabase = syncRadarFromSupabase;
  window.RADAR_ARTISTS = getRadarArtists();
}
