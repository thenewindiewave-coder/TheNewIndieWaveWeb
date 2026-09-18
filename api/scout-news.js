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

            if (titleMatch && linkMatch) {
              const title = cleanXml(titleMatch[1]);
              const link = cleanXml(linkMatch[1]);
              const desc = descMatch ? cleanXml(descMatch[1]) : '';

              if (isMusicRelevant(title, desc)) {
                const s = slugify(title);
                const isPublished = existingSlugs.has(s) || Array.from(existingSlugs).some(x => x.includes(s.slice(0, 20)));

                detectedNews.push({
                  source: feed.name,
                  region: feed.region,
                  title,
                  link,
                  desc: desc.slice(0, 180) + '...',
                  slug: s,
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
      const { title, source, region, link, desc } = req.body || {};

      if (!title) {
        return res.status(400).json({ error: 'Falta el título de la noticia.' });
      }

      const prompt = `Noticia indie de ${region || 'Iberoamérica'} vía ${source || 'Medios'}:
Título: "${title}"
Detalles: "${desc || ''}"
Fuente original: ${link || ''}`;

      const meta = { title, source: source || 'Medios Indie', region: region || 'Iberoamérica', link: link || '#' };
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

async function generateEditorialPiece(promptContext, meta) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `Eres Rodrigo DL Moral, curador de "The New Indie Wave" (TNIW).
Tu misión es transformar una noticia de la escena indie de ${meta.region} (${meta.source}) en una nota rápida, picante, fresca y de alta retención para músicos y fans en celular.
REGLAS:
- Lectura rápida de 1 a 1.5 minutos (alrededor de 230 palabras).
- Cero tecnicismos aburridos, cero clichés de IA.
- Tono directo, conversacional, destacando por qué le importa a la comunidad indie de habla hispana.
- Responde ÚNICAMENTE un JSON válido con esta estructura:
{
  "title": "Titular magnético con gancho (máximo 12 palabras)",
  "slug": "slug-limpio-en-minusculas",
  "summary": "Resumen directo en 2 oraciones (máximo 30 palabras)",
  "content": "Cuerpo en HTML con <p class=\"lead\">, <h2>, <ul> con 3 viñetas clave, y un <blockquote> reflexivo con la voz de Rodrigo",
  "category": "Cultura Indie",
  "read_time": "1.5 min",
  "tags": ["${meta.region}", "Música Indie", "Lanzamiento", "TNIW"],
  "image_keyword": "concert"
}`;

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
          return buildArticleObject(parsed, meta);
        }
      }
    } catch(e) {}
  }

  // Fallback autónomo
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
      <blockquote>"En Iberoamérica la música indie no es una moda pasajera: es la respuesta más honesta de una generación que no pide permiso para sonar." — Rodrigo DL Moral</blockquote>
      <p>Fuente original: <a href="${meta.link}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime);">${meta.source} ↗</a></p>
    `,
    category: 'Cultura Indie',
    author: 'Rodrigo DL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    read_time: '1.5 min',
    tags: [meta.region, 'Cultura Indie', 'Música', 'TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

function buildArticleObject(parsed, meta) {
  return {
    slug: parsed.slug || `noticia-${Date.now().toString().slice(-6)}`,
    title: parsed.title || 'Actualidad Musical // The New Indie Wave',
    summary: parsed.summary || 'Resumen de actualidad musical.',
    content: parsed.content || '<p>Contenido en actualización.</p>',
    category: parsed.category || 'Cultura Indie',
    author: 'Rodrigo DL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
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
