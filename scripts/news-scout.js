/**
 * BOT SCOUT DE NOTICIAS AUTOMÁTICO — THE NEW INDIE WAVE
 * Especializado 100% en la escena independiente de MÉXICO, LATINOAMÉRICA y ESPAÑA.
 * Rastrea los medios más influyentes de la cultura indie en español, extrae las noticias
 * más frescas, las procesa con IA y las publica en Supabase en formato rápido (1.5 min).
 */

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// FUENTES OFICIALES DE LA ESCENA INDIE: MÉXICO, LATINOAMÉRICA Y ESPAÑA
const RSS_FEEDS = [
  // MÉXICO
  { name: 'WARP Magazine (México)', url: 'https://warp.la/feed/', region: 'México' },
  { name: 'Sopitas Música (México)', url: 'https://www.sopitas.com/feed/', region: 'México' },
  { name: 'Setlist.me (México)', url: 'https://setlist.me/feed/', region: 'México' },

  // LATINOAMÉRICA (Argentina, Chile, Colombia, Perú, etc.)
  { name: 'Indie Hoy (Latinoamérica)', url: 'https://indiehoy.com/feed/', region: 'Latinoamérica' },
  { name: 'Cuchara Sónica (Iberoamérica)', url: 'https://cucharasonica.com/feed/', region: 'Latinoamérica' },

  // ESPAÑA
  { name: 'MondoSonoro (España)', url: 'https://www.mondosonoro.com/feed/', region: 'España' },
  { name: 'Binaural (España)', url: 'https://binaural.es/feed/', region: 'España' },
  { name: 'Muzikalia (España)', url: 'https://muzikalia.com/feed/', region: 'España' },
  { name: 'Jenesaispop (España)', url: 'https://jenesaispop.com/feed/', region: 'España' }
];

async function runNewsScout() {
  console.log('🤖 [TNIW Scout Bot] Iniciando patrullaje de medios indie en México, Latam y España...');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Falta SUPABASE_SERVICE_ROLE_KEY.');
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
    console.warn('Aviso al leer slugs previos:', err.message);
  }

  // 2. Rastreo de Feeds
  const candidateArticles = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`📡 [${feed.region}] Consultando: ${feed.name}...`);
      const response = await fetch(feed.url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TheNewIndieWave/1.0' 
        }
      });
      if (!response.ok) continue;

      const xml = await response.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const rawItem of items.slice(0, 4)) {
        const titleMatch = rawItem.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = rawItem.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = rawItem.match(/<description>([\s\S]*?)<\/description>/);

        if (titleMatch && linkMatch) {
          const rawTitle = cleanXml(titleMatch[1]);
          const link = cleanXml(linkMatch[1]);
          const desc = descMatch ? cleanXml(descMatch[1]) : '';

          // Filtrar noticias irrelevantes de cine o chismes; priorizar música y lanzamientos
          if (isMusicRelevant(rawTitle, desc)) {
            candidateArticles.push({
              source: feed.name,
              region: feed.region,
              title: rawTitle,
              link,
              desc
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Aviso en ${feed.name}:`, err.message);
    }
  }

  console.log(`🎯 Encontradas ${candidateArticles.length} noticias musicales candidatas.`);
  if (candidateArticles.length === 0) {
    console.log('No se encontraron noticias nuevas en este ciclo.');
    return;
  }

  // 3. Seleccionar la más fresca y no procesada
  let selected = null;
  for (const candidate of candidateArticles) {
    const testSlug = slugify(candidate.title);
    if (!existingSlugs.has(testSlug) && !Array.from(existingSlugs).some(s => s.includes(testSlug.slice(0, 20)))) {
      selected = candidate;
      break;
    }
  }

  if (!selected) {
    console.log('✓ Todas las noticias del día ya están cubiertas en el blog. Cero duplicados.');
    return;
  }

  console.log(`⭐ Noticia seleccionada: "${selected.title}" [${selected.region} - ${selected.source}]`);

  // 4. Redactar con IA o Motor Editorial
  const prompt = `Noticia indie de ${selected.region} vía ${selected.source}:
Título: "${selected.title}"
Detalles: "${selected.desc}"
Enlace fuente: ${selected.link}`;

  const article = await generateEditorialPiece(prompt, selected);

  // 5. Inyectar en Supabase
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

  if (insertRes.ok) {
    console.log(`🎉 ¡ÉXITO! Artículo publicado en the new indie wave:`);
    console.log(`   Título: "${article.title}"`);
    console.log(`   Región: ${selected.region}`);
    console.log(`   URL: /blog#${article.slug}`);

    // Auto-archivar notas antiguas para que la portada muestre exactamente 7 noticias
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
          console.log(`   Auto-archivadas ${toArchive.length} notas antiguas para mantener exactamente 7 en portada.`);
        }
      }
    } catch (archiveErr) {
      console.warn('   Error auto-archivando notas:', archiveErr);
    }
  } else {
    const errText = await insertRes.text();
    console.error('❌ Error al guardar en Supabase:', errText);
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
  
  if (ignoreKeywords.some(k => text.includes(k) && !text.includes('soundtrack'))) {
    return false;
  }
  return musicKeywords.some(k => text.includes(k));
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
    } catch(e) {
      console.warn("Gemini fallo:", e.message);
    }
  }

  // Fallback autónomo si no hay API externa
  const slug = `radar-${meta.region.toLowerCase()}-${slugify(meta.title)}-${Date.now().toString().slice(-4)}`;
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
    author: 'Rodrigo dL Moral',
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
