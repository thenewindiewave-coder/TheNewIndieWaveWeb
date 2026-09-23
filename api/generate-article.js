import crypto from 'crypto';

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const PLAYLIST_URL_MAP = {
  "Electrónica emergente para perder el control en la pista": "https://open.spotify.com/playlist/56UTFQQSDPuY5cjxDol5Ob",
  "Electronica emergente para perder el control en la pista": "https://open.spotify.com/playlist/56UTFQQSDPuY5cjxDol5Ob",
  "Mezcla de rolas urbanas para farmear Aura": "https://open.spotify.com/playlist/79SKuyss3MfkzvOJGnaisB",
  "Darkwave oscuro y atmosférico para la madrugada": "https://open.spotify.com/playlist/4mcJJz8GiKTuxieL9Jziln",
  "Música urbana con flow y ritmo para moverte": "https://open.spotify.com/playlist/7bbYPZ5ia4IGRP2fT47kXr",
  "Musica urbana con flow y ritmo para moverte": "https://open.spotify.com/playlist/7bbYPZ5ia4IGRP2fT47kXr",
  "Metal intenso para liberar toda tu energía": "https://open.spotify.com/playlist/5OLiBaOPAe5cBEdV1AoSd1",
  "Metal intenso para liberar toda tu energia": "https://open.spotify.com/playlist/5OLiBaOPAe5cBEdV1AoSd1",
  "Rock para sacar la rabia y el enojo acumulado": "https://open.spotify.com/playlist/6cuhRpfYmEt0vYCT9mFLKc",
  "SoftSongs para esos domingos sin hacer nada": "https://open.spotify.com/playlist/20uF7xCOW8zldDCiAowxuF",
  "Dreamy Songs para escuchar en la intimidad de tu habitación": "https://open.spotify.com/playlist/0Ty7tTNh1ONGyOLuasPREj",
  "Dreamy Songs para escuchar en la intimidad de tu habitacion": "https://open.spotify.com/playlist/0Ty7tTNh1ONGyOLuasPREj",
  "SynthPop para cuando solo quieres bailar": "https://open.spotify.com/playlist/36ribRboGB3DwM821oYokl"
};

