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

        <blockquote>"${escapeHtml(cleanFeedback)}" — <strong>Rodrigo DL Moral</strong>, curador de The New Indie Wave</blockquote>

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
        author: 'Rodrigo DL Moral',
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

      articlePayload = await generateArticleWithAI({
        topic: topic.trim(),
        category,
        auto_publish
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

async function generateArticleWithAI({ topic, category, auto_publish }) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `Eres Rodrigo DL Moral, fundador y curador del colectivo musical independiente "The New Indie Wave" (TNIW).
Tu misión es redactar un artículo editorial rápido, punchy, fresco y directo al hueso para músicos independientes y amantes de la música.
CRÍTICA Y ESTILO ESTRICTO:
- Lectura rápida de 1 a 1.5 minutos (alrededor de 200 a 300 palabras).
- CERO tecnicismos académicos, CERO clichés de IA como "en el vasto tapiz", "es crucial", "sumérgete", "un testimonio de".
- Tono directo, honesto, como una charla entre colegas de estudio o un hilo viral bien armado: con ganchos inmediatos, párrafos cortos de 2 líneas, viñetas para escanear y una cita editorial destacada.
- Debes responder ÚNICAMENTE un objeto JSON válido con los siguientes campos:
{
  "title": "Título corto con gancho brutal (máximo 12 palabras)",
  "slug": "slug-en-minusculas-con-guiones",
  "summary": "Resumen directo en 2 oraciones (máximo 30 palabras)",
  "content": "Cuerpo del artículo en formato HTML con etiquetas <p class=\"lead\">, <h2>, <ul> o <ol>, <li>, y un <blockquote> con una frase contundente",
  "read_time": "1.5 min",
  "tags": ["Etiqueta1", "Etiqueta2", "Etiqueta3"],
  "image_keyword": "palabra en inglés para foto de Unsplash, ej: synthesizer, vinyl, cassette, guitar, concert"
}`;

  const userPrompt = `Tema o instrucción solicitada: "${topic}". Categoría: "${category}".`;

  // 1. INTENTO CON GEMINI (SI ESTÁ CONFIGURADO)
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
          return formatGeneratedPayload(parsed, category, auto_publish);
        }
      }
    } catch (e) {
      console.warn("Gemini fallo, probando fallback:", e.message);
    }
  }

  // 2. INTENTO CON GROQ (SI ESTÁ CONFIGURADO)
  if (GROQ_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const rawJson = groqData.choices?.[0]?.message?.content;
        if (rawJson) {
          const parsed = JSON.parse(cleanJson(rawJson));
          return formatGeneratedPayload(parsed, category, auto_publish);
        }
      }
    } catch (e) {
      console.warn("Groq fallo, probando siguiente:", e.message);
    }
  }

  // 3. INTENTO CON OPENAI (SI ESTÁ CONFIGURADO)
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
          return formatGeneratedPayload(parsed, category, auto_publish);
        }
      }
    } catch (e) {
      console.warn("OpenAI fallo:", e.message);
    }
  }

  // 4. MOTOR EDITORIAL AUTÓNOMO PUNCHY (FALLBACK SEGURO)
  const title = `Lo que debes saber sobre: ${capitalize(topic)}`;
  const slug = `editorial-${slugify(topic)}-${Date.now().toString().slice(-4)}`;
  const summary = `Un análisis rápido y al grano sobre ${topic}, enfocado en artistas independientes que buscan impacto real en 2026.`;
  const content = `
    <p class="lead">Hablemos claro sobre <strong>${escapeHtml(topic)}</strong>: en una escena musical saturada de ruido y fórmulas copiadas, quien no entiende este principio está regalando su tiempo y sus canciones.</p>

    <h2>3 puntos clave que nadie te dice:</h2>
    <ul>
      <li><strong>El algoritmo no es tu enemigo, es un espejo:</strong> Si tu música no retiene la atención en los primeros 10 segundos, no es culpa de Spotify; es que falta afilar el gancho inicial.</li>
      <li><strong>Comunidad antes que números vacíos:</strong> Vale 100 veces más tener 200 oyentes leales que te compran una playera y van a tus shows que 20,000 streams de bots en Asia.</li>
      <li><strong>Calidad sobre prisa:</strong> Tómate el tiempo de cuidar el máster, la portada y la historia detrás de tu rola antes de soltarla al vacío de internet.</li>
    </ul>

    <blockquote>"El mayor error de un proyecto indie no es la falta de presupuesto: es la falta de paciencia y autenticidad en su mensaje."</blockquote>

    <p>Aplica esto en tu próximo lanzamiento y verás cómo la respuesta de la gente real cambia por completo.</p>
  `;

  return {
    slug,
    title,
    summary,
    content,
    category,
    author: 'Rodrigo DL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: getRandomMusicCover(),
    read_time: '1.5 min',
    tags: [category, 'Música Indie', 'Consejos', 'TNIW'],
    featured: false,
    published: auto_publish !== false,
    published_at: new Date().toISOString()
  };
}

function formatGeneratedPayload(parsed, category, auto_publish) {
  const images = {
    guitar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    vinyl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    studio: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    synth: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    concert: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80'
  };

  const key = (parsed.image_keyword || '').toLowerCase();
  const matchedImg = Object.keys(images).find(k => key.includes(k)) ? images[Object.keys(images).find(k => key.includes(k))] : getRandomMusicCover();

  return {
    slug: parsed.slug || `editorial-${Date.now().toString().slice(-6)}`,
    title: parsed.title || 'Crónica Editorial // The New Indie Wave',
    summary: parsed.summary || 'Análisis independiente sobre la música actual.',
    content: parsed.content || '<p>Contenido editorial en preparación.</p>',
    category: category || 'Industria Musical',
    author: 'Rodrigo DL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: matchedImg,
    read_time: parsed.read_time || '1.5 min',
    tags: parsed.tags || [category, 'TNIW'],
    featured: false,
    published: auto_publish !== false,
    published_at: new Date().toISOString()
  };
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
