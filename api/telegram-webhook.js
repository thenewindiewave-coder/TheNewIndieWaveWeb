// ==============================================================================
// VERCEL SERVERLESS FUNCTION: /api/telegram-webhook
// Receptor de interacción de Telegram para Curaduría con 1 Clic (TNIW Scout)
// ==============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8942664442:AAEDXBeqpfsYGZMkPVg6dpn2ndZRnHJZX9I';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5821470884';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';
const GROQ_KEY = process.env.GROQ_API_KEY || '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';
const GEMINI_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'TNIW Telegram Webhook Active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const update = req.body || {};

  try {
    // 1. MANEJO DE CLIC EN BOTÓN INTERACTIVO (CALLBACK QUERY)
    if (update.callback_query) {
      const cq = update.callback_query;
      const fromId = String(cq.from?.id || '');
      const data = cq.data || '';

      // Responder a Telegram inmediatamente para detener la animación del botón
      await answerCallbackQuery(cq.id, 'Procesando tu elección...');

      // Validar que Rodrigo esté autorizado (soporta user id o chat id)
      const isAuthorized = (fromId === TELEGRAM_CHAT_ID) || (String(cq.message?.chat?.id || '') === TELEGRAM_CHAT_ID);
      if (!isAuthorized) {
        await sendTelegramText('⛔ Acceso no autorizado.', cq.message?.chat?.id || fromId);
        return res.status(200).json({ ok: true });
      }

      if (data.startsWith('pub:')) {
        const val = data.replace('pub:', '').trim();
        if (/^[1-5]$/.test(val)) {
          await handlePublishByNumber(parseInt(val, 10), cq.message?.chat?.id || TELEGRAM_CHAT_ID);
        } else {
          await handlePublishBySlug(val, cq.message?.chat?.id || TELEGRAM_CHAT_ID);
        }
      } else if (data === 'discard_all') {
        await handleDiscardAll(cq.message?.chat?.id || TELEGRAM_CHAT_ID);
      }

      return res.status(200).json({ ok: true });
    }

    // 2. MANEJO DE MENSAJES DE TEXTO DIRECTOS (ej. Rodrigo responde "1", "2", "/status")
    if (update.message && update.message.text) {
      const msg = update.message;
      const fromId = String(msg.from?.id || '');
      const text = msg.text.trim();

      const isAuthorized = (fromId === TELEGRAM_CHAT_ID) || (String(msg.chat?.id || '') === TELEGRAM_CHAT_ID);
      if (!isAuthorized) {
        return res.status(200).json({ ok: true });
      }

      // Si respondió con un número del 1 al 5
      if (/^[1-5]$/.test(text)) {
        const num = parseInt(text, 10);
        await handlePublishByNumber(num, msg.chat.id);
        return res.status(200).json({ ok: true });
      }

      if (text.toLowerCase() === '/status') {
        await handleStatusCheck(msg.chat.id);
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en telegram-webhook:', err);
    return res.status(200).json({ ok: true, error: err.message });
  }
}

// -----------------------------------------------------------------------------
// ACCIÓN: PUBLICAR POR SLUG
// -----------------------------------------------------------------------------
async function handlePublishBySlug(slug, chatId) {
  // 1. Buscar el item en la cola de Supabase
  const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?slug=eq.${encodeURIComponent(slug)}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  if (!searchRes.ok) {
    await sendTelegramText('⚠️ Error al conectar con Supabase para buscar la noticia.', chatId);
    return;
  }

  const items = await searchRes.json();
  if (!items || items.length === 0) {
    await sendTelegramText('⚠️ No se encontró la noticia seleccionada o ya fue procesada.', chatId);
    return;
  }

  const item = items[0];
  let meta = {};
  try {
    meta = JSON.parse(item.content);
  } catch(e) {
    meta = {
      title: item.title,
      desc: item.summary,
      region: (item.tags && item.tags[0]) || 'México',
      source: 'Radar TNIW',
      link: 'https://thenewindiewave.online',
      image_url: item.image_url
    };
  }

  await sendTelegramText(`✍️ Redactando y publicando en el blog:\n*"${item.title}"*...`, chatId);

  // 2. Redacción con periodismo musical orgánico
  const editorial = await generateArticleJournalism(meta);

  // 3. Actualizar la nota en Supabase como publicada
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${item.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      title: editorial.title,
      summary: editorial.summary,
      content: editorial.content,
      category: 'Cultura Indie',
      image_url: editorial.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
      published: true,
      published_at: new Date().toISOString()
    })
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    await sendTelegramText(`❌ Error al actualizar en Supabase: ${errText.slice(0, 100)}`, chatId);
    return;
  }

  // Eliminar definitivamente de Supabase las demás noticias de hoy no seleccionadas (para que no queden como archivadas)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/articles?category=eq.scout_queue&published=eq.false`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
  } catch(e) {}

  // 4. Auto-archivar notas antiguas para que la portada mantenga exactamente 7 notas
  await enforceSevenArticlesLimit();

  // 5. Enviar mensaje de éxito a Rodrigo
  const successMsg = [
    `🎉 *¡NOTICIA PUBLICADA CON ÉXITO EN EL BLOG!*`,
    ``,
    `📰 *${escapeMarkdown(editorial.title)}*`,
    `🏷️ *Categoría:* Cultura Indie // ${escapeMarkdown(meta.region || 'Indie')}`,
    `📸 *Foto:* Vía ${escapeMarkdown(meta.source || 'Prensa')} / Oficial`,
    ``,
    `🔗 [Ver Artículo en el Blog](https://thenewindiewave.online/blog#${item.slug})`,
    `⚡ Portada sincronizada en 7 notas.`
  ].join('\n');

  await sendTelegramText(successMsg, chatId);
}

