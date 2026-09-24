/**
 * BOT SCOUT DE NOTICIAS AUTOMÁTICO — THE NEW INDIE WAVE
 * Especializado 100% en la escena independiente de MÉXICO, LATINOAMÉRICA y ESPAÑA.
 * Rastrea los medios más influyentes de la cultura indie en español, extrae las noticias
 * más frescas, las procesa con IA y las publica en Supabase en formato rápido (1.5 min).
 */

const crypto = require('crypto');

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

// FUENTES OFICIALES DE LA ESCENA INDIE: MÉXICO (10 MEDIOS), LATINOAMÉRICA Y ESPAÑA
const RSS_FEEDS = [
  // 🇲🇽 MÉXICO (ALMA MATER TNIW - 10 MEDIOS LÍDERES)
  { name: 'WARP Magazine', url: 'https://warp.la/feed/', region: 'México' },
  { name: 'Indie Rocks!', url: 'https://www.indierocks.mx/feed/', region: 'México' },
  { name: 'Sopitas Música', url: 'https://www.sopitas.com/feed/', region: 'México' },
  { name: 'Me Hace Ruido', url: 'https://mehaceruido.com/feed/', region: 'México' },
  { name: 'Filter México', url: 'https://filtermexico.com/feed/', region: 'México' },
  { name: 'Setlist.me', url: 'https://setlist.me/feed/', region: 'México' },
  { name: 'Revista Kuadro', url: 'https://revistakuadro.com/feed/', region: 'México' },
  { name: 'Pólvora Rock', url: 'https://polvora.com.mx/feed/', region: 'México' },
  { name: 'Grita Radio', url: 'https://gritaradio.com/feed/', region: 'México' },
  { name: 'Rolling Stone en Español', url: 'https://es.rollingstone.com/feed/', region: 'México' },

  // 🌎 LATINOAMÉRICA (Argentina, Chile, Colombia, Perú, etc.)
  { name: 'Indie Hoy', url: 'https://indiehoy.com/feed/', region: 'Latinoamérica' },
  { name: 'Cuchara Sónica', url: 'https://cucharasonica.com/feed/', region: 'Latinoamérica' },

  // 🇪🇸 ESPAÑA
  { name: 'MondoSonoro', url: 'https://www.mondosonoro.com/feed/', region: 'España' },
  { name: 'Binaural', url: 'https://binaural.es/feed/', region: 'España' },
  { name: 'Muzikalia', url: 'https://muzikalia.com/feed/', region: 'España' },
  { name: 'Jenesaispop', url: 'https://jenesaispop.com/feed/', region: 'España' }
];

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8942664442:AAEDXBeqpfsYGZMkPVg6dpn2ndZRnHJZX9I';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5821470884';

async function main() {
  const args = process.argv.slice(2);
  let mode = 'auto';

  for (const arg of args) {
    if (arg.startsWith('--mode=')) mode = arg.split('=')[1];
    else if (arg === '--morning') mode = 'morning';
    else if (arg === '--fallback') mode = 'fallback';
  }

  if (mode === 'auto') {
    const currentUtcHour = new Date().getUTCHours();
    // 13:00 - 16:00 UTC corresponde a 7:00 AM - 10:00 AM hora CDMX
    if (currentUtcHour >= 13 && currentUtcHour <= 16) {
      mode = 'morning';
    } 
    // 22:00 - 02:00 UTC corresponde a 4:00 PM - 8:00 PM hora CDMX
    else if (currentUtcHour >= 22 || currentUtcHour <= 2) {
      mode = 'fallback';
    } else {
      mode = 'morning';
    }
  }

  console.log(`🤖 [TNIW Scout Bot] Modo de ejecución activo: ${mode.toUpperCase()}`);

  if (mode === 'morning') {
    await runMorningScout();
  } else if (mode === 'fallback') {
    await runFallback5pm();
  }
}

