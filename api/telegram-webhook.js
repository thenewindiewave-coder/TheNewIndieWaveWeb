import crypto from 'crypto';

export const maxDuration = 60; // Permite hasta 60 segundos para IA, web scraping y Social Hub

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
          await handlePublishByNumber(parseInt(val, 10), cq.message?.chat?.id || TELEGRAM_CHAT_ID, false);
        } else {
          await handlePublishBySlug(val, cq.message?.chat?.id || TELEGRAM_CHAT_ID, false);
        }
      } else if (data.startsWith('feat:')) {
        const val = data.replace('feat:', '').trim();
        if (/^[1-5]$/.test(val)) {
          await handlePublishByNumber(parseInt(val, 10), cq.message?.chat?.id || TELEGRAM_CHAT_ID, true);
        } else {
          await handlePublishBySlug(val, cq.message?.chat?.id || TELEGRAM_CHAT_ID, true);
        }
      } else if (data === 'discard_all') {
        await handleDiscardAll(cq.message?.chat?.id || TELEGRAM_CHAT_ID);
      }

      return res.status(200).json({ ok: true });
    }

    // 2. MANEJO DE MENSAJES DE TEXTO DIRECTOS (ej. Rodrigo responde "1", "1*", "destacar 1", "/radar", "/status")
    if (update.message && update.message.text) {
      const msg = update.message;
      const fromId = String(msg.from?.id || '');
      const text = msg.text.trim();

      const isAuthorized = (fromId === TELEGRAM_CHAT_ID) || (String(msg.chat?.id || '') === TELEGRAM_CHAT_ID);
      if (!isAuthorized) {
        return res.status(200).json({ ok: true });
      }

      // Si respondió para publicar como DESTACADA (ej: "1*", "*1", "1 destacada", "destacar 1", "destacada 1", "1d", "d1")
      const featMatch = text.match(/^(?:destacar\s*([1-5])|([1-5])\s*destacada?|([1-5])\*|\*([1-5])|d([1-5])|([1-5])d)$/i);
      if (featMatch) {
        const numStr = featMatch[1] || featMatch[2] || featMatch[3] || featMatch[4] || featMatch[5] || featMatch[6];
        if (numStr) {
          await handlePublishByNumber(parseInt(numStr, 10), msg.chat.id, true);
          return res.status(200).json({ ok: true });
        }
      }

      // Si respondió con un número del 1 al 5 para publicación estándar
      if (/^[1-5]$/.test(text)) {
        const num = parseInt(text, 10);
        await handlePublishByNumber(num, msg.chat.id, false);
        return res.status(200).json({ ok: true });
      }

      if (text.toLowerCase() === '/radar') {
        await handleResendRadar(msg.chat.id);
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
// ACCIÓN: PUBLICAR POR SLUG (CON SOPORTE DE NOTICIA DESTACADA)
// -----------------------------------------------------------------------------
async function handlePublishBySlug(slug, chatId, isFeatured = false) {
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

  const announcingText = isFeatured
    ? `✍️ Redactando y publicando como *NOTICIA DESTACADA (Cover Story)* en el blog:\n*"${escapeMarkdown(item.title)}"*...`
    : `✍️ Redactando y publicando en el blog:\n*"${escapeMarkdown(item.title)}"*...`;

  await sendTelegramText(announcingText, chatId);

  // 2. Redacción con periodismo musical orgánico
  const editorial = await generateArticleJournalism(meta);

  // Si se marcó como destacada, desmarcar cualquier destacada previa para que esta sea la Cover Story reina
  if (isFeatured) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/articles?featured=eq.true`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ featured: false })
      });
    } catch(e) {}
  }

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
      featured: Boolean(isFeatured),
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

  // 5. Auto-publicar en Social Hub (Post en FB, IG, Threads, X, TikTok + Story en FB, IG)
  let socialHubSent = false;
  try {
    socialHubSent = await pushArticleToSocialHub({
      title: editorial.title,
      summary: editorial.summary,
      slug: item.slug,
      image_url: editorial.image_url,
      category: 'Cultura Indie'
    });
  } catch(shErr) {
    console.warn('[telegram-webhook] Error auto-publicando en Social Hub:', shErr);
  }

  const shortCode = (item.id && typeof item.id === 'string' && item.id.length >= 8)
    ? item.id.slice(0, 8)
    : (item.slug ? (item.slug.split('-').pop() || item.slug) : '');
  const noteShortUrl = `https://thenewindiewave.online/b/${shortCode || encodeURIComponent(item.slug || '')}`;

  // 6. Enviar mensaje de éxito a Rodrigo
  const successMsg = [
    isFeatured ? `⭐👑 *¡NOTICIA PUBLICADA COMO DESTACADA (COVER STORY)!*` : `🎉 *¡NOTICIA PUBLICADA CON ÉXITO EN EL BLOG!*`,
    ``,
    `📰 *${escapeMarkdown(editorial.title)}*`,
    `🏷️ *Categoría:* Cultura Indie // ${escapeMarkdown(meta.region || 'Indie')}`,
    `📸 *Foto:* Vía ${escapeMarkdown(meta.source || 'Prensa')} / Oficial`,
    isFeatured ? `🌟 *Posición:* Hero Principal de Portada` : `📌 *Posición:* Feed Editorial Principal`,
    ``,
    `🔗 [Ver Artículo en el Blog](${noteShortUrl})`,
    `⚡ Portada sincronizada en 7 notas.`,
    socialHubSent ? `📡 *¡Enviada a Social Hub!* (FB, IG Post+Story, Threads, X, TikTok)` : `⚠️ Social Hub: no se pudo sincronizar automáticamente.`
  ].join('\n');

  await sendTelegramText(successMsg, chatId);
}

// -----------------------------------------------------------------------------
// ACCIÓN: PUBLICAR POR NÚMERO (1-5) CON OPCIÓN DE DESTACADA
// -----------------------------------------------------------------------------
async function handlePublishByNumber(num, chatId, isFeatured = false) {
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

  await handlePublishBySlug(list[idx].slug, chatId, isFeatured);
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
// ACCIÓN: RE-ENVIAR RADAR DE HOY (/radar)
// -----------------------------------------------------------------------------
async function handleResendRadar(chatId) {
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
    await sendTelegramText('ℹ️ No hay noticias pendientes en la cola del radar hoy (o ya fueron publicadas/descartadas).', chatId);
    return;
  }

  const listText = list.map((item, i) => {
    let source = 'Radar TNIW';
    let region = 'México';
    let link = 'https://thenewindiewave.online';
    try {
      const parsed = JSON.parse(item.content);
      source = parsed.source || source;
      region = parsed.region || region;
      link = parsed.link || link;
    } catch(e) {}
    return `<b>${i + 1}.</b> [${escapeHtml(region)}] <b>${escapeHtml(source)}</b>\n"${escapeHtml(item.title)}"\n🔗 <a href="${link}">Leer fuente original</a>\n`;
  }).join('\n');

  const messageText = [
    `📡 <b>RADAR DE NOTICIAS TNIW // 8:00 AM</b>`,
    `¡Hola Rodrigo! Tienes <b>${list.length} noticias pendientes</b> en la cola de hoy:`,
    ``,
    listText,
    `━━━━━━━━━━━━━━━━━━━`,
    `⚡ <b>Elige qué nota publicar:</b>`,
    `• Toca <b>⚡ Publicar #N</b> para publicarla normal en el blog.`,
    `• Toca <b>⭐ Destacar #N</b> para publicarla como <b>NOTICIA DESTACADA (Cover Story)</b>.`,
    `• O responde con el número (ej. <code>1</code> normal o <code>1*</code> destacada).`,
    ``,
    `⏳ <i>Si no respondes antes de las 5:00 PM, se publicará automáticamente 1 nota al azar.</i>`
  ].join('\n');

  const buttons = [];
  for (let i = 0; i < list.length; i++) {
    buttons.push([
      { text: `⚡ Publicar #${i + 1}`, callback_data: `pub:${i + 1}` },
      { text: `⭐ Destacar #${i + 1}`, callback_data: `feat:${i + 1}` }
    ]);
  }
  buttons.push([{ text: `🚫 Descartar todas hoy`, callback_data: `discard_all` }]);

  await sendTelegramButtons(messageText, buttons, chatId);
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

  const pubList = pubRes.ok ? await pubRes.json() : [];
  const queueCount = queueRes.ok ? (await queueRes.json()).length : 0;
  const currentFeatured = pubList.find(a => a.featured) || pubList[0];

  const msg = [
    `📊 *ESTADO DEL RADAR & BLOG TNIW:*`,
    `• Notas en Portada: *${Math.min(pubList.length, 7)}*`,
    `• Notas en Archivo Histórico: *${Math.max(0, pubList.length - 7)}*`,
    `• Noticias Pendientes en Cola de Hoy: *${queueCount}*`,
    currentFeatured ? `⭐ *Destacada Actual:* "${escapeMarkdown(currentFeatured.title)}"` : `⭐ *Destacada Actual:* Ninguna`,
    ``,
    `💡 *Comandos disponibles:*`,
    `• \`/radar\` : Ver las noticias de hoy y sus botones (Publicar / Destacar).`,
    `• \`/status\` : Consultar este resumen.`,
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

// -----------------------------------------------------------------------------
// GENERADOR PERIODÍSTICO EDITORIAL
// -----------------------------------------------------------------------------
async function generateArticleJournalism(meta) {
  // 1. Extraer el contenido real y hechos concretos de la fuente original
  let scrapedBody = '';
  if (meta.link && meta.link.startsWith('http')) {
    scrapedBody = await fetchArticleBody(meta.link);
  }
  const cleanDesc = (meta.desc || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  const factualContext = scrapedBody && scrapedBody.length >= 80 ? scrapedBody : (cleanDesc || meta.title);

  const systemPrompt = `Eres redactor y periodista musical de la revista digital "The New Indie Wave" (TNIW).
Tu misión es redactar un artículo periodístico completo, detallado y riguroso sobre la siguiente noticia de la escena de ${meta.region || 'México'} (reportada originalmente por ${meta.source}).

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
  "summary": "Resumen directo con datos esenciales (fechas, lugar, hecho principal, máximo 35 palabras)",
  "content": "Cuerpo completo del artículo en HTML limpio con 3 párrafos <p> informativos y el bloque <div class=\\"source-credit\\">",
  "artist_name": "Nombre exacto del artista, banda o colectivo principal. Si no aplica, dejar vacío."
}`;

  const userPrompt = `Noticia: "${meta.title}"
Fuente: ${meta.source} (${meta.link})
Región: ${meta.region || 'México'}

HECHOS Y CONTENIDO EXTRAÍDO DE LA FUENTE:
${factualContext}`;

  let parsedArtistName = null;
  let articleResult = null;

  // Intentar con Groq
  if (GROQ_KEY) {
    const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model,
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
          const d = await res.json();
          const raw = d.choices?.[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
            parsedArtistName = parsed.artist_name || null;
            let bodyHtml = parsed.content || `<p>${escapeHtml(factualContext.slice(0, 400))}</p>`;
            if (!bodyHtml.includes('source-credit')) {
              bodyHtml += `
                <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
                  Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: Vía ${escapeHtml(meta.source)} / Prensa oficial
                </div>
              `;
            }
            articleResult = {
              title: parsed.title || meta.title,
              summary: parsed.summary || cleanDesc.slice(0, 160),
              content: bodyHtml
            };
            break;
          }
        }
      } catch(e) {}
    }
  }

  // Intentar con Gemini si Groq no respondió
  if (!articleResult && GEMINI_KEY) {
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
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
            parsedArtistName = parsed.artist_name || null;
            let bodyHtml = parsed.content || `<p>${escapeHtml(factualContext.slice(0, 400))}</p>`;
            if (!bodyHtml.includes('source-credit')) {
              bodyHtml += `
                <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
                  Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: Vía ${escapeHtml(meta.source)} / Prensa oficial
                </div>
              `;
            }
            articleResult = {
              title: parsed.title || meta.title,
              summary: parsed.summary || cleanDesc.slice(0, 160),
              content: bodyHtml
            };
            break;
          }
        }
      } catch (e) {}
    }
  }

  // Fallback autónomo inteligente (basado en hechos reales extraídos, JAMÁS relleno vacío)
  if (!articleResult) {
    const rawParagraphs = factualContext.split('\n\n').filter(p => p.trim().length > 35);
    const summaryText = rawParagraphs[0]
      ? (rawParagraphs[0].length > 160 ? rawParagraphs[0].slice(0, 157) + '...' : rawParagraphs[0])
      : `${meta.title}. Novedades en la escena de ${meta.region || 'México'}.`;

    let synthesizedHtml = '';
    if (rawParagraphs.length >= 2) {
      synthesizedHtml = rawParagraphs.slice(0, 3).map(p => `<p>${escapeHtml(p)}</p>`).join('\n');
    } else {
      synthesizedHtml = `<p>${escapeHtml(factualContext)}</p>`;
    }

    synthesizedHtml += `
      <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
        Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: Vía ${escapeHtml(meta.source)} / Prensa oficial
      </div>
    `;

    articleResult = {
      title: meta.title.length > 80 ? meta.title.slice(0, 77) + '...' : meta.title,
      summary: summaryText,
      content: synthesizedHtml
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
        const toArchive = editorialArticles.slice(7).filter(a => !a.featured);
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

async function sendTelegramButtons(text, inlineKeyboard, chatId) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      })
    });
    if (!res.ok) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/<[^>]+>/g, ''),
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        })
      });
    }
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
