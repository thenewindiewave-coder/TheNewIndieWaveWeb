// Serverless Function: /api/spotify-callback
// Intercambia el código por tokens y guarda el refresh_token
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '86ed4df85d3f4f46885eb51013a0ab0f';

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

  const host = req.headers.host || 'thenewindiewave.online';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/spotify-callback`;

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

    // Retornar script HTML que guarda el token en el panel de curador
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Conectado con Éxito</title>
          <style>
            body { background: #09090b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
            .card { background: #141417; border: 1px solid #27272a; padding: 40px; border-radius: 12px; text-align: center; max-width: 480px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            h2 { color: #bbf451; font-size: 24px; margin-bottom: 12px; }
            p { color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
            .btn { background: #bbf451; color: #000; font-weight: bold; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🎉 ¡Spotify Conectado con Éxito!</h2>
            <p>Tu cuenta de curador de Spotify ha quedado vinculada. Ahora, cada vez que hagas clic en <strong>"Aceptar"</strong>, las canciones se añadirán físicamente a tus playlists oficiales en automático.</p>
            <a href="/curador.html" class="btn">Volver al Panel de Curaduría ↗</a>
          </div>
          <script>
            // Guardar refresh_token en localStorage del curador
            if ('${refreshToken}') {
              localStorage.setItem('tniw_curator_spotify_refresh', '${refreshToken}');
            }
            setTimeout(function() {
              window.location.href = '/curador.html';
            }, 2500);
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
