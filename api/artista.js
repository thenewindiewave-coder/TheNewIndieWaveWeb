const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

module.exports = async (req, res) => {
  const { id, artista } = req.query || {};
  const targetId = id || artista || 'radar-1';

  let artist = null;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/radar_artists?id=eq.${encodeURIComponent(targetId)}&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        artist = data[0];
      }
    }
  } catch (err) {
    console.error('Error fetching artist:', err);
  }

  const name = artist ? artist.name : 'Artista en el Radar';
  const bio = artist ? (artist.short_bio || 'Descubre los nuevos proyectos musicales en The New Indie Wave.') : 'Descubre los proyectos musicales independientes y talentos emergentes en The New Indie Wave.';
  const genre = artist ? artist.genre : 'Indie Wave';
  let imgUrl = 'https://thenewindiewave.online/logo.png';

  if (artist && artist.media_url) {
    const rawUrl = artist.media_url.trim();
    if (rawUrl.endsWith('.mp4')) {
      if (rawUrl.includes('res.cloudinary.com') && rawUrl.includes('/video/upload/')) {
        // Generar miniatura automática 1200x630 desde el video de Cloudinary
        let thumb = rawUrl.replace('/video/upload/', '/video/upload/so_auto,w_1200,h_630,c_fill,q_auto,f_jpg/');
        if (thumb.endsWith('.mp4')) {
          thumb = thumb.slice(0, -4) + '.jpg';
        }
        imgUrl = thumb;
      } else if (artist.poster_url) {
        imgUrl = artist.poster_url.trim();
      }
    } else {
      imgUrl = rawUrl;
    }
  }
  const redirectUrl = `https://thenewindiewave.online/artistas.html?artista=${encodeURIComponent(targetId)}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${name} — The New Indie Wave</title>
<meta name="description" content="${bio}">

<!-- Open Graph / WhatsApp / Facebook -->
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="The New Indie Wave">
<meta property="og:title" content="${name}">
<meta property="og:description" content="${bio}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:image:secure_url" content="${imgUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${redirectUrl}">

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@the.new.indie.wave">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${bio}">
<meta name="twitter:image" content="${imgUrl}">

<meta http-equiv="refresh" content="0;url=${redirectUrl}">
<script>
  window.location.replace('${redirectUrl}');
</script>
</head>
<body style="background:#09090b; color:#fff; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
  <p style="opacity:0.8;">Cargando perfil de ${name}... <a href="${redirectUrl}" style="color:#bbf451;">Haz clic aquí si no redirige</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
};