// -----------------------------------------------------------------------------
// ACCIÓN: PUBLICAR POR NÚMERO (1-5)
// -----------------------------------------------------------------------------
async function handlePublishByNumber(num, chatId) {
  const queueRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?category=eq.scout_queue&published=eq.false&order=created_at.asc&limit=5`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  if (!queueRes.ok) {
    await sendTelegramText('⚠️ No se pudo consultar la lista de noticias pendientes.', chatId);
    return;
  }

  const list = await queueRes.json();
  if (!list || list.length === 0) {
    await sendTelegramText('ℹ️ No hay noticias pendientes en la cola del radar hoy.', chatId);
    return;
  }

  const idx = num - 1;
  if (idx < 0 || idx >= list.length) {
    await sendTelegramText(`⚠️ Número fuera de rango. Hay ${list.length} noticias en la cola.`, chatId);
    return;
  }

  await handlePublishBySlug(list[idx].slug, chatId);
}

// -----------------------------------------------------------------------------
// ACCIÓN: DESCARTAR TODAS HOY (ELIMINACIÓN DEFINITIVA DE LA BASE DE DATOS)
// -----------------------------------------------------------------------------
async function handleDiscardAll(chatId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/articles?category=in.(scout_queue,scout_discarded)&published=eq.false`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
  } catch(e) {}

  await sendTelegramText('🗑️ *Has descartado las noticias de hoy.*\nFueron eliminadas definitivamente de la base de datos y no se publicará ninguna nota automática a las 5:00 PM.', chatId);
}

// -----------------------------------------------------------------------------
// ACCIÓN: CONSULTAR STATUS (/status)
// -----------------------------------------------------------------------------
async function handleStatusCheck(chatId) {
  const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&order=published_at.desc`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  const queueRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?category=eq.scout_queue&published=eq.false`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });

  const pubCount = pubRes.ok ? (await pubRes.json()).length : 0;
  const queueCount = queueRes.ok ? (await queueRes.json()).length : 0;

  const msg = [
    `📊 *ESTADO DEL RADAR & BLOG TNIW:*`,
    `• Notas en Portada: *${Math.min(pubCount, 7)}*`,
    `• Notas en Archivo Histórico: *${Math.max(0, pubCount - 7)}*`,
    `• Noticias Pendientes en Cola de Hoy: *${queueCount}*`,
    ``,
    `🔗 https://thenewindiewave.online/blog`
  ].join('\n');

  await sendTelegramText(msg, chatId);
}

