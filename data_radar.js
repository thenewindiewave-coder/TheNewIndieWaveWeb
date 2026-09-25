var SUPABASE_URL = 'https://bsmnzbdnffdxxveyifmc.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

function parseArtistOtherData(item) {
  if (!item) return item;
  if (item.other_url && typeof item.other_url === 'string' && item.other_url.startsWith('{')) {
    try {
      var parsed = JSON.parse(item.other_url);
      if (parsed.career_notes) item.career_notes = parsed.career_notes;
      if (parsed.events_note) item.events_note = parsed.events_note;
      if (parsed.facebook_url) item.facebook_url = parsed.facebook_url;
      if (parsed.archived !== undefined) item.archived = parsed.archived;
      if (parsed.archived_at) item.archived_at = parsed.archived_at;
      if (parsed.previous_type) item.previous_type = parsed.previous_type;
      if (parsed.order !== undefined && parsed.order !== null && !isNaN(parsed.order)) {
        item.order = parseInt(parsed.order, 10);
      }
      if (parsed.media_start !== undefined && parsed.media_start !== null && !isNaN(parsed.media_start)) {
        item.media_start = parseInt(parsed.media_start, 10);
      }
    } catch(e) {}
  }
  if (item.order === undefined || item.order === null || isNaN(item.order)) {
    var match = (item.id || '').match(/radar-(\d+)/);
    item.order = match ? parseInt(match[1], 10) : 999;
  }
  if (item.media_start === undefined && item.media_url) {
    item.media_start = extractYouTubeStart(item.media_url);
  }
  return item;
}

function getYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  var str = url.trim();
  var match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

function extractYouTubeStart(url) {
  if (!url || typeof url !== 'string') return 0;
  var str = url.trim();
  var tMatch = str.match(/[?&](?:t|start)=(\d+h)?(\d+m)?(\d+s?|\d+)/i);
  if (!tMatch) return 0;
  var hours = 0, mins = 0, secs = 0;
  if (tMatch[1]) hours = parseInt(tMatch[1], 10) || 0;
  if (tMatch[2]) mins = parseInt(tMatch[2], 10) || 0;
  if (tMatch[3]) secs = parseInt(tMatch[3].replace('s',''), 10) || 0;
  return (hours * 3600) + (mins * 60) + secs;
}

function formatSecondsToMMSS(seconds) {
  var s = Math.max(0, Math.floor(seconds || 0));
  var m = Math.floor(s / 60);
  var remS = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (remS < 10 ? '0' : '') + remS;
}

function isArtistArchived(item) {
  if (!item) return false;
  if (item.type === 'archived') return true;
  if (item.other_url && typeof item.other_url === 'string' && item.other_url.startsWith('{')) {
    try {
      var o = JSON.parse(item.other_url);
      if (o && o.archived === true) return true;
    } catch(e) {}
  }
  return false;
}

function getArtistRadarUrl(artist) {
  if (!artist || !artist.id) return 'https://www.thenewindiewave.online/artistas';
  return 'https://www.thenewindiewave.online/artistas?artista=' + encodeURIComponent(artist.id);
}

function getArtistSocialShareUrl(artist) {
  if (!artist || !artist.id) return 'https://www.thenewindiewave.online/artistas';
  return 'https://www.thenewindiewave.online/artista?id=' + encodeURIComponent(artist.id);
}

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
        // Filtrar configuraciones y artistas archivados del radar activo
        var realArtists = data.filter(function(a){
          return a && a.id !== 'spotify_auth_config' && a.type !== 'config' && !isArtistArchived(a);
        });

        var cleanList = realArtists.map(parseArtistOtherData);

        // Ordenamiento determinista y fijo según la posición guardada
        cleanList.sort(function(a, b) {
          return (parseInt(a.order, 10) || 999) - (parseInt(b.order, 10) || 999);
        });

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tniw_radar_artists', JSON.stringify(cleanList));
        }
        if (typeof window !== 'undefined') {
          window.RADAR_ARTISTS = cleanList;
        }
        return cleanList;
      }
    }
  } catch(e) {
    console.warn('Error sincronizando radar activo desde Supabase:', e);
  }
  return null;
}

async function getArchivedRadarArtistsFromSupabase() {
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
        var archivedList = data.filter(function(a){
          return a && a.id !== 'spotify_auth_config' && a.type !== 'config' && isArtistArchived(a);
        }).map(parseArtistOtherData);

        archivedList.sort(function(a, b) {
          var dateA = a.archived_at ? new Date(a.archived_at).getTime() : 0;
          var dateB = b.archived_at ? new Date(b.archived_at).getTime() : 0;
          return dateB - dateA;
        });

        return archivedList;
      }
    }
  } catch(e) {
    console.warn('Error obteniendo archivo de artistas desde Supabase:', e);
  }
  return [];
}

