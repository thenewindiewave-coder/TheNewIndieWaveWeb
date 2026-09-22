import crypto from 'crypto';

/**
 * SERVERLESS ENDPOINT PARA CONTROLAR EL BOT SCOUT DESDE EL PANEL DE CURADOR
 * Permite escanear medios en vivo y publicar noticias seleccionadas con 1 clic.
 */

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

const RSS_FEEDS = [
  // 🇲🇽 MÉXICO (CASA / ALMA MATER TNIW - 10 MEDIOS LÍDERES)
  { name: 'WARP Magazine', url: 'https://warp.la/feed/', region: 'México' },
  { name: 'Indie Rocks!', url: 'https://www.indierocks.mx/feed/', region: 'México' },
  { name: 'Sopitas Música', url: 'https://www.sopitas.com/feed/', region: 'México' },
  { name: 'Me Hace Ruido', url: 'https://mehaceruido.com/feed/', region: 'México' },
  { name: 'Filter México', url: 'https://filtermexico.com/feed/', region: 'México' },
  { name: 'Setlist.me', url: 'https://setlist.me/feed/', region: 'México' },
  { name: 'Revista Kuadro', url: 'https://revistakuadro.com/feed/', region: 'México' },
  { name: 'Pólvora Rock', url: 'https://polvora.com.mx/feed/', region: 'México' },
  { name: 'Grita Radio', url: 'https://gritaradio.com/feed/', region: 'México' },
  { name: 'Rolling Stone en Español', url: 'https://es.rollingstone.com/feed/', region: 'México' },

  // 🌎 LATINOAMÉRICA
  { name: 'Indie Hoy', url: 'https://indiehoy.com/feed/', region: 'Latinoamérica' },
  { name: 'Cuchara Sónica', url: 'https://cucharasonica.com/feed/', region: 'Latinoamérica' },

  // 🇪🇸 ESPAÑA
  { name: 'MondoSonoro', url: 'https://www.mondosonoro.com/feed/', region: 'España' },
  { name: 'Binaural', url: 'https://binaural.es/feed/', region: 'España' },
  { name: 'Muzikalia', url: 'https://muzikalia.com/feed/', region: 'España' },
  { name: 'Jenesaispop', url: 'https://jenesaispop.com/feed/', region: 'España' }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. GET: ESCANEAR MEDIOS EN VIVO Y DEVOLVER EL RADAR
  if (req.method === 'GET') {
    try {
      // Slugs en Supabase
      let existingSlugs = new Set();
      try {
        const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=slug`, {
          headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
        });
        if (dbRes.ok) {
          const rows = await dbRes.json();
          rows.forEach(r => existingSlugs.add(r.slug));
        }
      } catch(e) {}

      const detectedNews = [];

      for (const feed of RSS_FEEDS) {
        try {
          const r = await fetch(feed.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 TNIW-Curator/1.0' }
          });
          if (!r.ok) continue;
          const xml = await r.text();
          const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

          for (const rawItem of items.slice(0, 3)) {
            const titleMatch = rawItem.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = rawItem.match(/<link>([\s\S]*?)<\/link>/);
            const descMatch = rawItem.match(/<description>([\s\S]*?)<\/description>/);
            const pubDateMatch = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || rawItem.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
            const pubDate = pubDateMatch ? cleanXml(pubDateMatch[1]) : new Date().toISOString();

            if (titleMatch && linkMatch) {
              const title = cleanXml(titleMatch[1]);
              const link = cleanXml(linkMatch[1]);
              const desc = descMatch ? cleanXml(descMatch[1]) : '';

              // Extraer imagen real del feed (media:content, enclosure o img)
              let feedImg = null;
              const mediaMatch = rawItem.match(/<media:content[^>]+url=["']([^"']+)["']/i);
              const encMatch = rawItem.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
              const imgTagMatch = rawItem.match(/<img[^>]+src=["']([^"']+)["']/i);
              if (mediaMatch) feedImg = mediaMatch[1];
              else if (encMatch) feedImg = encMatch[1];
              else if (imgTagMatch) feedImg = imgTagMatch[1];

              if (isMusicRelevant(title, desc)) {
                const s = slugify(title);
                const isPublished = existingSlugs.has(s) || Array.from(existingSlugs).some(x => x.includes(s.slice(0, 20)));

                detectedNews.push({
                  source: feed.name,
                  region: feed.region,
                  title,
                  link,
                  desc: desc.slice(0, 180) + '...',
                  pub_date: pubDate,
                  slug: s,
                  image_url: feedImg,
                  is_published: isPublished
                });
              }
            }
          }
        } catch(err) {}
      }

      return res.status(200).json({
        success: true,
        count: detectedNews.length,
        feeds: RSS_FEEDS.map(f => f.name),
        news: detectedNews
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. POST: REDACTAR Y PUBLICAR UNA NOTICIA SELECCIONADA
  if (req.method === 'POST') {
    try {
      const { title, source, region, link, desc, image_url } = req.body || {};

      if (!title) {
        return res.status(400).json({ error: 'Falta el título de la noticia.' });
      }

      const prompt = `Noticia indie de ${region || 'Iberoamérica'} vía ${source || 'Medios'}:
Título: "${title}"
Detalles: "${desc || ''}"
Fuente original: ${link || ''}`;

      const meta = { title, source: source || 'Medios Indie', region: region || 'Iberoamérica', link: link || '#', image_url, desc };
      const article = await generateEditorialPiece(prompt, meta);

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(article)
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return res.status(500).json({ error: 'Error al insertar en Supabase', details: errText });
      }

      const inserted = await insertRes.json();

      // Auto-archivar notas editoriales antiguas para mantener exactamente 7 en portada
      // Las notas de canciones ('Artistas en el Radar') nunca se auto-archivan con este límite ni desplazan noticias
      try {
        const pubCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&order=published_at.desc`, {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        });
        if (pubCheckRes.ok) {
          const pubArticles = await pubCheckRes.json();
          const editorialArticles = (pubArticles || []).filter(a => {
            const cat = (a.category || '').toLowerCase().trim();
            const title = (a.title || '').toLowerCase().trim();
            const slug = (a.slug || '').toLowerCase().trim();
            const isRadar = cat === 'artistas en el radar' || title.startsWith('descubrimiento radar') || slug.startsWith('radar-tniw-');
            return !isRadar && cat !== 'scout_queue' && cat !== 'scout_discarded';
          });
          if (editorialArticles.length > 7) {
            const toArchive = editorialArticles.slice(7);
            for (const item of toArchive) {
              await fetch(`${SUPABASE_URL}/rest/v1/articles?slug=eq.${encodeURIComponent(item.slug)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': SUPABASE_SERVICE_KEY,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ published: false })
              });
            }
            console.log(`[scout-news] Auto-archivadas ${toArchive.length} notas editoriales antiguas para mantener el límite de 7.`);
          }
        }
      } catch (archiveErr) {
        console.warn('[scout-news] Error auto-archivando notas:', archiveErr);
      }

      // Auto-publicar en Social Hub (Post en FB, IG, Threads, X, TikTok + Story en FB, IG)
      let socialHubSent = false;
      try {
        socialHubSent = await pushArticleToSocialHub(inserted && inserted[0] ? inserted[0] : article);
      } catch (shErr) {
        console.warn('[scout-news] Error auto-publicando en Social Hub:', shErr);
      }

      const createdArt = inserted && inserted[0] ? inserted[0] : article;
      const shortCode = (createdArt.id && typeof createdArt.id === 'string' && createdArt.id.length >= 8)
        ? createdArt.id.slice(0, 8)
        : (createdArt.slug ? (createdArt.slug.split('-').pop() || createdArt.slug) : '');
      const shortUrl = `https://thenewindiewave.online/b/${shortCode || encodeURIComponent(createdArt.slug || '')}`;

      return res.status(200).json({
        success: true,
        message: '¡Noticia redactada y publicada en el Blog!',
        article: createdArt,
        social_hub: socialHubSent,
        url: shortUrl,
        full_url: `https://www.thenewindiewave.online/blog#${article.slug}`
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}

// ==============================================================================
// PUBLICACIÓN AUTOMÁTICA EN SOCIAL HUB (THE NEW INDIE WAVE)
// ==============================================================================
async function uploadImageToCloudinary(remoteImageUrl) {
  if (!remoteImageUrl || typeof remoteImageUrl !== 'string') return null;
  if (remoteImageUrl.includes('res.cloudinary.com')) return remoteImageUrl;

  try {
    const cloudName = 'ckknw1do';
    const apiKey = '576643641599951';
    const apiSecret = 'BqRSk2zRcn2-BtMi9BIHHiRyTfQ';
    const folder = 'social-hub/6c3d2719-eb61-4ee5-ab4c-89b2810e2c4c';
    const timestamp = Math.floor(Date.now() / 1000);

    const strToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

    const body = new URLSearchParams();
    body.append('file', remoteImageUrl);
    body.append('api_key', apiKey);
    body.append('timestamp', timestamp.toString());
    body.append('signature', signature);
    body.append('folder', folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: body
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.secure_url) return data.secure_url;
    }
  } catch (err) {
    console.warn('[Social Hub Cloudinary Upload Error]:', err.message);
  }
  return remoteImageUrl;
}

async function pushArticleToSocialHub(article) {
  if (!article) return false;
  try {
    const finalImageUrl = await uploadImageToCloudinary(article.image_url);
    const postGroupId = `grp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const nowObj = new Date();
    const dateStr = nowIso.split('T')[0];
    const hourStr = nowObj.getHours().toString().padStart(2, '0');
    const minuteStr = nowObj.getMinutes().toString().padStart(2, '0');
    const periodStr = nowObj.getHours() >= 12 ? 'PM' : 'AM';

    const title = article.title || '';
    const cleanSummary = (article.summary || '')
      .replace(/\s*[\.\s]*(?:cobertura\s+(?:v[ií]a|por)|v[ií]a\b|fuente\s*:|prensa\s*:)\s+[^.\n!]+[.\n!]?/gi, '')
      .trim();
    const shortCode = (article.id && typeof article.id === 'string' && article.id.length >= 8)
      ? article.id.slice(0, 8)
      : (article.slug ? (article.slug.split('-').pop() || article.slug) : '');
    const url = `https://thenewindiewave.online/b/${shortCode || encodeURIComponent(article.slug || '')}`;

    const isTrack = (article.category === 'Artistas en el Radar') ||
                    title.toLowerCase().includes('descubrimiento radar') ||
                    (article.slug || '').startsWith('radar-tniw-');

    const copyText = isTrack
      ? `🚨 ¡NUEVO TRACK EN EL RADAR EDITORIAL! 📡✨\n\n"${title}"\n\n${cleanSummary}\n\n👉 Escucha el track y lee la reseña completa aquí:\n🔗 ${url}\n\n#TheNewIndieWave #ArtistasEnElRadar #Descubrimientos #MusicaNueva #IndieMusic`
      : `🚨 ¡NUEVA NOTA EN EL RADAR EDITORIAL! 🚨\n\n"${title}"\n\n${cleanSummary}\n\n👉 Lee la cobertura completa en el blog:\n🔗 ${url}\n\n#TheNewIndieWave #CulturaIndie #MusicaIndie #BlogMusical`;

    // 1. Post Feed (Facebook, Instagram, Threads, X, TikTok)
    const feedBundle = {
      id: Math.random().toString(36).substr(2, 9),
      media: finalImageUrl,
      mediaUrls: [finalImageUrl],
      mediaType: 'photo',
      original_filename: `tniw_post_${article.slug || 'art'}.png`,
      post_group_id: postGroupId,
      content: copyText,
      platforms: [
        { id: 'facebook', type: 'post', types: ['post'], options: { shareAsStory: false } },
        { id: 'instagram', type: 'post', types: ['post'], options: { showInFeed: true, shareAsStory: false } },
        { id: 'threads', type: 'post', types: ['post'], options: { whoCanReply: 'everyone' } },
        { id: 'x', type: 'post', types: ['post'], options: { whoCanReply: 'everyone' } },
        { id: 'tiktok', type: 'post', types: ['post'], options: { allowDuet: true, visibility: 'public', allowStitch: true, isYourBrand: false, allowComments: true, isBrandedContent: false, commercialContent: false } }
      ],
      mode: 'now',
      status: 'published',
      timestamp: { date: dateStr, hour: hourStr, minute: minuteStr, period: periodStr },
      createdAt: nowIso
    };

    const recordFeed = {
      brand_id: '6c3d2719-eb61-4ee5-ab4c-89b2810e2c4c',
      content: copyText,
      media_url: finalImageUrl,
      platforms: ['facebook', 'instagram', 'threads', 'x', 'tiktok'],
      platform_post_types: {
        facebook: 'post',
        instagram: 'post',
        threads: 'post',
        x: 'post',
        tiktok: 'post'
      },
      payload: feedBundle,
      scheduled_at: nowIso,
      status: 'pending',
      post_type: 'post'
    };

    // 2. Story (Facebook, Instagram)
    const storyBundle = {
      id: Math.random().toString(36).substr(2, 9),
      media: finalImageUrl,
      mediaUrls: [finalImageUrl],
      mediaType: 'photo',
      original_filename: `tniw_story_${article.slug || 'art'}.png`,
      post_group_id: postGroupId,
      content: copyText,
      platforms: [
        { id: 'facebook', type: 'story', types: ['story'], options: { shareAsStory: false } },
        { id: 'instagram', type: 'story', types: ['story'], options: { showInFeed: false, shareAsStory: false } }
      ],
      mode: 'now',
      status: 'published',
      timestamp: { date: dateStr, hour: hourStr, minute: minuteStr, period: periodStr },
      createdAt: nowIso
    };

    const recordStory = {
      brand_id: '6c3d2719-eb61-4ee5-ab4c-89b2810e2c4c',
      content: copyText,
      media_url: finalImageUrl,
      platforms: ['facebook', 'instagram'],
      platform_post_types: {
        facebook: 'story',
        instagram: 'story'
      },
      payload: storyBundle,
      scheduled_at: nowIso,
      status: 'pending',
      post_type: 'story'
    };

    const SOCIAL_HUB_SUPABASE_URL = 'https://gcorvulignbmbjsgekpo.supabase.co';
    const SOCIAL_HUB_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjb3J2dWxpZ25ibWJqc2dla3BvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2NDg1OSwiZXhwIjoyMDg2OTQwODU5fQ.aRHvDWcIOSlUPBB0xGctZYI85gf3FrqMaTphnmOeS58';

    const insertRes = await fetch(`${SOCIAL_HUB_SUPABASE_URL}/rest/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SOCIAL_HUB_SUPABASE_KEY,
        'Authorization': `Bearer ${SOCIAL_HUB_SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify([recordFeed, recordStory])
    });

    if (insertRes.ok) {
      console.log(`[Social Hub] Post & Story encolados con éxito para: "${title}"`);
      return true;
    } else {
      const errText = await insertRes.text();
      console.warn('[Social Hub Supabase Error]:', errText);
      return false;
    }
  } catch (err) {
    console.error('[Social Hub Push Error]:', err);
    return false;
  }
}

function isMusicRelevant(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  const musicKeywords = [
    'canción', 'cancion', 'álbum', 'album', 'disco', 'single', 'sencillo', 'tema', 'video',
    'concierto', 'gira', 'festival', 'banda', 'estrena', 'lanzamiento', 'guitarra', 'indie',
    'shoegaze', 'post-punk', 'rock', 'pop', 'presenta', 'estreno', 'música', 'musica',
    'cartel', 'cover', 'adelanto', 'tour', 'videoclip', 'ep', 'lp', 'en vivo', 'acústico',
    'acustico', 'solista', 'vocalista', 'sintetizador', 'producción', 'punk', 'metal'
  ];
  const ignoreKeywords = ['película', 'pelicula', 'serie', 'tráiler', 'trailer', 'netflix', 'hbo', 'taquilla', 'marvel', 'nintendo', 'playstation', 'xbox', 'videojuego', 'gaming'];
  if (ignoreKeywords.some(k => text.includes(k) && !text.includes('soundtrack'))) return false;
  return musicKeywords.some(k => text.includes(k));
}

// RESOLUCIÓN DE IMAGEN REAL DEL ARTISTA / FUENTE
async function fetchOgImageFromUrl(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const html = await res.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1] && ogMatch[1].startsWith('http')) {
      return ogMatch[1];
    }
  } catch(e) {}
  return null;
}

async function fetchRealArtistImage(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.trim();
  if (clean.length < 2) return null;

  // 1. Deezer Artist API (Fotos oficiales en alta resolución 1000x1000)
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(clean)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 TNIW/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const item = data.data.find(a => a.name.toLowerCase() === clean.toLowerCase()) || data.data[0];
        const img = item.picture_xl || item.picture_big;
        if (img && !img.includes('default')) {
          return img;
        }
      }
    }
  } catch(e) {}

  // 2. Wikipedia PageImages API (Foto verificada en Wikimedia Commons)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(clean)}&prop=pageimages&format=json&pithumbsize=1200`;
    const res = await fetch(wikiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 TNIW/1.0' } });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages;
      if (pages) {
        const pageKey = Object.keys(pages)[0];
        const thumb = pages[pageKey]?.thumbnail?.source;
        if (thumb) return thumb;
      }
    }
  } catch(e) {}

  return null;
}

