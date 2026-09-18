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

// FUENTES OFICIALES DE LA ESCENA INDIE: MÉXICO (10 MEDIOS), LATINOAMÉRICA Y ESPAÑA
const RSS_FEEDS = [
  // 🇲🇽 MÉXICO (ALMA MATER TNIW - 10 MEDIOS LÍDERES)
  { name: 'WARP Magazine (México)', url: 'https://warp.la/feed/', region: 'México' },
  { name: 'Indie Rocks! (México)', url: 'https://www.indierocks.mx/feed/', region: 'México' },
  { name: 'Sopitas Música (México)', url: 'https://www.sopitas.com/feed/', region: 'México' },
  { name: 'Me Hace Ruido (México)', url: 'https://mehaceruido.com/feed/', region: 'México' },
  { name: 'Filter México', url: 'https://filtermexico.com/feed/', region: 'México' },
  { name: 'Setlist.me (México)', url: 'https://setlist.me/feed/', region: 'México' },
  { name: 'Revista Kuadro (México)', url: 'https://revistakuadro.com/feed/', region: 'México' },
  { name: 'Pólvora Rock (México)', url: 'https://polvora.com.mx/feed/', region: 'México' },
  { name: 'Grita Radio (México)', url: 'https://gritaradio.com/feed/', region: 'México' },
  { name: 'Rolling Stone en Español (México)', url: 'https://es.rollingstone.com/feed/', region: 'México' },

  // 🌎 LATINOAMÉRICA (Argentina, Chile, Colombia, Perú, etc.)
  { name: 'Indie Hoy (Latinoamérica)', url: 'https://indiehoy.com/feed/', region: 'Latinoamérica' },
  { name: 'Cuchara Sónica (Iberoamérica)', url: 'https://cucharasonica.com/feed/', region: 'Latinoamérica' },

  // 🇪🇸 ESPAÑA
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
  const GROQ_KEY = process.env.GROQ_API_KEY || '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';
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `Eres redactor y curador editorial para la revista digital "The New Indie Wave" (TNIW).
Tu misión es redactar una crónica o reseña de actualidad musical sobre la siguiente noticia de la escena indie de ${meta.region} (reportada originalmente por ${meta.source}).

DIRECTRICES EDITORIALES ESTRICTAS:
1. PERIODISMO MUSICAL REAL Y NATURAL:
   - Redacta en prosa periodística fluida, atractiva y orgánica (2 a 3 párrafos bien estructurados).
   - PROHIBIDO USAR LISTAS DE "3 CLAVES PARA ENTENDER LA MOVIDA", VIÑETAS ARTIFICIALES O FÓRMULAS REPETITIVAS.
   - PROHIBIDO ROTUNDAMENTE FABRICAR O INVENTAR CITAS O FRASES ATRIBUIDAS A RODRIGO DL MORAL. No inventes declaraciones ni uses blockquotes falsos.
   - Párrafo 1: Noticia directa y gancho (qué pasó, qué banda o artista protagoniza la novedad, qué lanzaron o anunciaron).
   - Párrafo 2: Contexto musical, sonido, estética de la propuesta, colaboraciones o relevancia para la escena de ${meta.region}.
   - Párrafo 3: Conclusión o recomendación de escucha con el espíritu independiente de TNIW.
2. ATRIBUCIÓN Y TRANSPARENCIA ÉTICA:
   - Al final incluye el crédito de la fuente original:
     <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">Fuente original: <a href="${meta.link}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${meta.source} ↗</a> · Foto: Vía ${meta.source} / Prensa oficial</div>
3. FORMATO JSON OBLIGATORIO:
Responde ÚNICAMENTE un JSON válido con esta estructura:
{
  "title": "Titular periodístico atractivo y natural (máximo 12 palabras)",
  "slug": "slug-limpio-en-minusculas-con-guiones",
  "summary": "Resumen directo de la noticia en 2 oraciones (máximo 35 palabras)",
  "content": "Cuerpo completo del artículo en HTML limpio con párrafos <p> y <div class=\"source-credit\"> sin listas forzadas ni citas inventadas",
  "photo_credit": "Vía ${meta.source} / Prensa oficial",
  "category": "Cultura Indie",
  "read_time": "1.5 min",
  "tags": ["${meta.region}", "Música Indie", "Lanzamiento", "TNIW"]
}`;

  if (GROQ_KEY) {
    const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
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
            return buildArticleObject(parsed, meta);
          }
        }
      } catch(e) {}
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
          return buildArticleObject(parsed, meta);
        }
      }
    } catch(e) {
      console.warn("Gemini fallo:", e.message);
    }
  }

  // Fallback autónomo si no hay API externa
  const slug = `radar-${slugify(meta.region)}-${slugify(meta.title)}-${Date.now().toString().slice(-4)}`;
  const cleanDesc = (meta.desc || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  const summaryText = cleanDesc.length > 25
    ? (cleanDesc.slice(0, 160) + (cleanDesc.length > 160 ? '...' : ''))
    : `Novedades en la escena independiente de ${meta.region}: ${meta.title}. Cobertura vía ${meta.source}.`;

  const photoCredit = `Vía ${meta.source} / Prensa oficial`;

  return {
    slug,
    title: meta.title.length > 80 ? meta.title.slice(0, 77) + '...' : meta.title,
    summary: summaryText,
    content: `
      <p class="lead">El pulso de la música independiente en <strong>${escapeHtml(meta.region)}</strong> suma una nueva noticia destacada de la mano de <strong>${escapeHtml(meta.source)}</strong>: <strong>${escapeHtml(meta.title)}</strong>.</p>
      
      <p>${escapeHtml(cleanDesc || 'Un acontecimiento relevante que reafirma el dinamismo y la constante evolución de las propuestas sonoras que marcan la pauta en los circuitos autogestivos de la región.')}</p>

      <p>En <strong>The New Indie Wave</strong> seguimos de cerca el impacto de este tipo de anuncios y lanzamientos, manteniendo el compromiso de conectar a nuestra comunidad con la música que desafía los estándares comerciales.</p>

      <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
        Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: ${photoCredit}
      </div>
    `,
    category: 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    read_time: '1.5 min',
    tags: [meta.region, 'Música Indie', 'Radar TNIW'],
    featured: false,
    published: true,
    published_at: new Date().toISOString()
  };
}

function buildArticleObject(parsed, meta) {
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
    summary: parsed.summary || (meta.desc ? meta.desc.slice(0, 160) : 'Resumen de actualidad musical.'),
    content: contentHtml,
    category: parsed.category || 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    read_time: parsed.read_time || '1.5 min',
    tags: parsed.tags || [meta.region, 'Música Indie', 'Radar TNIW'],
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
