// Serverless Function: /api/spotify-login
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '7a56561898eb4057941b2c1453476e10';

export default async function handler(req, res) {
  const isLocal = (req.headers.host || '').includes('localhost');
  const redirectUri = isLocal ? 'http://localhost:3000/api/spotify-callback' : 'https://thenewindiewave.online/api/spotify-callback';

  const scopes = [
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'user-read-email'
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&show_dialog=true`;

  return res.redirect(authUrl);
}
