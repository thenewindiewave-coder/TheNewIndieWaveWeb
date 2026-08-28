// Serverless Function: /api/spotify-login
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';

export default async function handler(req, res) {
  const host = req.headers.host || 'thenewindiewave.online';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/spotify-callback`;

  const scopes = [
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'user-read-email'
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&show_dialog=true`;

  return res.redirect(authUrl);
}