// -----------------------------------------------------------------------------
// RESOLUCIÓN DE IMAGEN REAL DEL ARTÍCULO / ARTISTA
// -----------------------------------------------------------------------------
async function fetchOgImageFromUrl(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
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

  // 1. Deezer Artist API (Fotos oficiales de prensa en alta resolución 1000x1000)
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

  // 2. Wikipedia PageImages API (Fotografía verificada de Wikimedia)
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
  // 1. Si la imagen provista en el feed RSS ya es una imagen real válida y NO es el placeholder genérico de Unsplash
  if (suppliedImg && suppliedImg.startsWith('http') && !suppliedImg.includes('unsplash.com')) {
    return suppliedImg;
  }

  // 2. Extraer imagen original del artículo fuente raspando og:image (WARP, Sopitas, MondoSonoro, etc.)
  if (articleUrl && articleUrl.startsWith('http')) {
    const ogImg = await fetchOgImageFromUrl(articleUrl);
    if (ogImg) return ogImg;
  }

  // 3. Buscar foto oficial de la banda / artista en alta resolución (Deezer API o Wikimedia Commons)
  if (artistName) {
    const artistImg = await fetchRealArtistImage(artistName);
    if (artistImg) return artistImg;
  }

  // 4. Intentar deducir el artista a partir del título de la noticia
  if (title) {
    const parts = title.split(/[:\-\"“”—,«»]/);
    for (const part of parts) {
      const cleanCandidate = part.replace(/radar|méxico|mexico|latam|españa|estrena|estrenan|nuevo|nueva|canción|cancion|sencillo|disco|álbum|album|vuelve|regresó|regreso|anuncia|presenta|festeja/gi, '').trim();
      if (cleanCandidate.length >= 3 && cleanCandidate.split(' ').length <= 4) {
        const found = await fetchRealArtistImage(cleanCandidate);
        if (found) return found;
      }
    }
  }

  // Fallback con imágenes musicales variadas de alta calidad (nunca la misma fija)
  const rotatingCovers = [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80'
  ];
  return rotatingCovers[Math.floor(Math.random() * rotatingCovers.length)];
}

// -----------------------------------------------------------------------------
// GENERADOR PERIODÍSTICO EDITORIAL
// -----------------------------------------------------------------------------
async function generateArticleJournalism(meta) {
  const systemPrompt = `Eres redactor y curador editorial para la revista digital "The New Indie Wave" (TNIW).
Tu misión es redactar una crónica o reseña de actualidad musical sobre la siguiente noticia de la escena indie de ${meta.region || 'México'} (reportada originalmente por ${meta.source}).

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
  "summary": "Resumen directo de la noticia en 2 oraciones (máximo 35 palabras)",
  "content": "Cuerpo completo del artículo en HTML limpio con párrafos <p> y <div class=\"source-credit\"> sin listas forzadas ni citas inventadas",
  "artist_name": "Nombre exacto de la banda o artista principal (ej. Beach House, Jessica Simpson, Interpol). Si no aplica, dejar vacío."
}`;

  let parsedArtistName = null;
  let articleResult = null;

  if (GROQ_KEY) {
    const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Título: "${meta.title}". Detalles: "${meta.desc}". Fuente: ${meta.source} (${meta.link})` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
            max_tokens: 1200
          })
        });
        if (res.ok) {
          const d = await res.json();
          const raw = d.choices?.[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
            parsedArtistName = parsed.artist_name || null;
            let bodyHtml = parsed.content || `<p>${escapeHtml(meta.desc)}</p>`;
            if (!bodyHtml.includes('source-credit')) {
              bodyHtml += `
                <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
                  Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: Vía ${escapeHtml(meta.source)} / Prensa oficial
                </div>
              `;
            }
            articleResult = {
              title: parsed.title || meta.title,
              summary: parsed.summary || meta.desc.slice(0, 160),
              content: bodyHtml
            };
            break;
          }
        }
      } catch(e) {}
    }
  }

  // Fallback orgánico si no hay conexión de IA
  if (!articleResult) {
    const cleanDesc = (meta.desc || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    const summaryText = cleanDesc.length > 25
      ? (cleanDesc.slice(0, 160) + (cleanDesc.length > 160 ? '...' : ''))
      : `Novedades en la escena independiente de ${meta.region || 'México'}: ${meta.title}. Cobertura vía ${meta.source}.`;

    articleResult = {
      title: meta.title.length > 80 ? meta.title.slice(0, 77) + '...' : meta.title,
      summary: summaryText,
      content: `
        <p class="lead">El pulso de la música independiente en <strong>${escapeHtml(meta.region || 'México')}</strong> suma una nueva noticia destacada de la mano de <strong>${escapeHtml(meta.source)}</strong>: <strong>${escapeHtml(meta.title)}</strong>.</p>
        
        <p>${escapeHtml(cleanDesc || 'Un acontecimiento relevante que reafirma el dinamismo y la constante evolución de las propuestas sonoras que marcan la pauta en los circuitos autogestivos de la región.')}</p>

        <p>En <strong>The New Indie Wave</strong> seguimos de cerca el impacto de este tipo de anuncios y lanzamientos, manteniendo el compromiso de conectar a nuestra comunidad con la música que desafía los estándares comerciales.</p>

        <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
          Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: Vía ${escapeHtml(meta.source)} / Prensa oficial
        </div>
      `
    };
  }

  // Resolver imagen real con prioridad: OG Image del medio original > Foto oficial de Deezer/Wikimedia > Fallback dinámico
  const realImg = await resolveRealArticleImage({
    suppliedImg: meta.image_url,
    articleUrl: meta.link,
    artistName: parsedArtistName,
    title: meta.title
  });

  return {
    ...articleResult,
    image_url: realImg
  };
}

// -----------------------------------------------------------------------------
// REGLA DE 7 NOTICIAS EN PORTADA (EXCLUSIVA PARA NOTICIAS EDITORIALES)
// -----------------------------------------------------------------------------
async function enforceSevenArticlesLimit() {
  try {
    const pubCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&order=published_at.desc`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    if (pubCheckRes.ok) {
      const pubArticles = await pubCheckRes.json();
      // Filtrar SOLO noticias editoriales (las notas de canciones de "Artistas en el Radar" nunca se cuentan ni se archivan)
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
      }
    }
  } catch(e) {}
}

// -----------------------------------------------------------------------------
// UTILIDADES TELEGRAM & STRING
// -----------------------------------------------------------------------------
async function answerCallbackQuery(cqId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cqId, text })
    });
  } catch(e) {}
}

async function sendTelegramText(text, chatId) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
    if (!res.ok) {
      // Fallback a texto plano sin parse_mode si falla por formateo o caracteres especiales
      const plainText = text.replace(/[*_`\[\]()]/g, '');
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
          disable_web_page_preview: false
        })
      });
    }
  } catch(e) {}
}

function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString().replace(/([_*\[`])/g, '\\$1');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
