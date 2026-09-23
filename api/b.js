module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

  // Extraer el código desde req.query.code o desde req.url
  let rawCode = (req.query && req.query.code) ? req.query.code : '';
  if (!rawCode && req.url) {
    const match = req.url.match(/\/b\/([^/?#]+)/i);
    if (match && match[1]) {
      rawCode = match[1];
    }
  }

  const code = decodeURIComponent(rawCode || '').trim();

  function safeRedirect(url, status = 302) {
    if (typeof res.redirect === 'function') {
      try {
        return res.redirect(status, url);
      } catch(e) {}
    }
    res.writeHead(status, { Location: url });
    return res.end();
  }

  // Si no se proporcionó código, redirigir al blog
  if (!code) {
    return safeRedirect('https://www.thenewindiewave.online/blog');
  }

  let article = null;
  const cleanCode = code.toLowerCase();

  try {
    // 1. Búsqueda por slug exacto
    const slugRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?slug=eq.${encodeURIComponent(cleanCode)}&select=id,slug,title,summary,image_url,category`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (slugRes.ok) {
      const slugData = await slugRes.json();
      if (slugData && slugData.length > 0) {
        article = slugData[0];
      }
    }

    // 2. Si no se encontró por slug, buscar en los últimos artículos por prefijo de ID o sufijo de slug
    if (!article) {
      const listRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?order=published_at.desc&limit=100&select=id,slug,title,summary,image_url,category`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        article = (listData || []).find(a => {
          const id = (a.id || '').toLowerCase();
          const slug = (a.slug || '').toLowerCase();
          return id.startsWith(cleanCode) || 
                 id === cleanCode || 
                 slug === cleanCode || 
                 slug.endsWith(`-${cleanCode}`) || 
                 slug.includes(cleanCode);
        });
      }
    }

    // 3. Fallback de búsqueda directa por ID UUID si tiene formato completo
    if (!article && cleanCode.length >= 8) {
      const idRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?id=like.${encodeURIComponent(cleanCode)}*&select=id,slug,title,summary,image_url,category`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (idRes.ok) {
        const idData = await idRes.json();
        if (idData && idData.length > 0) {
          article = idData[0];
        }
      }
    }
  } catch (err) {
    console.error('[ShortURL /b/ Error]:', err);
  }

  // Si no se encuentra ningún artículo directamente, enviar a /blog#code para que el cliente lo resuelva
  if (!article || !article.slug) {
    return safeRedirect(`https://www.thenewindiewave.online/blog#${encodeURIComponent(code)}`);
  }

  const targetUrl = `https://www.thenewindiewave.online/blog#${article.slug}`;

  // Detectar si el usuario o bot de redes sociales solicita la página
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|instagram|pinterest|discordbot|slackbot|applebot/i.test(userAgent);

  if (isBot) {
    // Retornar HTML con etiquetas OpenGraph ricas y redirección
    const title = escapeHtml(article.title || 'Noticia en The New Indie Wave');
    const desc = escapeHtml(article.summary || 'Descubre los nuevos lanzamientos y cultura independiente en The New Indie Wave.');
    const img = article.image_url || 'https://www.thenewindiewave.online/historia_back.jpg';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${img}">
  <meta property="og:url" content="${targetUrl}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${img}">
  <meta http-equiv="refresh" content="0;url=${targetUrl}">
</head>
<body style="background:#09090b; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
  <p>Redirigiendo a <a href="${targetUrl}" style="color:#bbf451;">${title}</a>...</p>
  <script>window.location.replace("${targetUrl}");</script>
</body>
</html>`;

    if (typeof res.status === 'function' && typeof res.send === 'function') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // Para usuarios normales en navegador: Redirección inmediata 302 hacia /blog#slug
  return safeRedirect(targetUrl);
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