async function getSingleRadarArtistFromSupabase(idOrSlug) {
  if (!idOrSlug) return null;
  var target = String(idOrSlug).trim();
  var altId = target.replace(/^radar-(\d)$/, 'radar-0$1').replace(/^radar-0(\d)$/, 'radar-$1');

  try {
    // 1. Buscar por ID exacto o alterno
    var res = await fetch(SUPABASE_URL + '/rest/v1/radar_artists?or=(id.eq.' + encodeURIComponent(target) + ',id.eq.' + encodeURIComponent(altId) + ')&select=*', {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    });
    if (res.ok) {
      var data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return parseArtistOtherData(data[0]);
      }
    }

    // 2. Si no encontró por ID, buscar por coincidencia en nombre/slug
    var cleanSlug = target.toLowerCase().replace(/[-_]+/g, ' ');
    var resName = await fetch(SUPABASE_URL + '/rest/v1/radar_artists?name=ilike.*' + encodeURIComponent(cleanSlug) + '*&select=*', {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    });
    if (resName.ok) {
      var dataName = await resName.json();
      if (Array.isArray(dataName) && dataName.length > 0) {
        return parseArtistOtherData(dataName[0]);
      }
    }
  } catch(e) {
    console.warn('Error consultando artista individual en Supabase:', e);
  }
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
    if (artist.archived !== undefined) otherData.archived = artist.archived;
    if (artist.archived_at) otherData.archived_at = artist.archived_at;
    if (artist.previous_type) otherData.previous_type = artist.previous_type;
    if (artist.order !== undefined && artist.order !== null && !isNaN(artist.order)) {
      otherData.order = parseInt(artist.order, 10);
    }
    if (artist.media_start !== undefined && artist.media_start !== null && !isNaN(artist.media_start)) {
      otherData.media_start = parseInt(artist.media_start, 10);
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

async function archiveRadarArtistInSupabase(artistId) {
  try {
    var artist = await getSingleRadarArtistFromSupabase(artistId);
    if (!artist) {
      artist = { id: artistId, name: '', type: 'secondary' };
    }

    var otherData = {};
    if (artist.other_url) {
      if (typeof artist.other_url === 'object') {
        otherData = Object.assign({}, artist.other_url);
      } else if (typeof artist.other_url === 'string' && artist.other_url.startsWith('{')) {
        try { otherData = JSON.parse(artist.other_url); } catch(e) {}
      }
    }
    otherData.archived = true;
    otherData.archived_at = new Date().toISOString();
    otherData.previous_type = (artist.type !== 'archived') ? artist.type : (otherData.previous_type || 'secondary');

    var payload = {
      id: artist.id,
      name: artist.name || '',
      city: artist.city || '',
      genre: artist.genre || '',
      type: 'archived',
      badge: artist.badge || 'ARTISTA',
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
    console.error('Error archivando artista en Supabase:', e);
    return false;
  }
}

async function unarchiveRadarArtistInSupabase(artistId, targetType, targetOrder) {
  try {
    var artist = await getSingleRadarArtistFromSupabase(artistId);
    if (!artist) return false;

    var otherData = {};
    if (artist.other_url) {
      if (typeof artist.other_url === 'object') {
        otherData = Object.assign({}, artist.other_url);
      } else if (typeof artist.other_url === 'string' && artist.other_url.startsWith('{')) {
        try { otherData = JSON.parse(artist.other_url); } catch(e) {}
      }
    }
    delete otherData.archived;
    delete otherData.archived_at;
    var restoredType = targetType || otherData.previous_type || 'secondary';
    delete otherData.previous_type;
    if (targetOrder !== undefined && targetOrder !== null) {
      otherData.order = targetOrder;
    }
    if (artist.media_start !== undefined && artist.media_start !== null && !isNaN(artist.media_start)) {
      otherData.media_start = parseInt(artist.media_start, 10);
    }

    var payload = {
      id: artist.id,
      name: artist.name || '',
      city: artist.city || '',
      genre: artist.genre || '',
      type: restoredType,
      badge: artist.badge || 'ARTISTA',
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
    console.error('Error desarchivando artista en Supabase:', e);
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
    if (typeof localStorage !== 'undefined') {
      var local = localStorage.getItem('tniw_radar_artists');
      if (local) {
        var parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          return parsed.filter(function(a) {
            return a && a.id !== 'spotify_auth_config' && a.type !== 'config' && !isArtistArchived(a);
          });
        }
      }
    }
  } catch(e) {
    console.error('Error reading radar artists', e);
  }
  return [];
}

function saveRadarArtists(artists) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tniw_radar_artists', JSON.stringify(artists || []));
    }
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
  window.getArchivedRadarArtistsFromSupabase = getArchivedRadarArtistsFromSupabase;
  window.getSingleRadarArtistFromSupabase = getSingleRadarArtistFromSupabase;
  window.archiveRadarArtistInSupabase = archiveRadarArtistInSupabase;
  window.unarchiveRadarArtistInSupabase = unarchiveRadarArtistInSupabase;
  window.getArtistRadarUrl = getArtistRadarUrl;
  window.getArtistSocialShareUrl = getArtistSocialShareUrl;
  window.isArtistArchived = isArtistArchived;
  window.getYouTubeVideoId = getYouTubeVideoId;
  window.extractYouTubeStart = extractYouTubeStart;
  window.formatSecondsToMMSS = formatSecondsToMMSS;
  window.RADAR_ARTISTS = getRadarArtists();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getYouTubeVideoId: getYouTubeVideoId,
    extractYouTubeStart: extractYouTubeStart,
    formatSecondsToMMSS: formatSecondsToMMSS,
    parseArtistOtherData: parseArtistOtherData
  };
}
