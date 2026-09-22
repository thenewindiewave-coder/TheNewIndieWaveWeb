const crypto = require('crypto');

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

  const { fileData, resourceType = 'auto', apiKey: bodyApiKey } = req.body || {};
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const envApiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
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