async function resolveRealArticleImage({ suppliedImg, articleUrl, artistName, title }) {
  // 1. Si el feed RSS ya traía imagen directa de la nota
  if (suppliedImg && suppliedImg.startsWith('http') && !suppliedImg.includes('unsplash.com')) {
    return suppliedImg;
  }
  // 2. Extraer imagen original del artículo fuente (WARP, Sopitas, MondoSonoro, etc.)
  if (articleUrl && articleUrl.startsWith('http')) {
    const ogImg = await fetchOgImageFromUrl(articleUrl);
    if (ogImg) return ogImg;
  }
  // 3. Buscar foto oficial de la banda / artista en alta resolución
  if (artistName) {
    const artistImg = await fetchRealArtistImage(artistName);
    if (artistImg) return artistImg;
  }
  // 4. Intentar extraer el nombre del artista del título
  if (title) {
    const parts = title.split(/[:\-\"“”—,]/);
    for (const part of parts) {
      const cleanCandidate = part.replace(/radar|méxico|mexico|latam|españa|estrena|estrenan|nuevo|nueva|canción|cancion|sencillo|disco|álbum|album/gi, '').trim();
      if (cleanCandidate.length >= 3 && cleanCandidate.split(' ').length <= 3) {
        const found = await fetchRealArtistImage(cleanCandidate);
        if (found) return found;
      }
    }
  }
  // Fallback musical estético si no se encontró imagen
  return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';
}

// -----------------------------------------------------------------------------
// EXTRACCIÓN DE CONTENIDO REAL DEL ARTÍCULO FUENTE (WEB SCRAPING)
// -----------------------------------------------------------------------------
async function fetchArticleBody(url) {
  if (!url || !url.startsWith('http')) return '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return '';
    const html = await res.text();

    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '');

    const pMatches = cleaned.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const valid = [];
    const ignoreKeywords = [
      'cookie', 'política de privacidad', 'derechos reservados', 'suscríbete', 'newsletter',
      'outdated browser', 'upgrade your browser', 'googletag', 'publicidad', 'anuncio',
      'posted in', 'comentarios', 'deja un comentario', 'site-header', 'custom-logo', 'more by',
      'todos los derechos', 'términos y condiciones', 'aviso legal', 'compartir en', 'whatsapp'
    ];

    for (const rawP of pMatches) {
      const text = rawP
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8216;|&#8217;/g, "'")
        .replace(/&#8220;|&#8221;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length >= 45 && !ignoreKeywords.some(k => text.toLowerCase().includes(k)) && !/\S+@\S+\.\S+/.test(text)) {
        valid.push(text);
      }
    }
    return valid.slice(0, 8).join('\n\n');
  } catch (e) {
    return '';
  }
}

