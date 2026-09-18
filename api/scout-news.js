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
  { name: 'WARP Magazine (México)', url: 'https://warp.la/feed/', region: 'México' },
  { name: 'Sopitas Música (México)', url: 'https://www.sopitas.com/feed/', region: 'México' },
  { name: 'Setlist.me (México)', url: 'https://setlist.me/feed/', region: 'México' },
  { name: 'Indie Hoy (Latam)', url: 'https://indiehoy.com/feed/', region: 'Latinoamérica' },
  { name: 'Cuchara Sónica (Latam)', url: 'https://cucharasonica.com/feed/', region: 'Latinoamérica' },
  { name: 'MondoSonoro (España)', url: 'https://www.mondosonoro.com/feed/', region: 'España' },
  { name: 'Binaural (España)', url: 'https://binaural.es/feed/', region: 'España' },
  { name: 'Muzikalia (España)', url: 'https://muzikalia.com/feed/', region: 'España' },
  { name: 'Jenesaispop (España)', url: 'https://jenesaispop.com/feed/', region: 'España' }
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

      const meta = { title, source: source || 'Medios Indie', region: region || 'Iberoamérica', link: link || '#', image_url };
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

      // Auto-archivar notas antiguas para mantener exactamente 7 en portada
      try {
        const pubCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&order=published_at.desc`, {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        });
        if (pubCheckRes.ok) {
          const pubArticles = await pubCheckRes.json();
          if (pubArticles && pubArticles.length > 7) {
            const toArchive = pubArticles.slice(7);
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
            console.log(`[scout-news] Auto-archivadas ${toArchive.length} notas antiguas para mantener el límite de 7.`);
          }
        }
      } catch (archiveErr) {
        console.warn('[scout-news] Error auto-archivando notas:', archiveErr);
      }

      return res.status(200).json({
        success: true,
        message: '¡Noticia redactada y publicada en el Blog!',
        article: inserted && inserted[0] ? inserted[0] : article,
        url: `https://www.thenewindiewave.online/blog#${article.slug}`
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}

function isMusicRelevant(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  const musicKeywords = [
    'canción', 'cancion', 'álbum', 'album', 'disco', 'single', 'sencillo', 'tema', 'video',
    'concierto', 'gira', 'festival', 'banda', 'estrena', 'lanzamiento', 'guitarra', 'indie',
    'shoegaze', 'post-punk', 'rock', 'pop', 'presenta', 'estreno', 'música', 'musica'
  ];
  const ignoreKeywords = ['película', 'pelicula', 'serie', 'tráiler', 'trailer', 'netflix', 'hbo', 'taquilla', 'marvel'];
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

async function generateEditorialPiece(promptContext, meta) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `Eres Rodrigo dL Moral, curador de "The New Indie Wave" (TNIW).
Tu misión es transformar una noticia de la escena indie de ${meta.region} (${meta.source}) en una nota rápida, picante, fresca y de alta retención para músicos y fans en celular.
REGLAS:
- Lectura rápida de 1 a 1.5 minutos (alrededor de 230 palabras).
- Cero tecnicismos aburridos, cero clichés de IA.
- Tono directo, conversacional, destacando por qué le importa a la comunidad indie de habla hispana.
- FIRMA: — Rodrigo dL Moral
- Responde ÚNICAMENTE un JSON válido con esta estructura:
{
  "title": "Titular magnético con gancho (máximo 12 palabras)",
  "slug": "slug-limpio-en-minusculas",
  "summary": "Resumen directo en 2 oraciones (máximo 30 palabras)",
  "content": "Cuerpo en HTML con <p class=\"lead\">, <h2>, <ul> con 3 viñetas clave, y un <blockquote> reflexivo con la voz de Rodrigo dL Moral",
  "category": "Cultura Indie",
  "read_time": "1.5 min",
  "tags": ["${meta.region}", "Música Indie", "Lanzamiento", "TNIW"],
  "artist_name": "Nombre exacto de la banda o artista principal (ej. Editors, Clubz, Carolina Durante). Si no aplica, dejar vacío."
}`;

  if (GROQ_KEY) {
    const groqModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
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
              { role: 'user', content: promptContext }
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
            max_tokens: 1200
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
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${promptContext}` }] }],
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

  // Fallback autónomo
  const realImg = await resolveRealArticleImage({
    suppliedImg: meta.image_url,
    articleUrl: meta.link,
    title: meta.title
  });

  const slug = `radar-${slugify(meta.region)}-${slugify(meta.title)}-${Date.now().toString().slice(-4)}`;
  return {
    slug,
    title: `Radar ${meta.region}: ${meta.title.slice(0, 65)}`,
    summary: `Lo que está pasando en la escena de ${meta.region}: ${meta.title}. Te lo resumimos en 1 minuto.`,
    content: `
      <p class="lead">El pulso de la música independiente en <strong>${meta.region}</strong> sigue moviéndose rápido. Hoy la conversación gira en torno a: <strong>${meta.title}</strong>.</p>
      <h2>3 claves para entender la movida:</h2>
      <ul>
        <li><strong>El contexto:</strong> Reportado por ${meta.source}, este movimiento confirma la ebullición creativa en los circuitos independientes de la región.</li>
        <li><strong>El sonido y la estética:</strong> Nuevos aires que refrescan el panorama sonoro y abren camino para más proyectos autogestivos.</li>
        <li><strong>La lectura de TNIW:</strong> Mientras los grandes medios se concentran en lo mainstream, aquí celebramos las propuestas que tienen identidad y corazón.</li>
      </ul>
      <blockquote>"En Iberoamérica la música indie no es una moda pasajera: es la respuesta más honesta de una generación que no pide permiso para sonar." — Rodrigo dL Moral</blockquote>
      <p>Fuente original: <a href="${meta.link}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime);">${meta.source} ↗</a></p>
    `,
    category: 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: realImg,
    read_time: '1.5 min',
    tags: [meta.region, 'Cultura Indie', 'Música', 'TNIW'],
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

  return {
    slug: parsed.slug || `noticia-${Date.now().toString().slice(-6)}`,
    title: parsed.title || 'Actualidad Musical // The New Indie Wave',
    summary: parsed.summary || 'Resumen de actualidad musical.',
    content: parsed.content || '<p>Contenido en actualización.</p>',
    category: parsed.category || 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: realImg,
    read_time: parsed.read_time || '1.5 min',
    tags: parsed.tags || [meta.region, 'Indie', 'TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

function cleanXml(str) {
  return str.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '').replace(/&#8216;|&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&amp;/g, '&').trim();
}

function slugify(text) {
  if (!text) return 'nota-' + Math.floor(Math.random()*1000);
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