// =============================================================================
// MODO 1: RASTREO MATUTINO (8:00 AM) + MENSAJE A TELEGRAM CON BOTONES
// =============================================================================
async function runMorningScout() {
  console.log('📡 [TNIW Scout Bot] Iniciando escaneo matutino de los 16 medios...');

  // 1. Obtener slugs existentes en Supabase para no repetir noticias
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
    }
  } catch (err) {
    console.warn('Aviso al leer artículos existentes:', err.message);
  }

  // 2. Escanear Feeds RSS
  const candidateArticles = [];

  for (const feed of RSS_FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TheNewIndieWave/1.0' },
        signal: AbortSignal.timeout(5000)
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

          let feedImg = null;
          const mediaMatch = rawItem.match(/<media:content[^>]+url=["']([^"']+)["']/i);
          const encMatch = rawItem.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
          const thumbMatch = rawItem.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
          const imgTagMatch = rawItem.match(/<img[^>]+src=["']([^"']+)["']/i);
          const contentImgMatch = rawItem.match(/<content:encoded[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);

          if (mediaMatch) feedImg = mediaMatch[1];
          else if (encMatch) feedImg = encMatch[1];
          else if (thumbMatch) feedImg = thumbMatch[1];
          else if (imgTagMatch) feedImg = imgTagMatch[1];
          else if (contentImgMatch) feedImg = contentImgMatch[1];

          if (isMusicRelevant(rawTitle, desc)) {
            const testSlug = slugify(rawTitle);
            if (!existingSlugs.has(testSlug) && !Array.from(existingSlugs).some(s => s.includes(testSlug.slice(0, 20)))) {
              candidateArticles.push({
                source: feed.name,
                region: feed.region,
                title: rawTitle,
                link,
                desc,
                image_url: feedImg,
                slug: `radar-${slugify(feed.region)}-${testSlug}-${Date.now().toString().slice(-4)}`
              });
            }
          }
        }
      }
    } catch (err) {}
  }

  // Limitar a los 5 candidatos más destacados garantizando DIVERSIDAD de fuentes
  const sourceCount = {};
  const diverseCandidates = [];

  for (const c of candidateArticles) {
    if (!sourceCount[c.source]) {
      sourceCount[c.source] = 1;
      diverseCandidates.push(c);
      if (diverseCandidates.length >= 5) break;
    }
  }

  // Rellenar si hay menos de 5 medios únicos disponibles
  if (diverseCandidates.length < 5) {
    for (const c of candidateArticles) {
      if (!diverseCandidates.includes(c)) {
        diverseCandidates.push(c);
        if (diverseCandidates.length >= 5) break;
      }
    }
  }

  const topCandidates = diverseCandidates.slice(0, 5);
  console.log(`🎯 Seleccionados ${topCandidates.length} candidatos diversos para enviar a Telegram:`, topCandidates.map(c => `[${c.source}]`).join(', '));

  if (topCandidates.length === 0) {
    console.log('No se encontraron noticias nuevas en este ciclo.');
    await sendTelegramMessage('📡 *Radar TNIW Matutino (8:00 AM):*\nNo se detectaron noticias nuevas hoy en los 16 medios monitoreados.');
    return;
  }

  // Resolver imagen real para los 5 candidatos (OG Image del medio original o foto del artista)
  for (const c of topCandidates) {
    if (!c.image_url || c.image_url.includes('unsplash.com')) {
      const real = await resolveRealArticleImage({
        suppliedImg: c.image_url,
        articleUrl: c.link,
        title: c.title
      });
      if (real) c.image_url = real;
    }
  }

  // 3. Guardar en Supabase en la cola pendiente (category = 'scout_queue', published = false)
  // Limpiar cola pendiente anterior para no saturar
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/articles?category=eq.scout_queue&published=eq.false`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
  } catch(e) {}

  for (const c of topCandidates) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          slug: c.slug,
          title: c.title,
          summary: c.desc.slice(0, 160),
          content: JSON.stringify(c),
          category: 'scout_queue',
          image_url: c.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
          published: false,
          tags: [c.region, 'Radar TNIW']
        })
      });
    } catch(e) {}
  }

  // 4. Enviar Mensaje a Telegram con Botones Interactivos
  const listText = topCandidates.map((c, i) => {
    return `<b>${i + 1}.</b> [${escapeHtml(c.region)}] <b>${escapeHtml(c.source)}</b>\n"${escapeHtml(c.title)}"\n🔗 <a href="${c.link}">Leer fuente original</a>\n`;
  }).join('\n');

  const messageText = [
    `📡 <b>RADAR DE NOTICIAS TNIW // 8:00 AM</b>`,
    `¡Buenos días Rodrigo! Se detectaron <b>${topCandidates.length} noticias frescas</b> en la red de medios:`,
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

  // Construir teclado de botones interactivos: 1 fila por nota con Publicar y Destacar
  const buttons = [];
  for (let i = 0; i < topCandidates.length; i++) {
    buttons.push([
      { text: `⚡ Publicar #${i + 1}`, callback_data: `pub:${i + 1}` },
      { text: `⭐ Destacar #${i + 1}`, callback_data: `feat:${i + 1}` }
    ]);
  }
  buttons.push([{ text: `🚫 Descartar todas hoy`, callback_data: `discard_all` }]);

  await sendTelegramMessageWithButtons(messageText, buttons);
}

