const crypto = require('crypto');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

function formatSecondsToMMSS(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (remS < 10 ? '0' : '') + remS;
}

async function getOrInstallYtDlp() {
  try {
    await new Promise((resolve, reject) => {
      execFile('yt-dlp', ['--version'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return 'yt-dlp';
  } catch (e) {}

  if (process.platform === 'linux') {
    const tmpBinary = path.join(os.tmpdir(), 'yt-dlp');
    if (fs.existsSync(tmpBinary)) {
      return tmpBinary;
    }
    console.log('[upload] Downloading yt-dlp binary to /tmp...');
    const binRes = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp');
    if (!binRes.ok) throw new Error('Failed to download yt-dlp binary: ' + binRes.statusText);
    const binBuffer = Buffer.from(await binRes.arrayBuffer());
    fs.writeFileSync(tmpBinary, binBuffer, { mode: 0o755 });
    return tmpBinary;
  }

  throw new Error('yt-dlp no encontrado en el sistema');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // MODO PROXY GET: Para servir imágenes externas con CORS headers para Canvas
  if (req.method === 'GET') {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'No url provided' });
    }
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch image: ' + response.statusText });
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(buffer);
    } catch (err) {
      return res.status(500).json({ error: 'Proxy error: ' + err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // MODO EXTRACCIÓN LOOP DE YOUTUBE -> CLOUDINARY
  const isYoutubeLoop = req.query.action === 'youtube-loop' || 
    (req.body && (req.body.action === 'youtube-loop' || (req.body.url && (req.body.url.includes('youtube.com') || req.body.url.includes('youtu.be')))));

  if (isYoutubeLoop) {
    const { url, start = 0, duration = 30 } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL de YouTube requerida' });
    }

    const startSec = Math.max(0, parseInt(start, 10) || 0);
    const durSec = Math.min(60, Math.max(5, parseInt(duration, 10) || 30));
    const endSec = startSec + durSec;

    const section = '*' + formatSecondsToMMSS(startSec) + '-' + formatSecondsToMMSS(endSec);
    const tempFile = path.join(os.tmpdir(), `yt_loop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`);

    console.log(`[upload youtube-loop] URL: ${url}, Section: ${section}`);

    try {
      const ytDlpCmd = await getOrInstallYtDlp();

      const args = [
        '--no-check-certificates',
        '--download-sections', section,
        '--force-keyframes-at-cuts',
        '-f', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/best[height<=720]/best',
        '--merge-output-format', 'mp4',
        '-o', tempFile,
        url.trim()
      ];

      await new Promise((resolve, reject) => {
        execFile(ytDlpCmd, args, { timeout: 45000 }, (err, stdout, stderr) => {
          if (err) {
            return reject(new Error(stderr || err.message));
          }
          resolve();
        });
      });

      if (!fs.existsSync(tempFile)) {
        throw new Error('El archivo recortado no se generó correctamente');
      }

      const fileStat = fs.statSync(tempFile);
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'ckknw1do';
      const apiKey = process.env.CLOUDINARY_API_KEY || '254625267987334';
      const apiSecret = process.env.CLOUDINARY_API_SECRET || 'cm4UMlpil-ixQAovLrfUUkWm-vo';

      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto.createHash('sha1').update('timestamp=' + timestamp + apiSecret).digest('hex');

      const fileBuffer = fs.readFileSync(tempFile);
      try { fs.unlinkSync(tempFile); } catch (e) {}

      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'video/mp4' }), `loop_${startSec}_${durSec}.mp4`);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);

      const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
        method: 'POST',
        body: formData
      });

      const cData = await cRes.json();
      if (!cRes.ok || !cData.secure_url) {
        throw new Error(cData.error?.message || 'Error al subir el video a Cloudinary');
      }

      return res.status(200).json({
        success: true,
        url: cData.secure_url,
        start: startSec,
        duration: durSec,
        bytes: fileStat.size
      });
    } catch (err) {
      console.error('[upload youtube-loop Error]:', err);
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
      return res.status(500).json({ error: err.message || 'Error procesando el video de YouTube' });
    }
  }

  // MODO SUBIDA NORMAL CLOUDINARY
  const { fileData, resourceType = 'auto', apiKey: bodyApiKey } = req.body || {};
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'ckknw1do';
  const envApiKey = process.env.CLOUDINARY_API_KEY || '254625267987334';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'cm4UMlpil-ixQAovLrfUUkWm-vo';
  const effectiveApiKey = bodyApiKey || envApiKey;

  if (!cloudName || !effectiveApiKey || !apiSecret) {
    return res.status(500).json({ error: 'Faltan variables de entorno de Cloudinary' });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const payload = {
      file: fileData,
      timestamp: timestamp
    };

    if (effectiveApiKey && apiSecret) {
      const signatureStr = `timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');
      payload.api_key = effectiveApiKey;
      payload.signature = signature;
    } else {
      payload.upload_preset = 'ml_default';
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.secure_url) {
      return res.status(200).json({
        success: true,
        url: result.secure_url,
        format: result.format,
        resource_type: result.resource_type
      });
    } else {
      return res.status(400).json({ error: result.error && result.error.message ? result.error.message : 'Error al subir a Cloudinary' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
