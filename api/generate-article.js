if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

  try {
    const {
      type = 'custom_topic', // 'custom_topic' | 'track_spotlight'
      topic,
      category = 'Industria Musical',
      auto_publish = true,
      // Datos para 'track_spotlight'
      artist_name,
      song_title,
      genre,
      country,
      playlist,
      feedback,
      spotify_url,
      cover_url
    } = req.body || {};

    let articlePayload = null;

    if (type === 'track_spotlight') {
      if (!artist_name || !song_title) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (artist_name, song_title).' });
      }

      let spotifyEmbedHtml = '';
      if (spotify_url) {
        const match = spotify_url.match(/track\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          const trackId = match[1];
          spotifyEmbedHtml = `
            <div style="margin: 24px 0;">
              <iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
            </div>
          `;
        }
      }

      const cleanFeedback = feedback && feedback.trim().length > 10 
        ? feedback.trim() 
        : 'Propuesta sonora con identidad genuina, producción orgánica y un gancho melódico que destaca de inmediato.';

      const slug = `radar-tniw-${slugify(artist_name)}-${slugify(song_title)}-${Date.now().toString().slice(-4)}`;
      const title = `Descubrimiento Radar: "${song_title}" de ${artist_name}`;
      const summary = `Desde ${country || 'la escena independiente'}, ${artist_name} presenta "${song_title}", una descarga fresca de ${genre || 'música indie'} recién añadida a nuestras playlists oficiales.`;

      const content = `
        <p class="lead">Cada semana escuchamos cientos de canciones de toda Iberoamérica en <strong>The New Indie Wave</strong>. Muy pocas logran atrapar la atención desde los primeros 15 segundos con tanta honestidad y carácter como <strong>"${escapeHtml(song_title)}"</strong> de <strong>${escapeHtml(artist_name)}</strong>.</p>

        <blockquote>"${escapeHtml(cleanFeedback)}" — <strong>Rodrigo dL Moral</strong>, curador de The New Indie Wave</blockquote>

        <h2>¿Por qué llamó nuestra atención?</h2>
        <ul>
          <li><strong>Identidad y textura:</strong> Se aleja de la fórmula predecible de los algoritmos y apuesta por una estética sonora viva y con matices.</li>
          <li><strong>Producción:</strong> El balance entre los instrumentos y la voz logra transmitir una atmósfera íntima sin perder fuerza.</li>
          <li><strong>Curaduría Oficial:</strong> Seleccionada para rotar permanentemente en nuestra playlist <em>"${escapeHtml(playlist || 'Selección Oficial TNIW')}"</em> en Spotify.</li>
        </ul>

        ${spotifyEmbedHtml}

        <p>Sigue de cerca a <strong>${escapeHtml(artist_name)}</strong> y escucha la canción completa directamente en nuestras listas oficiales para apoyar su crecimiento orgánico.</p>
      `;

      articlePayload = {
        slug,
        title,
        summary,
        content,
        category: 'Artistas en el Radar',
        author: 'Rodrigo dL Moral',
        author_role: 'Curador & Fundador TNIW',
        author_avatar: 'rodrigo_studio_web.jpg',
        image_url: cover_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
        read_time: '1.5 min',
        tags: [artist_name, genre || 'Indie', 'Radar TNIW', 'Lanzamiento'],
        featured: false,
        published: auto_publish !== false,
        published_at: new Date().toISOString()
      };

    } else {
      if (!topic || topic.trim().length < 4) {
        return res.status(400).json({ error: 'Debes proporcionar un tema o instrucción en el campo topic.' });
      }

      // INVESTIGACIÓN WEB EN TIEMPO REAL: Extraer hechos reales de internet antes de redactar
      const liveFacts = await fetchLiveWebFacts(topic.trim());

      articlePayload = await generateArticleWithAI({
        topic: topic.trim(),
        category,
        auto_publish,
        liveFacts
      });
    }

    // Inyectar en Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(articlePayload)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Error insertando en Supabase:', errText);
      return res.status(500).json({ 
        error: 'No se pudo guardar el artículo en Supabase', 
        details: errText,
        generatedArticle: articlePayload 
      });
    }

    const insertedData = await insertRes.json();

    // Auto-archivar notas antiguas para que la portada del Blog muestre exactamente 7 noticias
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
          console.log(`[generate-article] Auto-archivadas ${toArchive.length} notas antiguas para mantener el límite de 7.`);
        }
      }
    } catch (archiveErr) {
      console.warn('[generate-article] Error auto-archivando notas:', archiveErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Artículo generado y publicado con éxito en The New Indie Wave.',
      article: insertedData && insertedData[0] ? insertedData[0] : articlePayload,
      url: `https://www.thenewindiewave.online/blog#${articlePayload.slug}`
    });

  } catch (error) {
    console.error('Error en generate-article:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}

// BUSCADOR EN VIVO DE INTERNET (Extrae hechos, fechas, recintos y noticias en tiempo real)
async function fetchLiveWebFacts(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return [];

    const html = await res.text();
    const results = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;

    let match;
    while ((match = regex.exec(html)) !== null && results.length < 6) {
      const cleanSnippet = match[1].replace(/<[^>]+>/g, '').trim();
      if (cleanSnippet && cleanSnippet.length > 20) {
        results.push(cleanSnippet);
      }
    }
    return results;
  } catch (err) {
    console.warn("Aviso: no se pudo consultar web en vivo:", err.message);
    return [];
  }
}

async function generateArticleWithAI({ topic, category, auto_publish, liveFacts = [] }) {
  const GROQ_KEY = process.env.GROQ_API_KEY || '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';
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const factsContext = liveFacts.length > 0 
    ? `\nHECHOS Y DATOS REALES EXTRAÍDOS EN VIVO DE INTERNET SOBRE ESTA NOTICIA:\n- ${liveFacts.join('\n- ')}\nIMPORTANTE: Basa tu crónica en estos hechos verídicos (fechas, recintos, artistas, canciones, contexto). NO inventes datos que contradigan la realidad.`
    : '';

  const systemPrompt = `Eres Rodrigo dL Moral, fundador y curador de "The New Indie Wave" (TNIW).
Tu misión es escribir una crónica o reseña de actualidad musical con periodismo real, rápido, con datos concretos y directo al hueso.
REGLAS FUNDAMENTALES:
- RIGOR CON LOS HECHOS: Habla de los datos reales del suceso (nombres propios, recintos como David Geffen Hall, auditorios, festivales, canciones, premios como Latin Grammys, discografía e instrumentos). CERO generalidades vacías como "marca un precedente" o "desafía las fórmulas".
- FORMATO DE ALTA RETENCIÓN: Lectura de 1 a 1.5 minutos (220 a 300 palabras). Cero relleno aburrido corporativo.
- VOZ EDITORIAL: Fresco, apasionado, de tú a tú, crítico pero respetuoso del arte.
- FIRMA: En los blockquotes siempre firmado como: — Rodrigo dL Moral
- RESPONDE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "title": "Titular con gancho brutal que resuma la noticia real (máximo 12 palabras)",
  "slug": "slug-amigable-en-minusculas-con-guiones",
  "summary": "Resumen directo en 2 oraciones que enganche al lector (máximo 30 palabras)",
  "content": "Cuerpo en HTML limpio con <p class=\"lead\">, <h2>, <ul> con 3 puntos clave con viñetas con hechos y nombres reales, y un <blockquote> reflexivo firmado por Rodrigo dL Moral",
  "read_time": "1.5 min",
  "tags": ["Etiqueta1", "Etiqueta2", "Etiqueta3"],
  "artist_name": "Nombre exacto de la banda o artista principal para vincular su foto real oficial (ej. Editors, Lizzo, Dudamel, Bad Bunny, etc.). Si es un tema conceptual sin artista, dejar en blanco."
}`;

  const userPrompt = `Noticia o tema solicitado: "${topic}". Categoría: "${category}".${factsContext}`;

  // 1. GROQ ULTRA RÁPIDO CON MODELOS VERIFICADOS (Qwen 3.8 27B / GPT-OSS 120B)
  if (GROQ_KEY) {
    const groqModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
    for (const modelName of groqModels) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            temperature: 0.6,
            max_tokens: 1200
          })
        });
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const rawJson = groqData.choices?.[0]?.message?.content;
          if (rawJson) {
            const parsed = JSON.parse(cleanJson(rawJson));
            return await formatGeneratedPayload(parsed, category, auto_publish, topic);
          }
        }
      } catch (e) {
        console.warn(`Groq (${modelName}) fallo:`, e.message);
      }
    }
  }

  // 2. GEMINI CON DATOS EN VIVO
  if (GEMINI_KEY) {
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawJson = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = JSON.parse(cleanJson(rawJson));
          return await formatGeneratedPayload(parsed, category, auto_publish, topic);
        }
      }
    } catch (e) {
      console.warn("Gemini fallo, probando siguiente:", e.message);
    }
  }

  // 3. OPENAI CON DATOS EN VIVO
  if (OPENAI_KEY) {
    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const rawJson = aiData.choices?.[0]?.message?.content;
        if (rawJson) {
          const parsed = JSON.parse(cleanJson(rawJson));
          return await formatGeneratedPayload(parsed, category, auto_publish, topic);
        }
      }
    } catch (e) {
      console.warn("OpenAI fallo:", e.message);
    }
  }

  // 4. MOTOR EDITORIAL BASADO EN HECHOS (SI NO HAY CLAVE DE PAGO AÚN)
  const factsListHtml = liveFacts.length > 0 
    ? liveFacts.slice(0, 3).map(f => `<li><strong>Hecho clave:</strong> ${escapeHtml(f)}</li>`).join('')
    : `<li><strong>Relevancia:</strong> Marca un precedente clave para la escena y la industria musical independiente.</li>
       <li><strong>Impacto:</strong> Desafía las fórmulas comerciales tradicionales y apuesta por una propuesta con carácter propio.</li>
       <li><strong>Lectura TNIW:</strong> Una muestra de que el cruce de géneros y la audacia sonora siguen siendo el verdadero motor cultural.</li>`;

  const title = `Lo que debes saber: ${capitalize(topic)}`;
  const slug = `noticia-${slugify(topic)}-${Date.now().toString().slice(-4)}`;
  const summary = liveFacts.length > 0 
    ? liveFacts[0].slice(0, 140) + '...'
    : `Análisis directo sobre ${topic} desde la perspectiva editorial de The New Indie Wave.`;

  const content = `
    <p class="lead">Las noticias vuelan, pero los momentos culturales que definen la música se analizan con calma. <strong>${escapeHtml(topic)}</strong> no es una fecha más en el calendario: es una declaración de intenciones.</p>

    <h2>Los puntos que marcan la diferencia:</h2>
    <ul>
      ${factsListHtml}
    </ul>

    <blockquote>"Cuando las barreras de género se rompen y los artistas se atreven a arriesgar, la música recupera su poder de sorprender." — <strong>Rodrigo dL Moral</strong></blockquote>

    <p>Seguiremos de cerca las repercusiones de este suceso y su impacto en los artistas emergentes de nuestra comunidad.</p>
  `;

  const realImg = await resolveRealNewsImage({
    artistName: topic,
    title
  });

  return {
    slug,
    title,
    summary,
    content,
    category,
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: realImg,
    read_time: '1.5 min',
    tags: [category, 'Actualidad', 'Música', 'TNIW'],
    featured: false,
    published: auto_publish !== false,
    published_at: new Date().toISOString()
  };
}