async function generateEditorialPiece(promptContext, meta) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY || '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';
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  // 1. Extraer el contenido real y hechos concretos de la fuente original
  let scrapedBody = '';
  if (meta.link && meta.link.startsWith('http')) {
    scrapedBody = await fetchArticleBody(meta.link);
  }
  const cleanDesc = (meta.desc || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  const factualContext = scrapedBody && scrapedBody.length >= 80 ? scrapedBody : (cleanDesc || meta.title);

  const systemPrompt = `Eres redactor y periodista musical de la revista digital "The New Indie Wave" (TNIW).
Tu misión es redactar un artículo periodístico completo, detallado y riguroso sobre la siguiente noticia de la escena de ${meta.region || 'Iberoamérica'} (reportada originalmente por ${meta.source}).

REGLAS EDITORIALES OBLIGATORIAS:
1. INFORMACIÓN CONCRETA Y DATOS DUROS (OBLIGATORIO):
   - La nota DEBE informar de verdad: incluye fechas exactas, horarios, sedes/recintos específicos, nombres propios de artistas, bandas, festivales, sellos discográficos, expositores o tiendas involucradas.
   - Párrafo 1: Noticia directa con los hechos esenciales (qué acontecimiento es, cuándo sucede y dónde con datos específicos).
   - Párrafo 2: Detalles concretos y desarrollo (actividades, participantes, lanzamientos, canciones, colaboradores o peculiaridades).
   - Párrafo 3: Contexto musical y relevancia cultural para la escena independiente desde el criterio editorial de TNIW.
2. PROHIBIDO TOTALMENTE EL RELLENO GENÉRICO / CORPORATIVO:
   - PROHIBIDO usar fórmulas vacías como "El pulso de la música independiente suma una nueva noticia...", "Un acontecimiento relevante que reafirma el dinamismo...", "En The New Indie Wave seguimos de cerca el impacto...", o "marcan la pauta en los circuitos autogestivos".
   - PROHIBIDO inventar citas o blockquotes falsos atribuidos a Rodrigo dL Moral.
   - Redacta periodismo musical real, orgánico, ágil y apasionado, como una revista musical moderna de primer nivel.
3. ATRIBUCIÓN TRANSPARENTE:
   - Al final del contenido incluye el pie de página de atribución:
     <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">Fuente original: <a href="${meta.link}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${meta.source} ↗</a> · Foto: Vía ${meta.source} / Prensa oficial</div>
4. FORMATO JSON OBLIGATORIO:
Responde ÚNICAMENTE un JSON válido con esta estructura:
{
  "title": "Titular periodístico informativo y atractivo (máximo 12 palabras)",
  "slug": "slug-limpio-en-minusculas-con-guiones",
  "summary": "Resumen directo con datos esenciales (fechas, lugar, hecho principal, máximo 35 palabras)",
  "content": "Cuerpo completo del artículo en HTML limpio con 3 párrafos <p> informativos y el bloque <div class=\\"source-credit\\">",
  "photo_credit": "Vía ${meta.source} / Prensa oficial",
  "category": "Cultura Indie",
  "read_time": "1.5 min",
  "tags": ["${meta.region || 'Música Indie'}", "Música Indie", "Lanzamiento", "TNIW"],
  "artist_name": "Nombre exacto de la banda o artista principal (ej. Editors, Clubz, Carolina Durante). Si no aplica, dejar vacío."
}`;

  const userPrompt = `Noticia: "${meta.title}"
Fuente: ${meta.source} (${meta.link})
Región: ${meta.region || 'Iberoamérica'}

HECHOS Y CONTENIDO EXTRAÍDO DE LA FUENTE:
${factualContext}`;

  if (GROQ_KEY) {
    const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    for (const modelName of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.4,
            max_tokens: 1400
          })
        });
        if (res.ok) {
          const data = await res.json();
          const rawJson = data.choices?.[0]?.message?.content;
          if (rawJson) {
            const parsed = JSON.parse(rawJson.replace(/```json/g, '').replace(/```/g, '').trim());
            return await buildArticleObject(parsed, meta);
          }
        }
      } catch(e) {
        console.warn(`Groq (${modelName}) fallo en scout-news:`, e.message);
      }
    }
  }

  if (GEMINI_KEY) {
    const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
    for (const gModel of geminiModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsed = JSON.parse(rawJson.replace(/```json/g, '').replace(/```/g, '').trim());
            return await buildArticleObject(parsed, meta);
          }
        }
      } catch(e) {}
    }
  }

  // Fallback autónomo inteligente (basado en hechos reales extraídos, JAMÁS relleno vacío)
  const realImg = await resolveRealArticleImage({
    suppliedImg: meta.image_url,
    articleUrl: meta.link,
    title: meta.title
  });

  const slug = `radar-${slugify(meta.region || 'indie')}-${slugify(meta.title)}-${Date.now().toString().slice(-4)}`;
  const rawParagraphs = factualContext.split('\n\n').filter(p => p.trim().length > 35);
  const summaryText = rawParagraphs[0]
    ? (rawParagraphs[0].length > 160 ? rawParagraphs[0].slice(0, 157) + '...' : rawParagraphs[0])
    : `${meta.title}. Novedades en la escena de ${meta.region || 'Iberoamérica'}.`;

  const photoCredit = `Vía ${meta.source} / Prensa oficial`;

  let synthesizedHtml = '';
  if (rawParagraphs.length >= 2) {
    synthesizedHtml = rawParagraphs.slice(0, 3).map(p => `<p>${escapeHtml(p)}</p>`).join('\n');
  } else {
    synthesizedHtml = `<p>${escapeHtml(factualContext)}</p>`;
  }

  synthesizedHtml += `
    <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
      Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: ${photoCredit}
    </div>
  `;

  return {
    slug,
    title: meta.title.length > 80 ? meta.title.slice(0, 77) + '...' : meta.title,
    summary: summaryText,
    content: synthesizedHtml,
    category: 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: realImg,
    read_time: '1.5 min',
    tags: [meta.region || 'Indie', 'Música Indie', 'Radar TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

async function buildArticleObject(parsed, meta) {
  const realImg = await resolveRealArticleImage({
    suppliedImg: meta.image_url,
    articleUrl: meta.link,
    artistName: parsed.artist_name,
    title: meta.title
  });

  const photoCredit = parsed.photo_credit || `Vía ${meta.source} / Prensa oficial`;
  let contentHtml = parsed.content || `<p>${escapeHtml(parsed.summary || meta.title)}</p>`;

  if (!contentHtml.includes('source-credit')) {
    contentHtml += `
      <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
        Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: ${photoCredit}
      </div>
    `;
  }

  return {
    slug: parsed.slug || `radar-${slugify(meta.region)}-${slugify(meta.title)}-${Date.now().toString().slice(-4)}`,
    title: parsed.title || meta.title,
    summary: parsed.summary || (meta.desc ? meta.desc.slice(0, 160) : 'Actualidad y novedades en la escena independiente.'),
    content: contentHtml,
    category: parsed.category || 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: realImg,
    read_time: parsed.read_time || '1.5 min',
    tags: parsed.tags || [meta.region, 'Música Indie', 'Radar TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

function cleanXml(str) {
  return str.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '').replace(/&#8216;|&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&amp;/g, '&').trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  if (!text) return 'nota-' + Math.floor(Math.random()*1000);
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