// =============================================================================
// MODO 2: FALLBACK AUTOMÁTICO DE LAS 5:00 PM (SI RODRIGO NO CONTESTÓ)
// =============================================================================
async function runFallback5pm() {
  console.log('⏰ [TNIW Scout Bot] Verificando fallback de las 5:00 PM...');

  // 1. Revisar si Rodrigo ya publicó alguna nota hoy
  const todayStr = new Date().toISOString().slice(0, 10);
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?published=eq.true&published_at=gte.${todayStr}T00:00:00.000Z`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  if (checkRes.ok) {
    const publishedToday = await checkRes.json();
    if (publishedToday && publishedToday.length > 0) {
      console.log(`✓ Rodrigo ya curó o publicó ${publishedToday.length} nota(s) hoy. No se requiere fallback.`);
      return;
    }
  }

  // 2. Obtener notas pendientes en la cola matutina
  const queueRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?category=eq.scout_queue&published=eq.false`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  if (!queueRes.ok) {
    console.log('Aviso: No se pudo consultar la cola de noticias pendientes.');
    return;
  }

  const queueItems = await queueRes.json();
  if (!queueItems || queueItems.length === 0) {
    console.log('Aviso: No hay noticias pendientes en la cola (o fueron descartadas).');
    return;
  }

  // 3. Seleccionar 1 nota al azar de las pendientes
  const randomIndex = Math.floor(Math.random() * queueItems.length);
  const selectedItem = queueItems[randomIndex];

  console.log(`🎲 Seleccionada al azar nota #${randomIndex + 1}: "${selectedItem.title}"`);

  let meta = {};
  try {
    meta = JSON.parse(selectedItem.content);
  } catch(e) {
    meta = {
      title: selectedItem.title,
      desc: selectedItem.summary,
      region: (selectedItem.tags && selectedItem.tags[0]) || 'México',
      source: 'Radar TNIW',
      link: 'https://thenewindiewave.online',
      image_url: selectedItem.image_url
    };
  }

  // 4. Redactar pieza periodística limpia
  const prompt = `Noticia indie de ${meta.region || 'México'} vía ${meta.source || 'Medios'}:
Título: "${meta.title}"
Detalles: "${meta.desc}"
Enlace fuente: ${meta.link}`;

  const editorial = await generateEditorialPiece(prompt, meta);

  // 5. Generar Mockups Oficiales de TNIW (Post 1:1 y Story 9:16) con foto extraída, título y resumen
  let mockups = { postMockupUrl: null, storyMockupUrl: null };
  try {
    mockups = await generateNewsMockups({
      title: editorial.title,
      summary: editorial.summary,
      imageUrl: editorial.image_url || selectedItem.image_url,
      region: meta.region || 'México',
      category: 'Cultura Indie'
    });
  } catch (mErr) {
    console.warn('[news-scout] Error generando mockups:', mErr.message);
  }

  const finalCoverImage = mockups.postMockupUrl || editorial.image_url || selectedItem.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';

  // 6. Publicar en Supabase
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${selectedItem.id}`, {
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
      image_url: finalCoverImage,
      published: true,
      published_at: new Date().toISOString()
    })
  });

  if (updateRes.ok) {
    console.log(`🎉 ¡Fallback de las 5:00 PM ejecutado con éxito!`);
    
    // Eliminar definitivamente las demás notas de scout_queue para que no queden como archivadas
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/articles?category=eq.scout_queue&published=eq.false`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
    } catch(e) {}

    // Auto-archivar para mantener exactamente 7 notas en portada
    await enforceSevenArticlesLimit();

    // Auto-publicar en Social Hub (Post en FB, IG, Threads, X, TikTok + Story en FB, IG)
    let socialHubSent = false;
    try {
      socialHubSent = await pushArticleToSocialHub({
        title: editorial.title,
        summary: editorial.summary,
        slug: selectedItem.slug,
        image_url: finalCoverImage,
        post_mockup_url: mockups.postMockupUrl || finalCoverImage,
        story_mockup_url: mockups.storyMockupUrl || mockups.postMockupUrl || finalCoverImage,
        category: 'Cultura Indie'
      });
    } catch(shErr) {
      console.warn('[news-scout] Error auto-publicando en Social Hub:', shErr);
    }

    // 7. Notificar a Telegram
    const alertMsg = [
      `⏰ <b>RADAR TNIW // 5:00 PM (PUBLICACIÓN AUTOMÁTICA)</b>`,
      `No se seleccionó ninguna nota durante el día.`,
      `Se ha redactado y publicado automáticamente <b>1 nota al azar</b>:`,
      ``,
      `📰 <b>${escapeHtml(editorial.title)}</b>`,
      `🏷️ <b>Categoría:</b> Cultura Indie // ${escapeHtml(meta.region || 'Indie')}`,
      `📸 <b>Foto:</b> Vía ${escapeHtml(meta.source || 'Prensa')} / Oficial`,
      mockups.postMockupUrl ? `🎨 <b>Mockup:</b> Generado con éxito (Post 1:1 & Story 9:16)` : ``,
      ``,
      `🔗 <a href="https://thenewindiewave.online/blog#${selectedItem.slug}">Ver en el Blog</a>`,
      `⚡ Portada sincronizada en 7 notas.`,
      socialHubSent ? `📡 <b>¡Enviada a Social Hub con Mockups!</b> (FB, IG Post+Story, Threads, X, TikTok)` : `⚠️ Social Hub: no se pudo sincronizar automáticamente.`
    ].filter(Boolean).join('\n');

    await sendTelegramMessage(alertMsg);
  }
}

