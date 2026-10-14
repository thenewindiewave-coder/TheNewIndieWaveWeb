/**
 * ============================================================================
 * THE NEW INDIE WAVE — CURADOR AUTOMÁTICO DE THREADS (EDICIÓN STEALTH / ANTI-BOT)
 * ============================================================================
 * 1. Pide la URL del post de Threads (o recuerda el último usado con ENTER).
 * 2. Lee respuestas del post con enlaces de Spotify (excluyendo ya procesados).
 * 3. Muestra canción y artista para que elijas manualmente tu Playlist oficial.
 * 4. Añade el track a tu playlist en Spotify usando la API oficial.
 * 5. Genera la Historia 9:16 (1080x1920) oficial desde curador.html.
 * 6. Protecciones Anti-Bot activas:
 *    - Evasión de navigator.webdriver y banderas de automatización de Chrome
 *    - Escritura humana realista con cadencia variable y pausas en puntuación
 *    - Movimiento orgánico del ratón antes de hacer clic
 *    - Delays aleatorios seguros (12 a 20s) entre respuestas
 *    - Confirmación previa antes de publicar
 * ============================================================================
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Rutas base
const ROOT_DIR = path.resolve(__dirname, '..');
const SOCIAL_HUB_DIR = path.resolve(__dirname, '../../../Social Hub');
const PROCESSED_FILE = path.resolve(ROOT_DIR, 'threads_procesados.json');
const SESSION_PROFILE_DIR = path.resolve(ROOT_DIR, '.threads_session_profile');
const CURADOR_HTML_PATH = path.resolve(ROOT_DIR, 'curador.html');
const LAST_URL_FILE = path.resolve(ROOT_DIR, '.threads_last_post_url.txt');
const DEFAULT_POST_URL = 'https://www.threads.com/share/DJh7hhInU/';

// Importar puppeteer con plugin Stealth desde Social Hub
const puppeteer = require(path.resolve(SOCIAL_HUB_DIR, 'node_modules/puppeteer-extra'));
const StealthPlugin = require(path.resolve(SOCIAL_HUB_DIR, 'node_modules/puppeteer-extra-plugin-stealth'));
puppeteer.use(StealthPlugin());

// Cargar variables de entorno desde .env si existen
function loadEnv() {
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

// Las 9 Playlists Oficiales
const OFFICIAL_PLAYLISTS = [
  { id: "56UTFQQSDPuY5cjxDol5Ob", name: "Electrónica emergente para perder el control en la pista", url: "https://open.spotify.com/playlist/56UTFQQSDPuY5cjxDol5Ob", genre: "ELECTRÓNICA" },
  { id: "79SKuyss3MfkzvOJGnaisB", name: "Mezcla de rolas urbanas para farmear Aura", url: "https://open.spotify.com/playlist/79SKuyss3MfkzvOJGnaisB", genre: "URBANO" },
  { id: "4mcJJz8GiKTuxieL9Jziln", name: "Darkwave oscuro y atmosférico para la madrugada", url: "https://open.spotify.com/playlist/4mcJJz8GiKTuxieL9Jziln", genre: "DARKWAVE" },
  { id: "7bbYPZ5ia4IGRP2fT47kXr", name: "Música urbana con flow y ritmo para moverte", url: "https://open.spotify.com/playlist/7bbYPZ5ia4IGRP2fT47kXr", genre: "URBANO" },
  { id: "5OLiBaOPAe5cBEdV1AoSd1", name: "Metal intenso para liberar toda tu energía", url: "https://open.spotify.com/playlist/5OLiBaOPAe5cBEdV1AoSd1", genre: "METAL" },
  { id: "6cuhRpfYmEt0vYCT9mFLKc", name: "Rock para sacar la rabia y el enojo acumulado", url: "https://open.spotify.com/playlist/6cuhRpfYmEt0vYCT9mFLKc", genre: "ROCK" },
  { id: "20uF7xCOW8zldDCiAowxuF", name: "SoftSongs para esos domingos sin hacer nada", url: "https://open.spotify.com/playlist/20uF7xCOW8zldDCiAowxuF", genre: "SOFT INDIE" },
  { id: "0Ty7tTNh1ONGyOLuasPREj", name: "Dreamy Songs para escuchar en la intimidad de tu habitación", url: "https://open.spotify.com/playlist/0Ty7tTNh1ONGyOLuasPREj", genre: "DREAM POP" },
  { id: "36ribRboGB3DwM821oYokl", name: "SynthPop para cuando solo quieres bailar", url: "https://open.spotify.com/playlist/36ribRboGB3DwM821oYokl", genre: "SYNTHPOP" }
];

// Helper para preguntas interactivas en consola
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(question, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

// Cargar / Guardar historial de comentarios ya respondidos
function loadProcessed() {
  if (fs.existsSync(PROCESSED_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveProcessed(list) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// ----------------------------------------------------------------------------
// ANTI-BOT: ESCRITURA Y ACCIONES HUMANAS
// ----------------------------------------------------------------------------
async function humanType(page, text) {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    await page.keyboard.type(char);

    // Retraso aleatorio orgánico por cada letra (30ms a 75ms)
    let delay = Math.floor(Math.random() * 45) + 30;

    // Pausas adicionales humanas en signos de puntuación y saltos de línea
    if (char === '\n' || char === '.' || char === '!' || char === '?' || char === '—') {
      delay += Math.floor(Math.random() * 260) + 180;
    } else if (char === ' ') {
      delay += Math.floor(Math.random() * 55) + 15;
    }
    await new Promise(r => setTimeout(r, delay));
  }
}

async function humanClick(page, element) {
  try {
    const box = await element.boundingBox();
    if (box) {
      const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
      const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

      // Mover ratón gradualmente con pasos intermedios
      await page.mouse.move(targetX, targetY, { steps: Math.floor(Math.random() * 12) + 10 });
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 200) + 120));
      await page.mouse.click(targetX, targetY);
      return;
    }
  } catch (e) {}
  await element.click();
}

// ----------------------------------------------------------------------------
// SPOTIFY API HELPERS
// ----------------------------------------------------------------------------
async function fetchSupabaseRefreshToken() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/radar_artists?id=eq.spotify_auth_config&select=short_bio`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && data[0].short_bio) {
        return data[0].short_bio.trim();
      }
    }
  } catch (e) {
    console.warn('⚠️ No se pudo leer token de Supabase:', e.message);
  }
  return null;
}

async function getSpotifyAccessToken() {
  const refreshToken = await fetchSupabaseRefreshToken();
  if (!refreshToken) {
    throw new Error('No se encontró el refresh token de Spotify en Supabase.');
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  });

  if (!res.ok) {
    throw new Error('Error al refrescar token de Spotify: ' + (await res.text()));
  }

  const data = await res.json();
  return data.access_token;
}

function parseSpotifyId(urlOrId) {
  if (!urlOrId) return null;
  const match = urlOrId.match(/track[/:]([a-zA-Z0-9]{15,30})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]{15,30}$/.test(urlOrId.trim())) return urlOrId.trim();
  return null;
}

async function getTrackDetails(trackId, accessToken) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.name,
        artist: (data.artists || []).map(a => a.name).join(', '),
        cover: data.album && data.album.images && data.album.images[0] ? data.album.images[0].url : null
      };
    }
  } catch (e) {}

  // Fallback oEmbed
  try {
    const oembedRes = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`);
    if (oembedRes.ok) {
      const od = await oembedRes.json();
      return {
        title: od.title || 'Track',
        artist: od.author_name || 'Artista',
        cover: od.thumbnail_url || null
      };
    }
  } catch (e) {}

  return { title: 'Track', artist: 'Artista', cover: null };
}

async function addTrackToPlaylist(playlistId, trackId, accessToken) {
  const trackUri = `spotify:track:${trackId}`;
  let addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris: [trackUri] })
  });

  if (!addRes.ok && addRes.status === 404) {
    addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [trackUri] })
    });
  }

  if (!addRes.ok) {
    const errData = await addRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Error al agregar a Spotify (${addRes.status})`);
  }

  return true;
}

// ----------------------------------------------------------------------------
// GENERADOR DE STORY CANVAS (1080x1920)
// ----------------------------------------------------------------------------
async function generateStoryImage(browser, artist, song, playlistName, genre, playlistUrl) {
  const storyPage = await browser.newPage();
  try {
    const fileUrl = 'file:///' + CURADOR_HTML_PATH.replace(/\\/g, '/');
    await storyPage.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });

    await storyPage.waitForFunction(() => typeof window.generateCuratorStoryCanvas === 'function', { timeout: 10000 });

    const dataUrl = await storyPage.evaluate(async (art, sng, pl, gen, url) => {
      let canvas = document.getElementById('amStoryCanvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'amStoryCanvas';
        canvas.width = 1080;
        canvas.height = 1920;
        document.body.appendChild(canvas);
      }

      window.generateCuratorStoryCanvas(art, sng, pl, gen || 'INDIE', 'amStoryCanvas', url);
      await new Promise(r => setTimeout(r, 1500));
      return canvas.toDataURL('image/png');
    }, artist, song, playlistName, genre, playlistUrl);

    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      const tempImagePath = path.resolve(__dirname, `temp_story_${Date.now()}.png`);
      fs.writeFileSync(tempImagePath, base64Data, 'base64');
      return tempImagePath;
    }
  } catch (e) {
    console.error('⚠️ Error generando Story:', e.message);
  } finally {
    await storyPage.close().catch(() => {});
  }
  return null;
}

// ----------------------------------------------------------------------------
// FLUJO PRINCIPAL
// ----------------------------------------------------------------------------
async function main() {
  console.clear();
  console.log('========================================================================');
  console.log('    🌊 THE NEW INDIE WAVE — CURADOR DE THREADS (MODO STEALTH) 🌊        ');
  console.log('========================================================================\n');

  // 1. Determinar URL del post a curar
  let lastUsedUrl = DEFAULT_POST_URL;
  if (fs.existsSync(LAST_URL_FILE)) {
    try {
      const saved = fs.readFileSync(LAST_URL_FILE, 'utf8').trim();
      if (saved) lastUsedUrl = saved;
    } catch (e) {}
  }

  let targetPostUrl = process.argv[2] ? process.argv[2].trim() : null;

  if (!targetPostUrl) {
    console.log('📌 ¿QUÉ POST DE THREADS DESEAS CURAR HOY?');
    console.log(`[ENTER directo] Usar último post: ${lastUsedUrl}`);
    const inputUrl = await ask('👉 Pega la URL del post (o presiona ENTER): ');
    targetPostUrl = (inputUrl && inputUrl.trim()) ? inputUrl.trim() : lastUsedUrl;
  }

  // Guardar URL para recordar en la próxima ejecución
  fs.writeFileSync(LAST_URL_FILE, targetPostUrl, 'utf8');
  console.log(`\n🎯 Post seleccionado: ${targetPostUrl}\n`);

  console.log('🔑 Conectando con Spotify API...');
  let spotifyToken;
  try {
    spotifyToken = await getSpotifyAccessToken();
    console.log('✅ Spotify API autenticada correctamente.\n');
  } catch (err) {
    console.error('❌ Error con Spotify API:', err.message);
    process.exit(1);
  }

  const processedList = loadProcessed();
  console.log(`📋 Total de temas previamente procesados en el historial: ${processedList.length}`);

  console.log('🛡️  Iniciando navegador con blindaje Anti-Bot...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir: SESSION_PROFILE_DIR,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--start-maximized',
      '--lang=es-ES'
    ]
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // Ocultar huellas de automatización en la página
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  console.log(`➡️  Navegando al post en Threads...`);
  await page.goto(targetPostUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // Comprobar si está logueado en Threads
  const isLogged = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    const hasLoginButton = Array.from(document.querySelectorAll('a, button')).some(el => {
      const t = el.innerText.toLowerCase().trim();
      return t === 'iniciar sesión' || t === 'log in';
    });
    return !hasLoginButton;
  });

  if (!isLogged) {
    console.log('\n⚠️  ATENCIÓN: No has iniciado sesión en Threads.');
    console.log('👉 Por favor inicia sesión con tu cuenta (@rodrigodlmoral) en la ventana de Chrome.');
    await ask('\nPresiona ENTER aquí una vez que hayas iniciado sesión para continuar...');
  }

  console.log('\n⏳ Explorando comentarios del post con pausas naturales...');
  // Scroll suave imitando lectura humana
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 800 + Math.floor(Math.random() * 400)));
    await new Promise(r => setTimeout(r, 1600 + Math.floor(Math.random() * 600)));
  }

  // Extraer comentarios que contienen links de tracks de Spotify
  const replies = await page.evaluate(() => {
    const list = [];
    const links = Array.from(document.querySelectorAll('a'));

    for (const a of links) {
      const href = a.href || '';
      if (!href.includes('spotify.com/track')) continue;

      let cleanUrl = href;
      try {
        if (href.includes('l.threads.com')) {
          const u = new URL(href).searchParams.get('u');
          if (u) cleanUrl = decodeURIComponent(u);
        }
      } catch (e) {}

      // Contenedor del comentario
      let parent = a;
      let container = null;
      for (let i = 0; i < 8; i++) {
        if (!parent) break;
        if (parent.tagName === 'DIV' && parent.innerText && parent.innerText.length > 30) {
          container = parent;
        }
        parent = parent.parentElement;
      }

      // Buscar autor
      let author = '';
      if (container) {
        const authorLink = container.querySelector('a[href^="/@"]');
        if (authorLink) {
          author = authorLink.innerText.trim() || authorLink.getAttribute('href');
        }
      }
      if (author.startsWith('/')) author = author.slice(1);
      if (!author.startsWith('@') && author) author = '@' + author;

      list.push({
        author: author || '@artista',
        spotifyUrl: cleanUrl
      });
    }

    // Filtrar duplicados por URL de Spotify
    const unique = [];
    const seen = new Set();
    for (const item of list) {
      const trackIdMatch = item.spotifyUrl.match(/track[/:]([a-zA-Z0-9]{15,30})/);
      const trackKey = trackIdMatch ? trackIdMatch[1] : item.spotifyUrl;
      if (!seen.has(trackKey)) {
        seen.add(trackKey);
        unique.push(item);
      }
    }
    return unique;
  });

  console.log(`\n🔍 Se detectaron ${replies.length} respuestas con canciones de Spotify en el post.`);

  // Filtrar las que ya han sido procesadas
  const pending = replies.filter(r => {
    const trackId = parseSpotifyId(r.spotifyUrl);
    return !processedList.some(p => p.trackId === trackId || p.spotifyUrl === r.spotifyUrl);
  });

  if (pending.length === 0) {
    console.log('✨ ¡Excelente! No hay canciones nuevas pendientes de procesar en este momento.');
    console.log('Puedes volver a ejecutar este script cuando recibas más comentarios.\n');
    await ask('Presiona ENTER para salir y cerrar el navegador...');
    await browser.close();
    return;
  }

  console.log(`🎯 ${pending.length} canciones nuevas listas para curar.\n`);

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const trackId = parseSpotifyId(item.spotifyUrl);
    if (!trackId) continue;

    console.log('========================================================================');
    console.log(`🎵 [${i + 1}/${pending.length}] NUEVA PROPUESTA ENCONTRADA`);
    console.log(`👤 Usuario en Threads: ${item.author}`);
    console.log(`🔗 Spotify URL: ${item.spotifyUrl}`);

    // Consultar detalles de la canción en Spotify
    const details = await getTrackDetails(trackId, spotifyToken);
    console.log(`🎧 Canción: "${details.title}" — ${details.artist}`);
    console.log('========================================================================');
    console.log('¿A qué playlist oficial deseas agregar esta canción?');
    OFFICIAL_PLAYLISTS.forEach((pl, idx) => {
      console.log(`  [${idx + 1}] ${pl.name}`);
    });
    console.log('  [S] Saltar este tema (no hacer nada con este comentario)');
    console.log('  [Q] Guardar y salir del curador');
    console.log('========================================================================');

    let choice = await ask('Selecciona una opción [1-9 / S / Q]: ');
    choice = choice.trim().toUpperCase();

    if (choice === 'Q') {
      console.log('\n👋 Curador pausado. Progreso guardado.');
      break;
    }

    if (choice === 'S') {
      console.log(`⏭️  Comentario de ${item.author} saltado.\n`);
      continue;
    }

    const plIndex = parseInt(choice, 10) - 1;
    if (isNaN(plIndex) || plIndex < 0 || plIndex >= OFFICIAL_PLAYLISTS.length) {
      console.log('⚠️ Opción inválida. Saltando este tema por seguridad.\n');
      continue;
    }

    const selectedPlaylist = OFFICIAL_PLAYLISTS[plIndex];
    console.log(`\n⏳ 1. Agregando "${details.title}" a "${selectedPlaylist.name}" en Spotify...`);

    try {
      await addTrackToPlaylist(selectedPlaylist.id, trackId, spotifyToken);
      console.log('✅ Canción añadida con éxito a Spotify!');
    } catch (addErr) {
      console.error('❌ Error al agregar a Spotify:', addErr.message);
      const retry = await ask('¿Deseas continuar respondiéndole en Threads de todos modos? [S/N]: ');
      if (retry.toUpperCase() !== 'S') continue;
    }

    // 2. Generar Story
    console.log('⏳ 2. Generando Story 9:16 oficial en alta resolución (1080x1920)...');
    const storyImagePath = await generateStoryImage(
      browser,
      details.artist,
      details.title,
      selectedPlaylist.name,
      selectedPlaylist.genre,
      selectedPlaylist.url
    );

    if (storyImagePath && fs.existsSync(storyImagePath)) {
      console.log(`✅ Story generada con éxito: ${path.basename(storyImagePath)}`);
    } else {
      console.log('⚠️ No se pudo generar la imagen de la Story; se continuará con texto.');
    }

    // 3. Redactar el mensaje oficial
    const replyText = `¡Felicidades ${item.author}! 🎉 Es de nuestro agrado informarte que tu tema: “${details.title}” fue seleccionado para añadirse en la rotación de nuestra playlist oficial: “${selectedPlaylist.name}”
${selectedPlaylist.url}

Te invitamos a compartir esta historia en tus redes para celebrar este paso y que sigan creciendo los éxitos.

Si en el futuro deseas enviar más tracks, puedes hacerlo desde nuestro formulario oficial en https://thenewindiewave.online/enviar 🎶

Sigamos haciendo comunidad:
Instagram:
@the.new.indie.wave
@rodrigodlmoral`;

    console.log('\n------------------------------------------------------------------------');
    console.log('📝 MENSAJE GENERADO LISTO PARA ENVIAR:\n');
    console.log(replyText);
    console.log('------------------------------------------------------------------------');
    const confirmPost = await ask('👉 ¿Confirmar envío a Threads con Story adjunta? [ENTER: Sí / N: Omitir]: ');
    if (confirmPost.trim().toUpperCase() === 'N') {
      console.log('⏭️ Envío en Threads omitido por el usuario.');
      processedList.push({
        author: item.author,
        spotifyUrl: item.spotifyUrl,
        trackId: trackId,
        songTitle: details.title,
        artistName: details.artist,
        playlist: selectedPlaylist.name,
        timestamp: new Date().toISOString()
      });
      saveProcessed(processedList);
      continue;
    }

    // 4. Responder en Threads
    console.log(`⏳ 3. Publicando respuesta a ${item.author} en Threads con cadencia humana...`);
    try {
      await page.bringToFront();

      // Buscar botón responder del comentario
      const clicked = await page.evaluate((targetUrl) => {
        const anchors = Array.from(document.querySelectorAll('a'));
        const targetA = anchors.find(a => (a.href || '').includes(targetUrl) || (a.innerText || '').includes('spotify.com'));
        if (!targetA) return false;

        let container = targetA;
        for (let i = 0; i < 8; i++) {
          if (!container) break;
          if (container.tagName === 'DIV' && container.innerText && container.innerText.length > 30) break;
          container = container.parentElement;
        }

        if (!container) return false;

        const buttons = Array.from(container.querySelectorAll('div[role="button"], button'));
        const replyBtn = buttons.find(b => {
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return aria.includes('responder') || aria.includes('reply');
        }) || buttons[1];

        if (replyBtn) {
          replyBtn.click();
          return true;
        }
        return false;
      }, trackId);

      if (clicked) {
        await page.waitForSelector('div[role="textbox"], div[contenteditable="true"]', { timeout: 8000 });
        const textBox = await page.$('div[role="textbox"], div[contenteditable="true"]');
        if (textBox) {
          await humanClick(page, textBox);
          await new Promise(r => setTimeout(r, 600));

          // Escribir texto como humano
          console.log('✍️  Escribiendo mensaje de forma orgánica...');
          await humanType(page, replyText);
          await new Promise(r => setTimeout(r, 1200));

          // Adjuntar Story si existe
          if (storyImagePath && fs.existsSync(storyImagePath)) {
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
              console.log('📎 Adjuntando Story visual al comentario...');
              await fileInput.uploadFile(storyImagePath);
              await new Promise(r => setTimeout(r, 3500)); // Esperar carga de imagen
            }
          }

          // Clic en "Publicar"
          const postBtn = await page.evaluateHandle(() => {
            const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
            return btns.find(b => {
              const txt = (b.innerText || '').toLowerCase().trim();
              return txt === 'publicar' || txt === 'post';
            });
          });

          if (postBtn && postBtn.asElement()) {
            await humanClick(page, postBtn.asElement());
            console.log(`🚀 ¡Respuesta publicada exitosamente a ${item.author}!`);
            await new Promise(r => setTimeout(r, 4000));
          } else {
            console.log('ℹ️ Por favor revisa la ventana de Chrome y haz clic en "Publicar" manualmente si el botón no respondió.');
            await ask('Presiona ENTER una vez publicado...');
          }
        }
      } else {
        console.log(`⚠️ No se localizó automáticamente el botón de responder para ${item.author}.`);
        console.log('Copia este mensaje para responderle manualmente si lo deseas:');
        console.log('\n' + replyText + '\n');
        await ask('Presiona ENTER para continuar...');
      }

      // Guardar en procesados
      processedList.push({
        author: item.author,
        spotifyUrl: item.spotifyUrl,
        trackId: trackId,
        songTitle: details.title,
        artistName: details.artist,
        playlist: selectedPlaylist.name,
        timestamp: new Date().toISOString()
      });
      saveProcessed(processedList);

      // Eliminar imagen temporal
      if (storyImagePath && fs.existsSync(storyImagePath)) {
        fs.unlinkSync(storyImagePath);
      }

    } catch (postErr) {
      console.error('⚠️ Error al interactuar con Threads:', postErr.message);
    }

    // Delay aleatorio de seguridad anti-bot entre 14 y 22 segundos
    const jitterSeconds = Math.floor(Math.random() * (22 - 14 + 1)) + 14;
    console.log(`🛡️  Pausa de seguridad anti-bot (${jitterSeconds}s) antes del siguiente comentario...\n`);
    await new Promise(r => setTimeout(r, jitterSeconds * 1000));
  }

  console.log('\n🎉 ¡Proceso de curación finalizado!');
  console.log(`Total de canciones registradas en este lote: ${processedList.length}`);
  await ask('\nPresiona ENTER para cerrar el navegador y finalizar...');
  await browser.close();
}

main().catch(err => {
  console.error('\n❌ Error inesperado:', err);
  process.exit(1);
});