async function formatGeneratedPayload(parsed, category, auto_publish, topic) {
  const realImg = await resolveRealNewsImage({
    articleUrl: topic && topic.includes('http') ? topic.match(/https?:\/\/[^\s]+/)?.[0] : null,
    artistName: parsed.artist_name || (parsed.tags && parsed.tags[0]) || topic,
    title: parsed.title || topic
  });

  return {
    slug: parsed.slug || `editorial-${Date.now().toString().slice(-6)}`,
    title: parsed.title || 'Crónica Editorial // The New Indie Wave',
    summary: parsed.summary || 'Análisis independiente sobre la música actual.',
    content: parsed.content || '<p>Contenido editorial en preparación.</p>',
    category: category || 'Industria Musical',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: realImg,
    read_time: parsed.read_time || '1.5 min',
    tags: parsed.tags || [category, 'TNIW'],
    featured: false,
    published: auto_publish !== false,
    published_at: new Date().toISOString()
  };
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
  const clean = name.trim()
    .replace(/^reseña\s+(sobre\s+)?(la\s+)?(nueva\s+)?(canción|cancion|disco|rolita|rola)\s+(de\s+)?/i, '')
    .replace(/^nueva\s+(canción|cancion|disco)\s+(de\s+)?/i, '')
    .replace(/^de\s+/i, '')
    .trim();

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

async function resolveRealNewsImage({ articleUrl, artistName, title }) {
  // 1. Extraer imagen original del artículo fuente si hay enlace
  if (articleUrl && articleUrl.startsWith('http')) {
    const ogImg = await fetchOgImageFromUrl(articleUrl);
    if (ogImg) return ogImg;
  }
  // 2. Buscar foto oficial de la banda / artista en alta resolución
  if (artistName) {
    const artistImg = await fetchRealArtistImage(artistName);
    if (artistImg) return artistImg;
  }
  // 3. Intentar extraer el nombre del artista del título
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
  // Fallback estético si es tema abstracto
  return getRandomMusicCover();
}

function getRandomMusicCover() {
  const covers = [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80'
  ];
  return covers[Math.floor(Math.random() * covers.length)];
}

function cleanJson(str) {
  return str.replace(/```json/g, '').replace(/```/g, '').trim();
}

function slugify(text) {
  if (!text) return 'nota-' + Math.floor(Math.random()*1000);
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(s) {
  if (typeof s !== 'string' || !s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
