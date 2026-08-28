// Serverless Function: /api/spotify-callback
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmnzbdnffdxxveyifmc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbW56YmRuZmZkeHh2ZXlpZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTg4MjQsImV4cCI6MjEwMzQzNDgyNH0.XYaUC4WDCMps78mt7nMBO_R5rmULYkWfejF_Jiltjsk';

export default async function handler(req, res) {
  const { code, error } = req.query || {};

  if (error || !code) {
    return res.send(`
      <html>
        <body style="background:#09090b; color:#ef4444; font-family:sans-serif; text-align:center; padding:50px;">
          <h2>❌ Error en la vinculación con Spotify</h2>
          <p>${error || 'No se recibió código de autorización.'}</p>
          <a href="/curador.html" style="color:#bbf451;">← Volver al Panel de Curador</a>
        </body>
      </html>
    `);
  }

  const isLocal = (req.headers.host || '').includes('localhost');
  const redirectUri = isLocal ? 'http://localhost:3000/api/spotify-callback' : 'https://thenewindiewave.online/api/spotify-callback';

  try {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      throw new Error('Error al intercambiar código de Spotify: ' + errTxt);
    }

    const tokenData = await tokenRes.json();
    const refreshToken = tokenData.refresh_token;
    const accessToken = tokenData.access_token;

    // Obtener información del usuario conectado en Spotify
    let userProfile = { id: 'Desconocido', display_name: 'Curador', email: '' };
    try {
      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (meRes.ok) {
        userProfile = await meRes.json();
      }
    } catch(meErr) {}

    // Guardar refresh_token en Supabase para persistencia
    if (refreshToken) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/radar_artists`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: 'spotify_auth_config',
            name: userProfile.display_name || 'Spotify Curator Auth',
            city: userProfile.id || null,
            genre: 'CONFIG',
            type: 'config',
            short_bio: refreshToken
          })
        });
      } catch(dbErr) {
        console.error('Error saving token to Supabase:', dbErr);
      }
    }

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Conectado</title>
          <style>
            body { background: #09090b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
            .card { background: #141417; border: 1px solid #27272a; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            h2 { color: #bbf451; font-size: 24px; margin-bottom: 12px; }
            p { color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
            .account-badge { background: rgba(187,244,81,0.1); border: 1px solid rgba(187,244,81,0.3); padding: 10px 16px; border-radius: 6px; color: #bbf451; font-family: monospace; font-size: 13px; margin-bottom: 24px; display: inline-block; }
            .btn { background: #bbf451; color: #000; font-weight: bold; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🎉 ¡Spotify Conectado con Éxito!</h2>
            <div class="account-badge">
              👤 Cuenta: <strong>${userProfile.display_name}</strong> (ID: ${userProfile.id})<br>
              ✉️ ${userProfile.email || 'Email verificado'}
            </div>
            <p>Tu cuenta ha quedado autorizada con permisos de modificación de playlist en la nube y en tu navegador.</p>
            <a href="/curador.html" class="btn">Volver al Panel de Curaduría ↗</a>
          </div>
          <script>
            if ('${refreshToken}') {
              localStorage.setItem('tniw_curator_spotify_refresh', '${refreshToken}');
            }
            setTimeout(function() {
              window.location.href = '/curador.html';
            }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch(e) {
    return res.status(500).send(`
      <html>
        <body style="background:#09090b; color:#ef4444; font-family:sans-serif; text-align:center; padding:50px;">
          <h2>❌ Error al conectar con Spotify</h2>
          <p>${e.message}</p>
          <a href="/curador.html" style="color:#bbf451;">← Volver al Panel de Curador</a>
        </body>
      </html>
    `);
  }
}
