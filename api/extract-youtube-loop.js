const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

function formatSecondsToMMSS(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (remS < 10 ? '0' : '') + remS;
}

async function getOrInstallYtDlp() {
  // 1. Try system yt-dlp
  try {
    await new Promise((resolve, reject) => {
      execFile('yt-dlp', ['--version'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return 'yt-dlp';
  } catch (e) {}

  // 2. If on Linux/Vercel, check /tmp/yt-dlp
  if (process.platform === 'linux') {
    const tmpBinary = path.join(os.tmpdir(), 'yt-dlp');
    if (fs.existsSync(tmpBinary)) {
      return tmpBinary;
    }
    // Download standalone binary to /tmp
    console.log('[extract-youtube-loop] Downloading standalone yt-dlp binary to /tmp...');
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, start = 0, duration = 30 } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL de YouTube requerida' });
  }

  const startSec = Math.max(0, parseInt(start, 10) || 0);
  const durSec = Math.min(60, Math.max(5, parseInt(duration, 10) || 30));
  const endSec = startSec + durSec;

  const section = '*' + formatSecondsToMMSS(startSec) + '-' + formatSecondsToMMSS(endSec);
  const tempFile = path.join(os.tmpdir(), `yt_loop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`);

  console.log(`[extract-youtube-loop] URL: ${url}, Section: ${section}`);

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
    console.log(`[extract-youtube-loop] Clip extraído. Tamaño: ${(fileStat.size / (1024 * 1024)).toFixed(2)} MB`);

    // Subir a Cloudinary
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

    console.log(`[extract-youtube-loop] Subido a Cloudinary con éxito: ${cData.secure_url}`);

    return res.status(200).json({
      success: true,
      url: cData.secure_url,
      start: startSec,
      duration: durSec,
      bytes: fileStat.size
    });

  } catch (err) {
    console.error('[extract-youtube-loop Error]:', err);
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
    return res.status(500).json({ error: err.message || 'Error procesando el video de YouTube' });
  }
};