function resolvePlaylistSpotifyUrl(playlistName, explicitUrl) {
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.includes('open.spotify.com/playlist/')) {
    return explicitUrl.trim();
  }
  if (!playlistName) {
    return 'https://open.spotify.com/user/thenewindiewave';
  }
  const cleanName = playlistName.trim();
  if (PLAYLIST_URL_MAP[cleanName]) {
    return PLAYLIST_URL_MAP[cleanName];
  }
  const norm = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [key, url] of Object.entries(PLAYLIST_URL_MAP)) {
    const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes(normKey) || normKey.includes(norm)) {
      return url;
    }
  }
  if (norm.includes('darkwave') || norm.includes('madrugada')) return 'https://open.spotify.com/playlist/4mcJJz8GiKTuxieL9Jziln';
  if (norm.includes('aura') || norm.includes('urbana')) return 'https://open.spotify.com/playlist/79SKuyss3MfkzvOJGnaisB';
  if (norm.includes('flow') || norm.includes('moverte')) return 'https://open.spotify.com/playlist/7bbYPZ5ia4IGRP2fT47kXr';
  if (norm.includes('metal') || norm.includes('energia')) return 'https://open.spotify.com/playlist/5OLiBaOPAe5cBEdV1AoSd1';
  if (norm.includes('rabia') || norm.includes('enojo')) return 'https://open.spotify.com/playlist/6cuhRpfYmEt0vYCT9mFLKc';
  if (norm.includes('domingos') || norm.includes('soft')) return 'https://open.spotify.com/playlist/20uF7xCOW8zldDCiAowxuF';
  if (norm.includes('dreamy') || norm.includes('intimidad') || norm.includes('habitacion') || norm.includes('cuarto')) return 'https://open.spotify.com/playlist/0Ty7tTNh1ONGyOLuasPREj';
  if (norm.includes('synthpop') || norm.includes('bailar')) return 'https://open.spotify.com/playlist/36ribRboGB3DwM821oYokl';
  if (norm.includes('electronica') || norm.includes('pista')) return 'https://open.spotify.com/playlist/56UTFQQSDPuY5cjxDol5Ob';

  return 'https://open.spotify.com/user/thenewindiewave';
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
      playlist_url,
      feedback,
      spotify_url,
      cover_url,
      post_mockup_url,
      story_mockup_url,
      notes,
      variation = 0
    } = req.body || {};

    // MANEJO DE FEEDBACK EDITORIAL PARA CURADOR
    if (type === 'editorial_feedback' || type === 'feedback' || (!topic && artist_name && song_title && notes !== undefined)) {
      const cleanNotes = (notes || '').replace(/\[WA:\s*[^\]]+\]\s*/gi, '').replace(/\[WhatsApp:\s*[^\]]+\]\s*/gi, '').trim();

      const GEMINI_KEY = process.env.GEMINI_API_KEY;
      const GROQ_KEY = process.env.GROQ_API_KEY || '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';
      const OPENAI_KEY = process.env.OPENAI_API_KEY;

      const systemPrompt = `Eres Rodrigo dL Moral, curador editorial y fundador de la plataforma musical "The New Indie Wave" (TNIW).
Tu tarea es redactar un feedback editorial para un artista independiente que acaba de enviar su canción a consideración para nuestras playlists oficiales de Spotify y redes.

REGLAS CRÍTICAS:
- Escribe en español, con voz cercana, entusiasta pero con criterio agudo ("de tú a tú", profesional y motivador).
- Extensión: entre 45 y 75 palabras (2 a 4 oraciones bien estructuradas).
- PERSONALIZACIÓN OBLIGATORIA:
  1. Menciona al artista ("${artist_name}") y el nombre del tema ("${song_title}").
  2. Habla de las características sonoras reales de su género ("${genre || 'Indie'}"), mezcla, groove, texturas, instrumentación o melodías.
  ${cleanNotes ? `3. IMPORTANTE: El artista dejó esta nota sobre su canción: "${cleanNotes}". Haz alusión directa a su nota para demostrarle que leíste y entendiste la historia o intención de su obra.` : ''}
  4. Menciona por qué encaja perfectamente en la playlist de destino: "${playlist || 'Selección Oficial TNIW'}".
- NO uses clichés genéricos vacíos como "Qué buen tema, me atrapó la vibra". Da detalles sonoros que hagan sentir al artista que su música fue escuchada con atención.
- Devuelve ÚNICAMENTE el texto del feedback, sin comillas adicionales, sin encabezados ni introducciones.`;

      const userPrompt = `Genera un feedback editorial único para "${song_title}" de ${artist_name} (Género: ${genre || 'Indie'}, País: ${country || 'Latam/Iberoamérica'}, Playlist: ${playlist || 'Selección Oficial TNIW'}). ${cleanNotes ? `Nota del artista: "${cleanNotes}".` : ''} Variación #${variation || 1}.`;

      if (GEMINI_KEY) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { temperature: 0.85, maxOutputTokens: 300 }
            })
          });
          if (geminiRes.ok) {
            const gData = await geminiRes.json();
            const text = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text && text.length > 30) {
              return res.status(200).json({ success: true, source: 'gemini', feedback: cleanFeedbackText(text) });
            }
          }
        } catch (e) {}
      }

      if (GROQ_KEY) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
              temperature: 0.85,
              max_tokens: 300
            })
          });
          if (groqRes.ok) {
            const grData = await groqRes.json();
            const text = grData.choices?.[0]?.message?.content?.trim();
            if (text && text.length > 30) {
              return res.status(200).json({ success: true, source: 'groq', feedback: cleanFeedbackText(text) });
            }
          }
        } catch (e) {}
      }

      const contextualFeedback = synthesizeEditorialFeedback({
        artist_name,
        song_title,
        genre,
        cleanNotes,
        playlist,
        country,
        variation
      });

      return res.status(200).json({ success: true, source: 'contextual_engine', feedback: contextualFeedback });
    }

    let articlePayload = null;

    if (type === 'track_spotlight') {
      if (!artist_name || !song_title) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (artist_name, song_title).' });
      }

      const finalPlaylistName = playlist || 'Selección Oficial TNIW';
      const finalPlaylistUrl = resolvePlaylistSpotifyUrl(finalPlaylistName, playlist_url);

      const playlistComponentHtml = `
        <div style="margin: 28px 0; padding: 22px 24px; background: rgba(29, 185, 84, 0.08); border: 1px solid rgba(29, 185, 84, 0.35); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1DB954" style="flex-shrink:0;"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            <span style="font-family: monospace; font-size: 11px; font-weight: 800; color: #1DB954; text-transform: uppercase; letter-spacing: 0.06em;">Playlist Oficial en Spotify</span>
          </div>
          <div style="font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 6px; font-family: 'Space Grotesk', -apple-system, sans-serif;">
            ${escapeHtml(finalPlaylistName)}
          </div>
          <p style="font-size: 13px; color: #a1a1aa; margin-bottom: 12px; line-height: 1.5;">
            Escucha <strong>"${escapeHtml(song_title)}"</strong> de <strong>${escapeHtml(artist_name)}</strong> y toda la selección oficial directamente en Spotify:
          </p>
          <div style="word-break: break-all; margin-bottom: 16px;">
            <a href="${finalPlaylistUrl}" target="_blank" rel="noopener noreferrer" style="color: #1DB954; font-weight: 700; font-family: monospace; font-size: 13px; text-decoration: underline;">
              🔗 ${finalPlaylistUrl}
            </a>
          </div>
          <div>
            <a href="${finalPlaylistUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #1DB954; color: #000; font-weight: 800; font-size: 13px; padding: 10px 18px; border-radius: 9999px; text-decoration: none; font-family: 'Space Grotesk', -apple-system, sans-serif;">
              ▶ Abrir Playlist en Spotify ↗
            </a>
          </div>
        </div>
      `;

      const slug = `radar-tniw-${slugify(artist_name)}-${slugify(song_title)}-${Date.now().toString().slice(-4)}`;
      const title = `Descubrimiento Radar: "${song_title}" de ${artist_name}`;
      const summary = `Desde ${country || 'la escena independiente'}, ${artist_name} presenta "${song_title}", una descarga fresca de ${genre || 'música indie'} recién añadida a nuestras playlists oficiales.`;

      const content = `
        <p class="lead">Cada semana escuchamos cientos de canciones de toda Iberoamérica en <strong>The New Indie Wave</strong>. Muy pocas logran atrapar la atención desde los primeros 15 segundos con tanta honestidad y carácter como <strong>"${escapeHtml(song_title)}"</strong> de <strong>${escapeHtml(artist_name)}</strong>.</p>

        <p>El lanzamiento destaca por una propuesta sonora con identidad genuina, texturas envolventes y un gancho melódico que conecta de inmediato con la audiencia.</p>

        <p>El balance entre instrumentación y arreglos logra transmitir una atmósfera singular sin perder fuerza rítmica. Por su frescura y carácter sonoro auténtico, ha sido seleccionada para rotar en nuestra playlist oficial <em>"${escapeHtml(finalPlaylistName)}"</em> en Spotify.</p>

        ${playlistComponentHtml}

        <p>Sigue de cerca a <strong>${escapeHtml(artist_name)}</strong> y escucha la canción completa directamente en nuestras listas oficiales para apoyar su crecimiento orgánico.</p>
      `;

      // Subir mockups oficiales a Cloudinary si fueron generados
      let uploadedPostMockup = null;
      if (post_mockup_url) {
        uploadedPostMockup = await uploadImageToCloudinary(post_mockup_url);
      }
      let uploadedStoryMockup = null;
      if (story_mockup_url) {
        uploadedStoryMockup = await uploadImageToCloudinary(story_mockup_url);
      }

      let finalCover = uploadedPostMockup || (cover_url ? cover_url.trim() : '');
      if (!finalCover && spotify_url) {
        finalCover = await fetchSpotifyTrackCover(spotify_url);
      }
      if (!finalCover && artist_name) {
        finalCover = await fetchRealArtistImage(artist_name);
      }
      if (!finalCover) {
        finalCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';
      }

      articlePayload = {
        slug,
        title,
        summary,
        content,
        category: 'Artistas en el Radar',
        author: 'Rodrigo dL Moral',
        author_role: 'Curador & Fundador TNIW',
        author_avatar: 'rodrigo_studio_web.jpg',
        image_url: finalCover,
        post_mockup_url: uploadedPostMockup || null,
        story_mockup_url: uploadedStoryMockup || null,
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

    // Auto-archivar notas antiguas según su categoría con límites independientes:
    // - Noticias editoriales: máximo 7 en vivo
    // - Tracks en el Radar: máximo 6 en vivo
    if (articlePayload.category !== 'Artistas en el Radar') {
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
            console.log(`[generate-article] Auto-archivadas ${toArchive.length} notas editoriales antiguas para mantener el límite de 7.`);
          }
        }
      } catch (archiveErr) {
        console.warn('[generate-article] Error auto-archivando notas editoriales:', archiveErr);
      }
    } else {
      // Mantener límite independiente de 6 notas en vivo para Tracks en el Radar
      try {
        const pubCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&order=published_at.desc`, {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        });
        if (pubCheckRes.ok) {
          const pubArticles = await pubCheckRes.json();
          const radarArticles = (pubArticles || []).filter(a => {
            const cat = (a.category || '').toLowerCase().trim();
            const title = (a.title || '').toLowerCase().trim();
            const slug = (a.slug || '').toLowerCase().trim();
            return cat === 'artistas en el radar' || title.startsWith('descubrimiento radar') || slug.startsWith('radar-tniw-');
          });
          if (radarArticles.length > 6) {
            const toArchive = radarArticles.slice(6);
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
            console.log(`[generate-article] Auto-archivados ${toArchive.length} tracks en el radar antiguos para mantener el límite de 6.`);
          }
        }
      } catch (archiveRadarErr) {
        console.warn('[generate-article] Error auto-archivando tracks en el radar:', archiveRadarErr);
      }
    }

    // Auto-publicar automáticamente en Social Hub (Post en FB, IG, Threads, X, TikTok + Story en FB, IG)
    let socialHubSuccess = false;
    try {
      socialHubSuccess = await pushArticleToSocialHub(insertedData && insertedData[0] ? insertedData[0] : articlePayload);
    } catch (shErr) {
      console.warn('[generate-article] Error auto-publicando en Social Hub:', shErr);
    }

    const createdArt = insertedData && insertedData[0] ? insertedData[0] : articlePayload;
    const shortCode = (createdArt.id && typeof createdArt.id === 'string' && createdArt.id.length >= 8)
      ? createdArt.id.slice(0, 8)
      : (createdArt.slug ? (createdArt.slug.split('-').pop() || createdArt.slug) : '');
    const shortUrl = `https://thenewindiewave.online/b/${shortCode || encodeURIComponent(createdArt.slug || '')}`;

    return res.status(200).json({
      success: true,
      message: 'Artículo generado y publicado con éxito en The New Indie Wave.',
      article: createdArt,
      social_hub: socialHubSuccess,
      url: shortUrl,
      full_url: `https://www.thenewindiewave.online/blog#${articlePayload.slug}`
    });

  } catch (error) {
    console.error('Error en generate-article:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
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
    const isTrack = (article.category === 'Artistas en el Radar') ||
                    (article.title || '').toLowerCase().includes('descubrimiento radar') ||
                    (article.slug || '').startsWith('radar-tniw-');

    // Mockup cuadrado para el Feed (Facebook, Instagram, Threads, X, TikTok)
    let finalPostImageUrl = null;
    if (article.post_mockup_url) {
      finalPostImageUrl = await uploadImageToCloudinary(article.post_mockup_url);
    } else {
      finalPostImageUrl = await uploadImageToCloudinary(article.image_url);
    }

    // Mockup vertical para Stories (Facebook, Instagram)
    let finalStoryImageUrl = null;
    if (article.story_mockup_url) {
      finalStoryImageUrl = await uploadImageToCloudinary(article.story_mockup_url);
    } else {
      finalStoryImageUrl = finalPostImageUrl;
    }

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

    const copyText = isTrack
      ? `🚨 ¡NUEVO TRACK EN EL RADAR EDITORIAL! 📡✨\n\n"${title}"\n\n${cleanSummary}\n\n👉 Escucha el track y lee la reseña completa aquí:\n🔗 ${url}\n\n#TheNewIndieWave #ArtistasEnElRadar #Descubrimientos #MusicaNueva #IndieMusic`
      : `🚨 ¡NUEVA NOTA EN EL RADAR EDITORIAL! 🚨\n\n"${title}"\n\n${cleanSummary}\n\n👉 Lee la cobertura completa en el blog:\n🔗 ${url}\n\n#TheNewIndieWave #CulturaIndie #MusicaIndie #BlogMusical`;

    // 1. Post Feed (Facebook, Instagram, Threads, X, TikTok)
    const feedBundle = {
      id: Math.random().toString(36).substr(2, 9),
      media: finalPostImageUrl,
      mediaUrls: [finalPostImageUrl],
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
      media_url: finalPostImageUrl,
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
      media: finalStoryImageUrl,
      mediaUrls: [finalStoryImageUrl],
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
      media_url: finalStoryImageUrl,
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

  const systemPrompt = `Eres redactor y curador editorial para la revista digital "The New Indie Wave" (TNIW).
Tu misión es escribir una crónica o reseña de actualidad musical con periodismo real, rápido, con datos concretos y directo al hueso.
REGLAS FUNDAMENTALES:
- RIGOR CON LOS HECHOS: Habla de los datos reales del suceso (nombres propios, recintos, festivales, canciones, colaboraciones, discografía e instrumentos). CERO generalidades vacías.
- FORMATO DE ALTA RETENCIÓN: Lectura de 1 a 1.5 minutos (220 a 300 palabras en párrafos ágiles y fluidos).
- VOZ EDITORIAL: Fresco, apasionado, de tú a tú, respetuoso del arte pero con criterio agudo.
- PROHIBICIÓN ESTRICTA: PROHIBIDO ROTUNDAMENTE FABRICAR O INVENTAR CITAS O FRASES ATRIBUIDAS A RODRIGO DL MORAL. Tampoco uses listas forzadas o artificiales de viñetas si la nota fluye mejor en prosa periodística.
- RESPONDE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{
  "title": "Titular con gancho que resuma la noticia real (máximo 12 palabras)",
  "slug": "slug-amigable-en-minusculas-con-guiones",
  "summary": "Resumen directo en 2 oraciones que enganche al lector (máximo 30 palabras)",
  "content": "Cuerpo en HTML limpio con párrafos <p> y subtítulos naturales <h2> donde aporte valor, sin citas falsas de Rodrigo dL Moral",
  "read_time": "1.5 min",
  "tags": ["Etiqueta1", "Etiqueta2", "Etiqueta3"],
  "artist_name": "Nombre exacto de la banda o artista principal para vincular su foto real oficial (ej. Editors, Lizzo, Dudamel, etc.). Si es un tema conceptual sin artista, dejar en blanco."
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
    <p class="lead">Las noticias vuelan, pero los momentos culturales que definen la música se analizan con calma. <strong>${escapeHtml(topic)}</strong> es una de las conversaciones más relevantes de las últimas horas.</p>

    <p>${liveFacts.length > 0 ? escapeHtml(liveFacts.join('. ')) : 'El movimiento constante en los circuitos musicales de la región confirma que la escena independiente sigue encontrando canales propios para desafiar las fórmulas comerciales predecibles.'}</p>

    <p>En <strong>The New Indie Wave</strong> seguimos de cerca el impacto de este tipo de acontecimientos y su eco en los artistas y proyectos emergentes de nuestra comunidad.</p>
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

async function fetchSpotifyTrackCover(spotifyUrl) {
  if (!spotifyUrl) return null;
  const cleanUrl = String(spotifyUrl).trim();

  // 1. Spotify oEmbed (rápido, sin tokens, devuelve carátula real del track)
  try {
    const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData && oembedData.thumbnail_url) {
        // En CDN de Spotify, sustituir a resolución máxima 640x640 si aplica
        return oembedData.thumbnail_url
          .replace('ab67616d00001e02', 'ab67616d0000b273')
          .replace('ab67616d00004851', 'ab67616d0000b273');
      }
    }
  } catch (err) {}

  // 2. Respaldo oficial con API de Spotify
  try {
    const match = cleanUrl.match(/track\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      const trackId = match[1];
      const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
      const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
      const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        if (trackRes.ok) {
          const trackData = await trackRes.json();
          if (trackData.album && trackData.album.images && trackData.album.images.length > 0) {
            return trackData.album.images[0].url;
          }
        }
      }
    }
  } catch (err) {}

  return null;
}

function cleanFeedbackText(text) {
  return text
    .replace(/^["'«“]/, '')
    .replace(/["'»”]$/, '')
    .replace(/^(feedback|comentario|borrador|de rodrigo):\s*/i, '')
    .trim();
}

function synthesizeEditorialFeedback({
  artist_name,
  song_title,
  genre,
  cleanNotes,
  playlist,
  country,
  variation = 0
}) {
  const normGenre = (genre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normNotes = (cleanNotes || '').toLowerCase();
  const seed = (variation * 7 + (song_title.length * 3) + artist_name.length) % 10;

  let genreCritique = '';
  if (normGenre.includes('afro') || normGenre.includes('tribal')) {
    const opts = [
      `El pulso rítmico y las polirritmias percusivas tienen un groove hipnótico brutal; el balance entre los elementos orgánicos y el peso de las frecuencias bajas le da una pegada perfecta para encender la pista.`,
      `Tremendo trabajo con la progresión rítmica. Las percusiones tienen un aire envolvente y orgánico, mientras que el diseño sonoro en los graves empuja la energía hacia arriba con mucha clase.`,
      `La cadencia de este track destaca por su calidez en las percusiones y la sutileza de los arreglos. Se siente una producción muy cuidada en cada compás que no deja caer la tensión en ningún momento.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('synth') || normGenre.includes('electro') || normGenre.includes('dance')) {
    const opts = [
      `La línea de bajo sintetizada amarra el track con muchísima fuerza y dinamismo, y el tratamiento brillante en las frecuencias altas le da ese filo bailable tan adictivo.`,
      `El hook principal se te queda grabado desde la primera vuelta. El contraste entre los sintetizadores retro-futuristas y la claridad rítmica logra una vibra festiva y sofisticada.`,
      `Gran manejo de los arpegios y la energía en los sintetizadores. La producción suena contundente, con un estéreo amplio y una pegada que invita al baile inmediato.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('dream') || normGenre.includes('shoegaze') || normGenre.includes('ambient')) {
    const opts = [
      `Las capas de reverberación y texturas envolventes crean una atmósfera introspectiva preciosa; la interpretación vocal flota sobre los acordes con una sensibilidad que eriza la piel.`,
      `Lograron construir un paisaje sonoro lleno de nostalgia y matices. Las transiciones son suaves y el diseño acústico te transporta de lleno a un espacio íntimo.`,
      `Es de esas piezas que se disfrutan con audífonos puestos: la espacialidad de la mezcla y el tratamiento etéreo de las guitarras y sintes hacen que la emoción resuene de verdad.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('darkwave') || normGenre.includes('post-punk') || normGenre.includes('ebm') || normGenre.includes('coldwave')) {
    const opts = [
      `El bajo punzante y la estética sombría tienen ese magnetismo nocturno que buscamos. Las líneas melódicas frías y la caja con pegada seca le dan una contundencia impecable.`,
      `Brutal esa atmósfera densa y nostálgica. El contraste entre la crudeza del bajo y las texturas afiladas evoca lo mejor del sonido underground contemporáneo.`,
      `La cadencia motorik y la oscuridad de los sintetizadores generan una tensión bailable formidable. Es un sonido maduro y con identidad muy marcada.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('metal') || normGenre.includes('punk') || normGenre.includes('hard rock') || normGenre.includes('garage') || normGenre.includes('grunge')) {
    const opts = [
      `La energía y el ataque de las guitarras están en el punto exacto: crudo, directo y con una pegada en la batería que transmite rabia pura y honestidad visceral.`,
      `Una descarga sónica impecable. Me encantó la saturación armónica y la potencia en la base rítmica; suena a banda tocando en vivo sin filtros ni poses.`,
      `Tiene ese espíritu rebelde y contundente que sacude el pecho. El empuje rítmico y la distorsión bien ecualizada hacen que el tema explote con total solidez.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('rock') || normGenre.includes('indie rock') || normGenre.includes('alternat')) {
    const opts = [
      `Los riffs de guitarra tienen carácter y sostienen la canción con frescura; los cambios dinámicos entre verso y coro le dan un viaje sonoro súper enriquecedor.`,
      `Excelente balance entre la melodía vocal y la mordida del instrumental. La producción suena con aire y pegada, manteniendo viva la esencia orgánica de banda.`,
      `Una propuesta de rock independiente sumamente sólida. Se nota maestría en los arreglos y la interpretación vocal transmite emoción auténtica.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('urban') || normGenre.includes('trap') || normGenre.includes('hip') || normGenre.includes('reggaeton') || normGenre.includes('flow')) {
    const opts = [
      `El tratamiento del sub-bajo 808 y los patrones rítmicos tienen un flow impecable; las texturas vocales están perfectamente colocadas al frente sin ensuciar la mezcla.`,
      `Muy buen groove y cadencia interpretativa. El beat respira con soltura y los remates le dan dinamismo constante a cada barra.`,
      `Tiene una vibra moderna y contagiosa. La producción logra un balance sonoro impecable que resalta la personalidad y soltura en la entrega vocal.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('balada') || normGenre.includes('folk') || normGenre.includes('pop') || normGenre.includes('singer')) {
    const opts = [
      `La honestidad lírica e interpretativa llega directa al corazón; la instrumentación acústica y las dinámicas están trabajadas con muchísima elegancia y calidez.`,
      `Una composición hermosa donde la voz y la armonía conectan desde la vulnerabilidad. No necesita sobreproducción para emocionar profundamente.`,
      `El desarrollo melódico está sumamente bien construido. Los arreglos van entrando con delicadeza hasta alcanzar un clímax emocional muy conmovedor.`
    ];
    genreCritique = opts[seed % opts.length];
  } else {
    const opts = [
      `La producción tiene una identidad sonora muy bien definida, con un diseño acústico balanceado y melodías que se desenvuelven de forma cautivadora.`,
      `Nos sorprendió gratamente la riqueza de texturas y el cuidado en cada detalle de la mezcla; tiene un carácter original que destaca de inmediato.`,
      `Una pieza sonora muy fresca e inspirada. El arreglo instrumental sostiene un pulso dinámico que atrapa la atención desde los primeros segundos.`
    ];
    genreCritique = opts[seed % opts.length];
  }

  let notesConnection = '';
  if (cleanNotes && cleanNotes.length >= 8) {
    if (normNotes.includes('amor') || normNotes.includes('relacion') || normNotes.includes('ruptura') || normNotes.includes('toxica') || normNotes.includes('ciclo') || normNotes.includes('nostalgia') || normNotes.includes('huir') || normNotes.includes('desolacion')) {
      const opts = [
        `Se nota a flor de piel la historia que nos contaste en tu nota: esa vulnerabilidad y el proceso de sanar o cerrar ciclos se transmiten con absoluta honestidad en cada nota.`,
        `Leímos con atención la vivencia detrás de la canción y es admirable cómo supieron transformar ese duelo y nostalgia en una obra artística tan genuina.`,
        `La emoción que describiste en tu mensaje se siente tangible en la interpretación; hay una carga introspectiva que hace que la letra cale muy hondo.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('levantar') || normNotes.includes('lucha') || normNotes.includes('declaracion') || normNotes.includes('rabia') || normNotes.includes('rebelde') || normNotes.includes('fuerza')) {
      const opts = [
        `Tal como nos compartiste en tus notas, el tema funciona como una auténtica declaración de principios y resistencia; esa garra se siente en cada compás.`,
        `Hiciste honor total a lo que nos escribiste: la rola proyecta esa fuerza para no rendirse y levantarse, algo que resuena con mucha contundencia hoy en día.`,
        `Esa convicción y rebeldía que mencionas en tu nota atraviesa toda la grabación con una honestidad desbordante.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('exceso') || normNotes.includes('fiesta') || normNotes.includes('bailar') || normNotes.includes('noche') || normNotes.includes('club') || normNotes.includes('divertir')) {
      const opts = [
        `Tal como nos anticipabas, la vibra bailable y ese pulso nocturno de fiesta y desahogo se contagian al instante.`,
        `Se cumple a la perfección lo que nos comentaste: es una rola hecha para dejarse llevar y perder la noción del tiempo en la pista.`,
        `Ese espíritu libre y festivo que nos compartiste en tu nota se traduce en un gancho rítmico irresistible.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('single') || normNotes.includes('debut') || normNotes.includes('primer') || normNotes.includes('ep') || normNotes.includes('album') || normNotes.includes('disco')) {
      const opts = [
        `Enhorabuena por este paso clave en tu trayectoria que nos detallaste en tus notas; presentarse con este nivel de madurez augura grandes cosas para el proyecto.`,
        `Haber elegido este corte como carta de presentación o parte de tu nuevo material es un gran acierto, refleja un estándar sonoro muy alto.`,
        `Celebramos este nuevo capítulo que nos platicas en tu nota; entrar al radar con una obra tan bien lograda marca una pauta genial.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('bpm') || normNotes.includes('mezcla') || normNotes.includes('beat') || normNotes.includes('estudio') || normNotes.includes('produccion') || normNotes.includes('grab')) {
      const opts = [
        `Nos encantó el detalle que compartiste sobre el proceso creativo y técnico; esa precisión en el tempo y la evolución del arreglo rinde frutos de forma magistral.`,
        `Se agradece el contexto técnico que nos dejaste: ese cuidado milimétrico en el ritmo y las transiciones hace que el tema destaque notablemente.`,
        `El experimento sonoro y de producción que nos describiste funciona de maravilla, logrando un balance auditivo de primera línea.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else {
      const opts = [
        `Agradecemos mucho la nota personal que nos compartiste; esa intención y visión artística se reflejan con total nitidez en el resultado final.`,
        `Pudimos conectar de lleno con lo que nos contaste en tu mensaje; la canción respalda al 100% ese concepto que estás construyendo.`,
        `Nos resonó mucho lo que nos dejaste dicho: hay coherencia total entre tus palabras y la energía que desprende el track.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    }
  }

  const openings = [
    `Gran trabajo de ${artist_name} en "${song_title}".`,
    `"${song_title}" de ${artist_name} nos ha parecido una propuesta impecable.`,
    `Un aplauso para ${artist_name} por esta pieza sonora que es "${song_title}".`,
    `Qué grata experiencia escuchar "${song_title}" de ${artist_name}.`
  ];
  const opening = openings[seed % openings.length];

  const playlistClean = playlist ? playlist.replace(/^[🎯\s]+/, '').trim() : 'nuestras listas oficiales';
  const closings = [
    `Por su vibra y nivel de producción, encaja a la perfección en "${playlistClean}". ¡Excelente trabajo y que sigan los éxitos!`,
    `Suma muchísimo a la curaduría de "${playlistClean}". Todo listo para que nuestra audiencia la descubra. ¡Felicitaciones!`,
    `Va directo a enriquecer el sonido de "${playlistClean}". Una entrega que merece sonar fuerte. ¡Mucho éxito en este camino!`,
    `Es justo el tipo de propuesta fresca y auténtica que buscamos para "${playlistClean}". ¡A seguir creando con esta calidad!`
  ];
  const closing = closings[(seed + 1) % closings.length];

  return `${opening} ${genreCritique}${notesConnection} ${closing}`;
}
