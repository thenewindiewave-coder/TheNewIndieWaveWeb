const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileData, resourceType = 'auto' } = req.body || {};
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'ckknw1do';
  const apiKey = process.env.CLOUDINARY_API_KEY || '254625267987334';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'cm4UMlpil-ixQAovLrfUUkWm-vo';

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signatureStr = `timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

    const payload = {
      file: fileData,
      timestamp: timestamp,
      api_key: apiKey,
      signature: signature
    };

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
      return res.status(400).json({ error: result.error ? result.error.message : 'Error al subir a Cloudinary' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
