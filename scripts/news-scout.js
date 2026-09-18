/**
 * BOT SCOUT DE NOTICIAS AUTOMÁTICO — THE NEW INDIE WAVE
 * Rastrea feeds RSS de medios de música (Pitchfork, MondoSonoro, Jenesaispop, Music Business Worldwide)
 * Extrae la noticia más relevante del día, la procesa con IA con voz editorial TNIW
 * (1.5 minutos de lectura, formato rápido, punchy) e inserta el artículo en Supabase.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const RSS_FEEDS = [
  { name: 'MondoSonoro', url: 'https://www.mondosonoro.com/feed/', lang: 'es' },
  { name: 'Jenesaispop', url: 'https://jenesaispop.com/feed/', lang: 'es' },
  { name: 'Pitchfork News', url: 'https://pitchfork.com/feed/feed-news/rss', lang: 'en' },
  { name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed/', lang: 'en' }
];

async function runNewsScout() {
  console.log('🤖 [News Scout TNIW] Iniciando patrullaje de noticias musicales...');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
    process.exit(1);
  }

  // 1. Obtener slugs existentes en Supabase para evitar duplicados
  let existingSlugs = new Set();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=slug`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      rows.forEach(r => existingSlugs.add(r.slug));
      console.log(`✓ Verificados ${existingSlugs.size} artículos existentes en Supabase.`);
    }
  } catch (err) {
    console.warn('Aviso: no se pudieron consultar slugs previos:', err.message);
  }

  // 2. Rastreo de Feeds RSS
  const candidateArticles = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`📡 Consultando feed: ${feed.name}...`);
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 TNIW-NewsScout/1.0' }
      });
      if (!response.ok) continue;

      const xml = await response.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      // Revisar los 3 primeros de cada feed
      for (const rawItem of items.slice(0, 3)) {
        const titleMatch = rawItem.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = rawItem.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = rawItem.match(/<description>([\s\S]*?)<\/description>/);

        if (titleMatch && linkMatch) {
          const rawTitle = cleanXml(titleMatch[1]);
          const link = cleanXml(linkMatch[1]);
          const desc = descMatch ? cleanXml(descMatch[1]) : '';

          candidateArticles.push({
            source: feed.name,
            lang: feed.lang,
            title: rawTitle,
            link,
            desc
          });
        }
      }
    } catch (err) {
      console.warn(`Aviso al leer ${feed.name}:`, err.message);
    }
  }

  console.log(`🎯 Encontrados ${candidateArticles.length} candidatos de noticias.`);
  if (candidateArticles.length === 0) {
    console.log('No hay noticias nuevas para procesar.');
    return;
  }

  // 3. Seleccionar la mejor noticia que no haya sido procesada
  let selected = null;
  for (const candidate of candidateArticles) {
    const testSlug = slugify(candidate.title);
    if (!existingSlugs.has(testSlug) && !Array.from(existingSlugs).some(s => s.includes(testSlug.slice(0, 20)))) {
      selected = candidate;
      break;
    }
  }

  if (!selected) {
    console.log('✓ Todas las noticias encontradas ya fueron publicadas previamente. Cero duplicados.');
    return;
  }

  console.log(`⭐ Noticia seleccionada para redactar: "${selected.title}" (${selected.source})`);

  // 4. Invocar generación con IA o Generador Editorial
  const prompt = `Noticia de última hora tomada de ${selected.source}:
Título original: "${selected.title}"
Detalles y contexto: "${selected.desc}"
Enlace fuente: ${selected.link}`;

  const generatedArticle = await generateEditorialPiece(prompt, selected.title);

  // 5. Inyectar en Supabase
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(generatedArticle)
  });

  if (insertRes.ok) {
    console.log(`🎉 ¡ÉXITO! Artículo publicado automáticamente en el blog:`);
    console.log(`   Título: "${generatedArticle.title}"`);
    console.log(`   Slug: /blog#${generatedArticle.slug}`);
  } else {
    const errText = await insertRes.text();
    console.error('❌ Error al guardar en Supabase:', errText);
  }
}

async function generateEditorialPiece(promptContext, originalTitle) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `Eres Rodrigo DL Moral, curador y director de The New Indie Wave (TNIW).
Tu misión es transformar una noticia de la industria musical en una nota periodística rápida, fresca y con gancho para nuestra audiencia.
REGLAS:
- Lectura de 1 a 1.5 minutos (220 a 300 palabras).
- Cero tecnicismos aburridos, cero clichés de IA.
- Tono directo, enfocado en el impacto para los amantes de la música independiente.
- Responde ÚNICAMENTE un JSON válido con esta estructura:
{
  "title": "Titular con gancho brutal (máximo 12 palabras)",
  "slug": "slug-limpio-en-minusculas",
  "summary": "Resumen en 2 oraciones (máximo 30 palabras)",
  "content": "Cuerpo en HTML con <p class=\"lead\">, <h2>, <ul> con 3 viñetas clave, y un <blockquote> con una cita reflexiva",
  "category": "Industria Musical",
  "read_time": "1.5 min",
  "tags": ["Actualidad", "Música Indie", "Tendencias"],
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
          return buildArticleObject(parsed);
        }
      }
    } catch(e) {
      console.warn("Gemini falló en scout:", e.message);
    }
  }

  // Fallback autónomo si no hay API externa
  const slug = `scout-${slugify(originalTitle)}-${Date.now().toString().slice(-4)}`;
  return {
    slug,
    title: `Radar de Noticias: ${originalTitle.slice(0, 70)}`,
    summary: `Los detalles más relevantes sobre ${originalTitle} y lo que significa para la escena musical en este momento.`,
    content: `
      <p class="lead">El radar sonoro no descansa: <strong>${originalTitle}</strong> acaba de sacudir las noticias del día en el circuito musical.</p>
      <h2>Puntos clave para entender la noticia:</h2>
      <ul>
        <li><strong>El contexto:</strong> Un movimiento que refleja cómo las reglas de la industria siguen evolucionando a gran velocidad.</li>
        <li><strong>La postura TNIW:</strong> Lo importante sigue siendo cómo esto impacta la creatividad y el espacio para propuestas independientes.</li>
        <li><strong>Próximos pasos:</strong> Estaremos atentos a las repercusiones de este anuncio en los próximos festivales y lanzamientos.</li>
      </ul>
      <blockquote>"Las tendencias van y vienen a velocidad absurda; las canciones con identidad son las únicas que sobreviven al paso del tiempo." — Rodrigo DL Moral</blockquote>
    `,
    category: 'Industria Musical',
    author: 'Rodrigo DL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    read_time: '1.5 min',
    tags: ['Industria Musical', 'Noticias', 'TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

function buildArticleObject(parsed) {
  return {
    slug: parsed.slug || `noticia-${Date.now().toString().slice(-6)}`,
    title: parsed.title || 'Actualidad Musical // The New Indie Wave',
    summary: parsed.summary || 'Resumen de actualidad musical.',
    content: parsed.content || '<p>Contenido en actualización.</p>',
    category: parsed.category || 'Industria Musical',
    author: 'Rodrigo DL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    read_time: parsed.read_time || '1.5 min',
    tags: parsed.tags || ['Industria Musical', 'TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

function cleanXml(str) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function slugify(text) {
  if (!text) return 'nota-' + Math.floor(Math.random()*1000);
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

runNewsScout();
