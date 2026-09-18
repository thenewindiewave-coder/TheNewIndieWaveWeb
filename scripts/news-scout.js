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
          const imgTagMatch = rawItem.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (mediaMatch) feedImg = mediaMatch[1];
          else if (encMatch) feedImg = encMatch[1];
          else if (imgTagMatch) feedImg = imgTagMatch[1];

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
          image_url: c.image_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
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
    `• Toca un botón abajo para redactar y publicar con 1 clic en el blog.`,
    `• O responde a este mensaje con el número <b>(1, 2, 3...)</b>.`,
    ``,
    `⏳ <i>Si no respondes antes de las 5:00 PM, se publicará automáticamente 1 nota al azar.</i>`
  ].join('\n');

  // Construir teclado de botones interactivos (máx 64 bytes para callback_data)
  const buttons = [];
  for (let i = 0; i < topCandidates.length; i += 2) {
    const row = [];
    row.push({ text: `⚡ Publicar #${i + 1}`, callback_data: `pub:${i + 1}` });
    if (i + 1 < topCandidates.length) {
      row.push({ text: `⚡ Publicar #${i + 2}`, callback_data: `pub:${i + 2}` });
    }
    buttons.push(row);
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

  // 5. Publicar en Supabase
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
      image_url: editorial.image_url || selectedItem.image_url,
      published: true,
      published_at: new Date().toISOString()
    })
  });

  if (updateRes.ok) {
    console.log(`🎉 ¡Fallback de las 5:00 PM ejecutado con éxito!`);
    
    // Auto-archivar para mantener exactamente 7 notas en portada
    await enforceSevenArticlesLimit();

    // 6. Notificar a Telegram
    const alertMsg = [
      `⏰ <b>RADAR TNIW // 5:00 PM (PUBLICACIÓN AUTOMÁTICA)</b>`,
      `No se seleccionó ninguna nota durante el día.`,
      `Se ha redactado y publicado automáticamente <b>1 nota al azar</b>:`,
      ``,
      `📰 <b>${escapeHtml(editorial.title)}</b>`,
      `🏷️ <b>Categoría:</b> Cultura Indie // ${escapeHtml(meta.region || 'Indie')}`,
      `📸 <b>Foto:</b> Vía ${escapeHtml(meta.source || 'Prensa')} / Oficial`,
      ``,
      `🔗 <a href="https://thenewindiewave.online/blog#${selectedItem.slug}">Ver en el Blog</a>`,
      `⚡ Portada sincronizada en 7 notas.`
    ].join('\n');

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

main();