// =============================================================================
// REGLA DE 7 NOTICIAS EN PORTADA
// =============================================================================
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

// =============================================================================
// UTILIDADES TELEGRAM
// =============================================================================
async function sendTelegramMessage(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('Aviso Telegram HTML:', data.description, '- Reintentando sin formato...');
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text.replace(/<[^>]+>/g, '')
        })
      });
    }
  } catch(e) {
    console.warn('Error al enviar mensaje a Telegram:', e.message);
  }
}

async function sendTelegramMessageWithButtons(text, inlineKeyboard) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('Aviso Telegram HTML con botones:', data.description, '- Reintentando sin formato...');
      const fallbackRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text.replace(/<[^>]+>/g, ''),
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        })
      });
      const fbData = await fallbackRes.json();
      if (fbData.ok) {
        console.log(`✓ Mensaje entregado a Telegram (ID: ${fbData.result?.message_id})`);
      } else {
        console.error('❌ Error enviando mensaje a Telegram:', fbData.description);
      }
    } else {
      console.log(`✓ Mensaje entregado a Telegram con éxito (ID: ${data.result?.message_id})`);
    }
  } catch(e) {
    console.warn('Error de red al enviar mensaje con botones a Telegram:', e.message);
  }
}

function isMusicRelevant(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  const musicKeywords = [
    'canción', 'cancion', 'álbum', 'album', 'disco', 'single', 'sencillo', 'tema', 'video',
    'concierto', 'gira', 'festival', 'banda', 'estrena', 'lanzamiento', 'guitarra', 'indie',
    'shoegaze', 'post-punk', 'rock', 'pop', 'presenta', 'estreno', 'música', 'musica',
    'cartel', 'cover', 'adelanto', 'tour', 'videoclip', 'ep', 'lp', 'en vivo', 'acústico',
    'acustico', 'solista', 'vocalista', 'sintetizador', 'producción', 'punk', 'metal'
  ];
  const ignoreKeywords = ['película', 'pelicula', 'serie', 'tráiler', 'trailer', 'netflix', 'hbo', 'taquilla', 'marvel', 'nintendo', 'playstation', 'xbox', 'videojuego', 'gaming'];
  
  if (ignoreKeywords.some(k => text.includes(k) && !text.includes('soundtrack'))) {
    return false;
  }
  return musicKeywords.some(k => text.includes(k));
}

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

  // 1. Deezer Artist API
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

  // 2. Wikipedia PageImages API
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
  if (suppliedImg && suppliedImg.startsWith('http') && !suppliedImg.includes('unsplash.com')) {
    return suppliedImg;
  }
  if (articleUrl && articleUrl.startsWith('http')) {
    const ogImg = await fetchOgImageFromUrl(articleUrl);
    if (ogImg) return ogImg;
  }
  if (artistName) {
    const artistImg = await fetchRealArtistImage(artistName);
    if (artistImg) return artistImg;
  }
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
  const rotatingCovers = [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80'
  ];
  return rotatingCovers[Math.floor(Math.random() * rotatingCovers.length)];
}

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

async function generateEditorialPiece(promptContext, meta) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY || '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';
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  // 1. Extraer el contenido real y hechos concretos de la fuente original
  let scrapedBody = '';
  if (meta.link && meta.link.startsWith('http')) {
    scrapedBody = await fetchArticleBody(meta.link);
  }
  const cleanDesc = (meta.desc || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  const factualContext = scrapedBody && scrapedBody.length >= 80 ? scrapedBody : (cleanDesc || meta.title);

  const systemPrompt = `Eres redactor y periodista musical de la revista digital "The New Indie Wave" (TNIW).
Tu misión es redactar un artículo periodístico completo, detallado y riguroso sobre la siguiente noticia de la escena de ${meta.region || 'Iberoamérica'} (reportada originalmente por ${meta.source}).

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
  "slug": "slug-limpio-en-minusculas-con-guiones",
  "summary": "Resumen directo con datos esenciales (fechas, lugar, hecho principal, máximo 35 palabras)",
  "content": "Cuerpo completo del artículo en HTML limpio con 3 párrafos <p> informativos y el bloque <div class=\\"source-credit\\">",
  "photo_credit": "Vía ${meta.source} / Prensa oficial",
  "category": "Cultura Indie",
  "read_time": "1.5 min",
  "tags": ["${meta.region || 'Música Indie'}", "Música Indie", "Lanzamiento", "TNIW"]
}`;

  const userPrompt = `Noticia: "${meta.title}"
Fuente: ${meta.source} (${meta.link})
Región: ${meta.region || 'Iberoamérica'}

HECHOS Y CONTENIDO EXTRAÍDO DE LA FUENTE:
${factualContext}`;

  if (GROQ_KEY) {
    const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
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
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.4,
            max_tokens: 1400
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
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsed = JSON.parse(rawJson.replace(/```json/g, '').replace(/```/g, '').trim());
            return buildArticleObject(parsed, meta);
          }
        }
      } catch(e) {}
    }
  }

  // Fallback autónomo inteligente (basado en hechos reales extraídos, JAMÁS relleno vacío)
  const slug = `radar-${slugify(meta.region || 'indie')}-${slugify(meta.title)}-${Date.now().toString().slice(-4)}`;
  const rawParagraphs = factualContext.split('\n\n').filter(p => p.trim().length > 35);
  const summaryText = rawParagraphs[0]
    ? (rawParagraphs[0].length > 160 ? rawParagraphs[0].slice(0, 157) + '...' : rawParagraphs[0])
    : `${meta.title}. Novedades en la escena de ${meta.region || 'Iberoamérica'}.`;

  const photoCredit = `Vía ${meta.source} / Prensa oficial`;

  let synthesizedHtml = '';
  if (rawParagraphs.length >= 2) {
    synthesizedHtml = rawParagraphs.slice(0, 3).map(p => `<p>${escapeHtml(p)}</p>`).join('\n');
  } else {
    synthesizedHtml = `<p>${escapeHtml(factualContext)}</p>`;
  }

  synthesizedHtml += `
    <div class="source-credit" style="font-family:var(--font-mono); font-size:11.5px; color:#94a3b8; border-left:3px solid var(--accent-cyan); padding:10px 14px; margin-top:24px; background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0;">
      Fuente original: <a href="${escapeHtml(meta.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-lime); font-weight:700; text-decoration:none;">${escapeHtml(meta.source)} ↗</a> · Foto: ${photoCredit}
    </div>
  `;

  return {
    slug,
    title: meta.title.length > 80 ? meta.title.slice(0, 77) + '...' : meta.title,
    summary: summaryText,
    content: synthesizedHtml,
    category: 'Cultura Indie',
    author: 'Rodrigo dL Moral',
    author_role: 'Curador & Fundador TNIW',
    author_avatar: 'rodrigo_studio_web.jpg',
    image_url: meta.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    read_time: '1.5 min',
    tags: [meta.region || 'Indie', 'Música Indie', 'Radar TNIW'],
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

function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString().replace(/([_*\[`])/g, '\\$1');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==============================================================================
// GENERADOR DE MOCKUPS EDITORIALES TNIW (POST 1:1 Y STORY 9:16)
// ==============================================================================
function wrapTextToLines(text, maxCharsPerLine) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchImageAsBase64(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TNIW/1.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

function buildPostMockupSvg({ title, summary, imageBase64, region = 'México', category = 'Cultura Indie' }) {
  const W = 1080;
  const H = 1080;

  const rawTitleLines = wrapTextToLines(title, 34);
  const titleLines = rawTitleLines.slice(0, 3);
  if (rawTitleLines.length > 3 && titleLines[2]) {
    titleLines[2] = titleLines[2].replace(/[.,:;]?$/, '...');
  }

  const rawSummaryLines = wrapTextToLines(summary, 52);
  const summaryLines = rawSummaryLines.slice(0, 3);
  if (rawSummaryLines.length > 3 && summaryLines[2]) {
    summaryLines[2] = summaryLines[2].replace(/[.,:;]?$/, '...');
  }

  const titleTspans = titleLines.map((line, i) => 
    `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 44}">${escapeXml(line)}</tspan>`
  ).join('');

  const summaryTspans = summaryLines.map((line, i) => 
    `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="postImgClip">
      <rect x="70" y="180" width="940" height="480" rx="20"/>
    </clipPath>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0c0d12"/>
      <stop offset="50%" stop-color="#08080a"/>
      <stop offset="100%" stop-color="#050507"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <g stroke="rgba(255,255,255,0.025)" stroke-width="1">
    <line x1="0" y1="120" x2="${W}" y2="120"/>
    <line x1="0" y1="240" x2="${W}" y2="240"/>
    <line x1="0" y1="360" x2="${W}" y2="360"/>
    <line x1="0" y1="480" x2="${W}" y2="480"/>
    <line x1="0" y1="600" x2="${W}" y2="600"/>
    <line x1="0" y1="720" x2="${W}" y2="720"/>
    <line x1="0" y1="840" x2="${W}" y2="840"/>
    <line x1="0" y1="960" x2="${W}" y2="960"/>
    <line x1="120" y1="0" x2="120" y2="${H}"/>
    <line x1="240" y1="0" x2="240" y2="${H}"/>
    <line x1="360" y1="0" x2="360" y2="${H}"/>
    <line x1="480" y1="0" x2="480" y2="${H}"/>
    <line x1="600" y1="0" x2="600" y2="${H}"/>
    <line x1="720" y1="0" x2="720" y2="${H}"/>
    <line x1="840" y1="0" x2="840" y2="${H}"/>
    <line x1="960" y1="0" x2="960" y2="${H}"/>
  </g>

  <rect x="35" y="35" width="1010" height="1010" fill="none" stroke="rgba(187, 244, 81, 0.35)" stroke-width="2.5" rx="26"/>
  <rect x="39" y="39" width="1002" height="1002" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1" rx="22"/>

  <text x="${W / 2}" y="92" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="34" font-weight="900" text-anchor="middle" letter-spacing="4">THE NEW INDIE WAVE</text>
  
  <rect x="${(W - 320) / 2}" y="115" width="320" height="34" rx="17" fill="rgba(187, 244, 81, 0.12)" stroke="rgba(187, 244, 81, 0.5)" stroke-width="1.5"/>
  <text x="${W / 2}" y="138" fill="#bbf451" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="bold" text-anchor="middle" letter-spacing="2">RADAR EDITORIAL // ${escapeXml(region).toUpperCase()}</text>

  <rect x="68" y="178" width="944" height="484" rx="22" fill="#141419" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <g clip-path="url(#postImgClip)">
    <image href="${imageBase64}" x="70" y="180" width="940" height="480" preserveAspectRatio="xMidYMid slice"/>
  </g>

  <rect x="90" y="200" width="170" height="32" rx="6" fill="rgba(9, 9, 11, 0.88)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
  <text x="175" y="221" fill="#38bdf8" font-family="'Courier New', Courier, monospace" font-size="12" font-weight="bold" text-anchor="middle" letter-spacing="1">⚡ NOTICIA FLASH</text>

  <g transform="translate(0, 715)">
    <text x="${W / 2}" y="0" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="35" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
      ${titleTspans}
    </text>
  </g>

  <g transform="translate(0, 855)">
    <text x="${W / 2}" y="0" fill="#cbd5e1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="400" text-anchor="middle" letter-spacing="0.2">
      ${summaryTspans}
    </text>
  </g>

  <g transform="translate(${(W - 480) / 2}, 960)">
    <rect width="480" height="52" rx="26" fill="#bbf451"/>
    <text x="240" y="32" fill="#09090b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="17" font-weight="900" text-anchor="middle" letter-spacing="1">LEER NOTA COMPLETA ↗  thenewindiewave.online</text>
  </g>
</svg>`;
}

function buildStoryMockupSvg({ title, summary, imageBase64, region = 'México', category = 'Cultura Indie' }) {
  const W = 1080;
  const H = 1920;

  const rawTitleLines = wrapTextToLines(title, 32);
  const titleLines = rawTitleLines.slice(0, 4);
  if (rawTitleLines.length > 4 && titleLines[3]) {
    titleLines[3] = titleLines[3].replace(/[.,:;]?$/, '...');
  }

  const rawSummaryLines = wrapTextToLines(summary, 46);
  const summaryLines = rawSummaryLines.slice(0, 5);
  if (rawSummaryLines.length > 5 && summaryLines[4]) {
    summaryLines[4] = summaryLines[4].replace(/[.,:;]?$/, '...');
  }

  const titleTspans = titleLines.map((line, i) => 
    `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 56}">${escapeXml(line)}</tspan>`
  ).join('');

  const summaryTspans = summaryLines.map((line, i) => 
    `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 40}">${escapeXml(line)}</tspan>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="storyImgClip">
      <rect x="80" y="300" width="920" height="740" rx="28"/>
    </clipPath>
    <linearGradient id="bgStoryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0e1017"/>
      <stop offset="40%" stop-color="#08090d"/>
      <stop offset="100%" stop-color="#040507"/>
    </linearGradient>
    <radialGradient id="glowTop" cx="80%" cy="15%" r="40%">
      <stop offset="0%" stop-color="rgba(56, 189, 248, 0.18)"/>
      <stop offset="100%" stop-color="rgba(56, 189, 248, 0)"/>
    </radialGradient>
    <radialGradient id="glowBottom" cx="20%" cy="85%" r="40%">
      <stop offset="0%" stop-color="rgba(187, 244, 81, 0.15)"/>
      <stop offset="100%" stop-color="rgba(187, 244, 81, 0)"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgStoryGrad)"/>
  <rect width="${W}" height="${H}" fill="url(#glowTop)"/>
  <rect width="${W}" height="${H}" fill="url(#glowBottom)"/>

  <rect x="40" y="60" width="1000" height="1800" fill="none" stroke="rgba(255, 255, 255, 0.12)" stroke-width="2" rx="36"/>

  <text x="${W / 2}" y="145" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="38" font-weight="900" text-anchor="middle" letter-spacing="4">THE NEW INDIE WAVE</text>
  <text x="${W / 2}" y="190" fill="#bbf451" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="bold" text-anchor="middle" letter-spacing="3">// NOTICIAS &amp; RADAR EDITORIAL //</text>

  <rect x="${(W - 280) / 2}" y="220" width="280" height="42" rx="21" fill="rgba(187, 244, 81, 0.12)" stroke="#bbf451" stroke-width="1.5"/>
  <text x="${W / 2}" y="247" fill="#bbf451" font-family="'Courier New', Courier, monospace" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">${escapeXml(region).toUpperCase()}</text>

  <rect x="76" y="296" width="928" height="748" rx="30" fill="#141419" stroke="rgba(255,255,255,0.18)" stroke-width="2.5"/>
  <g clip-path="url(#storyImgClip)">
    <image href="${imageBase64}" x="80" y="300" width="920" height="740" preserveAspectRatio="xMidYMid slice"/>
  </g>

  <rect x="110" y="330" width="210" height="40" rx="8" fill="rgba(9, 9, 11, 0.88)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="215" y="356" fill="#38bdf8" font-family="'Courier New', Courier, monospace" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="1">⚡ RADAR NOTICIAS</text>

  <g transform="translate(0, 1120)">
    <text x="${W / 2}" y="0" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="44" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
      ${titleTspans}
    </text>
  </g>

  <g transform="translate(0, 1360)">
    <text x="${W / 2}" y="0" fill="#cbd5e1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="400" text-anchor="middle" letter-spacing="0.2">
      ${summaryTspans}
    </text>
  </g>

  <line x1="200" y1="1610" x2="880" y2="1610" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>

  <g transform="translate(${(W - 600) / 2}, 1670)">
    <rect width="600" height="76" rx="38" fill="#bbf451"/>
    <text x="300" y="47" fill="#09090b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="24" font-weight="900" text-anchor="middle" letter-spacing="1">👉 LEE LA NOTA EN NUESTRA WEB</text>
  </g>

  <text x="${W / 2}" y="1800" fill="#94a3b8" font-family="'Courier New', Courier, monospace" font-size="20" font-weight="bold" text-anchor="middle" letter-spacing="2">thenewindiewave.online/blog</text>
</svg>`;
}

async function uploadSvgAsPngToCloudinary(svgContent, namePrefix = 'mockup') {
  if (!svgContent) return null;
  try {
    const cloudName = 'ckknw1do';
    const apiKey = '576643641599951';
    const apiSecret = 'BqRSk2zRcn2-BtMi9BIHHiRyTfQ';
    const folder = 'social-hub/6c3d2719-eb61-4ee5-ab4c-89b2810e2c4c';
    const timestamp = Math.floor(Date.now() / 1000);

    const strToSign = `folder=${folder}&format=png&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;

    const body = new URLSearchParams();
    body.append('file', dataUri);
    body.append('api_key', apiKey);
    body.append('timestamp', timestamp.toString());
    body.append('signature', signature);
    body.append('folder', folder);
    body.append('format', 'png');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.secure_url) return data.secure_url;
    } else {
      const errText = await res.text();
      console.warn('[Cloudinary SVG Upload Error]:', errText);
    }
  } catch (err) {
    console.warn('[Cloudinary SVG Exception]:', err.message);
  }
  return null;
}

async function generateNewsMockups({ title, summary, imageUrl, region = 'México', category = 'Cultura Indie' }) {
  try {
    const fallbackUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';
    let base64 = await fetchImageAsBase64(imageUrl);
    if (!base64 && imageUrl !== fallbackUrl) {
      base64 = await fetchImageAsBase64(fallbackUrl);
    }
    if (!base64) return { postMockupUrl: null, storyMockupUrl: null };

    const cleanTitle = (title || '').replace(/\s+/g, ' ').trim();
    const cleanSummary = (summary || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s*[\.\s]*(?:cobertura\s+(?:v[ií]a|por)|v[ií]a\b|fuente\s*:|prensa\s*:)\s+[^.\n!]+[.\n!]?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const postSvg = buildPostMockupSvg({
      title: cleanTitle,
      summary: cleanSummary,
      imageBase64: base64,
      region,
      category
    });

    const storySvg = buildStoryMockupSvg({
      title: cleanTitle,
      summary: cleanSummary,
      imageBase64: base64,
      region,
      category
    });

    const [postMockupUrl, storyMockupUrl] = await Promise.all([
      uploadSvgAsPngToCloudinary(postSvg, 'post'),
      uploadSvgAsPngToCloudinary(storySvg, 'story')
    ]);

    return { postMockupUrl, storyMockupUrl };
  } catch (err) {
    console.warn('[generateNewsMockups Error]:', err);
    return { postMockupUrl: null, storyMockupUrl: null };
  }
}

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
    let finalPostImageUrl = null;
    if (article.post_mockup_url) {
      finalPostImageUrl = await uploadImageToCloudinary(article.post_mockup_url);
    } else {
      finalPostImageUrl = await uploadImageToCloudinary(article.image_url);
    }

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
    const url = `https://thenewindiewave.online/blog#${article.slug || ''}`;

    const copyText = `🚨 ¡NUEVA NOTA EN EL RADAR EDITORIAL! 🚨\n\n"${title}"\n\n${cleanSummary}\n\n👉 Lee la cobertura completa en el blog:\n🔗 ${url}\n\n#TheNewIndieWave #CulturaIndie #MusicaIndie #BlogMusical`;

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

    await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify(recordFeed)
      }),
      fetch(`${SUPABASE_URL}/rest/v1/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify(recordStory)
      })
    ]);

    return true;
  } catch (err) {
    console.warn('[news-scout] Error al publicar en Social Hub:', err.message);
    return false;
  }
}

main();



