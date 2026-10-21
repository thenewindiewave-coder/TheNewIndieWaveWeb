// Serverless Function para Vercel: /api/send-acceptance-email
// Envía un correo automático de felicitación al artista cuando su track es aceptado en una playlist.
// Incluye el mensaje personalizado, las imágenes generadas (Story vertical + Post cuadrado)
// tanto alojadas en Cloudinary como adjuntas al correo, además de los enlaces a Spotify y comunidad.

import crypto from 'crypto';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const {
      artist_name = 'Artista',
      artist_email,
      song_title = 'Canción',
      playlist = 'Playlist Oficial',
      playlist_url = 'https://open.spotify.com/user/thenewindiewave',
      spotify_url = '',
      message = '',
      post_image = null,
      story_image = null
    } = req.body || {};

    if (!artist_email || !artist_email.trim() || !artist_email.includes('@')) {
      return res.status(400).json({ error: 'El correo electrónico del artista es obligatorio y debe ser válido.' });
    }

    const cleanArtist = String(artist_name).trim();
    const cleanSong = String(song_title).trim();
    const cleanPlaylist = String(playlist).trim();
    const cleanEmail = String(artist_email).trim();
    const cleanPlaylistUrl = String(playlist_url).trim();

    // 1. Subir imágenes a Cloudinary si son Data URLs base64 para que carguen en el HTML del correo
    let postImageUrl = null;
    let storyImageUrl = null;

    if (post_image) {
      if (typeof post_image === 'string' && post_image.startsWith('http')) {
        postImageUrl = post_image;
      } else {
        postImageUrl = await uploadImageToCloudinary(post_image);
      }
    }

    if (story_image) {
      if (typeof story_image === 'string' && story_image.startsWith('http')) {
        storyImageUrl = story_image;
      } else {
        storyImageUrl = await uploadImageToCloudinary(story_image);
      }
    }

    // 2. Extraer buffers base64 para adjuntos descargables
    const attachments = [];
    const base64Attachments = [];

    const sanitizeFilename = (str) =>
      str.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 30);

    if (post_image && typeof post_image === 'string') {
      const base64Post = post_image.includes('base64,') ? post_image.split('base64,')[1] : (post_image.startsWith('data:') ? '' : post_image);
      if (base64Post) {
        const filename = `${sanitizeFilename(cleanArtist)}_${sanitizeFilename(cleanSong)}_post_1080x1080.jpg`;
        attachments.push({
          filename,
          content: Buffer.from(base64Post, 'base64'),
          contentType: 'image/jpeg'
        });
        base64Attachments.push({
          name: filename,
          filename,
          content: base64Post,
          type: 'image/jpeg',
          disposition: 'attachment'
        });
      }
    }

    if (story_image && typeof story_image === 'string') {
      const base64Story = story_image.includes('base64,') ? story_image.split('base64,')[1] : (story_image.startsWith('data:') ? '' : story_image);
      if (base64Story) {
        const filename = `${sanitizeFilename(cleanArtist)}_${sanitizeFilename(cleanSong)}_story_1080x1920.jpg`;
        attachments.push({
          filename,
          content: Buffer.from(base64Story, 'base64'),
          contentType: 'image/jpeg'
        });
        base64Attachments.push({
          name: filename,
          filename,
          content: base64Story,
          type: 'image/jpeg',
          disposition: 'attachment'
        });
      }
    }

    // 3. Formatear el mensaje de felicitación para HTML
    const finalMessage = message && message.trim()
      ? message.trim()
      : `¡Felicidades ${cleanArtist}! 🎉 Nos encantó escuchar '${cleanSong}' y estamos muy felices de anunciarte que ha sido oficialmente seleccionada para ser parte de nuestra comunidad en The New Indie Wave. Ya puedes encontrarla en nuestra playlist '${cleanPlaylist}'.\n\n🎧 Escúchala y guárdala aquí:\n${cleanPlaylistUrl}\n\n👥 Te invitamos especialmente a unirte a la comunidad oficial de artistas de THENIWAVE en WhatsApp:\nhttps://chat.whatsapp.com/JxPkXMuiNCV2waucjn1DFa\n\n📸 Te adjuntamos las gráficas oficiales para tus historias y estados. ¡Ayúdanos a seguir creciendo compartiendo la buena noticia y etiquetándonos en tus redes! ¡Mucho éxito! 🚀`;

    const htmlFormattedMessage = formatMessageForHtml(finalMessage);

    // 4. Armar el Asunto y el HTML del Correo
    const subject = `¡Felicidades ${cleanArtist}! Tu canción "${cleanSong}" ha sido agregada a The New Indie Wave 🎉`;
    const htmlEmail = generateEmailHtml({
      artist_name: cleanArtist,
      song_title: cleanSong,
      playlist: cleanPlaylist,
      playlist_url: cleanPlaylistUrl,
      formatted_message: htmlFormattedMessage,
      post_image_url: postImageUrl,
      story_image_url: storyImageUrl,
      has_attachments: attachments.length > 0
    });

    // 5. Enviar el correo a través del proveedor disponible
    const sendResult = await sendEmailViaConfiguredProvider({
      to: cleanEmail,
      artist_name: cleanArtist,
      subject,
      html: htmlEmail,
      text: finalMessage,
      attachments,
      base64Attachments
    });

    return res.status(200).json({
      success: true,
      message: 'Correo de felicitaciones enviado con éxito al artista.',
      to: cleanEmail,
      provider: sendResult.provider,
      post_image_url: postImageUrl,
      story_image_url: storyImageUrl
    });

  } catch (error) {
    console.error('[send-acceptance-email] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al enviar el correo al artista',
      hint: error.hint || undefined
    });
  }
}

// -------------------------------------------------------------
// HELPER: Subir imagen a Cloudinary
// -------------------------------------------------------------
async function uploadImageToCloudinary(remoteImageUrl) {
  if (!remoteImageUrl || typeof remoteImageUrl !== 'string') return null;
  if (remoteImageUrl.includes('res.cloudinary.com')) return remoteImageUrl;

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'ckknw1do';
    const apiKey = process.env.CLOUDINARY_API_KEY || '254625267987334';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'cm4UMlpil-ixQAovLrfUUkWm-vo';

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = crypto
      .createHash('sha1')
      .update(`timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const body = new URLSearchParams();
    body.append('file', remoteImageUrl);
    body.append('api_key', apiKey);
    body.append('timestamp', timestamp.toString());
    body.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: body
    });

    if (res.ok) {
      const data = await res.json();
      return data.secure_url;
    }
    const errText = await res.text();
    console.warn('[Cloudinary Upload Error]:', errText);
  } catch (err) {
    console.warn('[Cloudinary Upload Exception]:', err.message);
  }
  return null;
}

// -------------------------------------------------------------
// HELPER: Convertir texto plano con asteriscos y saltos a HTML
// -------------------------------------------------------------
function formatMessageForHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #38bdf8; text-decoration: underline; word-break: break-all;">$1</a>')
    .split(/\n\s*\n/)
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

// -------------------------------------------------------------
// HELPER: Generador de plantilla HTML del correo
// -------------------------------------------------------------
function generateEmailHtml({
  artist_name,
  song_title,
  playlist,
  playlist_url,
  formatted_message,
  post_image_url,
  story_image_url,
  has_attachments
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Track Aceptado en The New Indie Wave!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #09090b; width: 100%; margin: 0; padding: 24px 8px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; background-color: #121215; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.85);">
          
          <!-- Barra de acento superior -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #bbf451 0%, #22c55e 50%, #38bdf8 100%);"></td>
          </tr>

          <!-- Cabecera Oficial -->
          <tr>
            <td style="padding: 32px 28px 20px 28px; text-align: center; background: radial-gradient(circle at 50% 0%, rgba(187, 244, 81, 0.08) 0%, transparent 70%);">
              <div style="font-family: 'Courier New', monospace, monospace; font-size: 11px; font-weight: 700; color: #bbf451; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">
                // SELECCIÓN OFICIAL · CURADURÍA SPOTIFY
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                THE NEW INDIE WAVE
              </h1>
              <div style="font-size: 13px; color: #a1a1aa; font-weight: 500;">
                Comunidad &amp; Plataforma de Descubrimiento Musical
              </div>
            </td>
          </tr>

          <!-- Divisor -->
          <tr>
            <td style="padding: 0 28px;"><hr style="border: none; border-top: 1px solid #27272a; margin: 0;" /></td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 28px 28px;">
              
              <!-- Banner de Felicitación Destacado -->
              <div style="background: linear-gradient(135deg, rgba(187, 244, 81, 0.12) 0%, rgba(34, 197, 94, 0.05) 100%); border: 1px solid rgba(187, 244, 81, 0.35); border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
                <div style="font-size: 26px; line-height: 1; margin-bottom: 8px;">🎉 🎧 ⚡</div>
                <div style="font-size: 19px; font-weight: 800; color: #bbf451; margin-bottom: 6px;">
                  ¡Felicidades, ${artist_name}!
                </div>
                <div style="font-size: 14px; color: #e4e4e7; line-height: 1.5;">
                  Tu canción <strong>"${song_title}"</strong> ha superado la curaduría y ya forma parte de nuestra playlist oficial <strong>"${playlist}"</strong>.
                </div>
              </div>

              <!-- Mensaje Personalizado del Curador -->
              <div style="font-size: 14.5px; line-height: 1.7; color: #d4d4d8; margin-bottom: 28px;">
                ${formatted_message}
              </div>

              <!-- Botones de Acción Inmediata -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${playlist_url}" target="_blank" style="display: block; width: 90%; background-color: #1DB954; color: #000000; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 20px; border-radius: 8px; text-align: center; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(29, 185, 84, 0.35);">
                      🎧 ESCUCHAR EN SPOTIFY (${playlist}) ↗
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://chat.whatsapp.com/JxPkXMuiNCV2waucjn1DFa" target="_blank" style="display: block; width: 90%; background-color: #25D366; color: #000000; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 20px; border-radius: 8px; text-align: center; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);">
                      👥 UNIRSE A LA COMUNIDAD EN WHATSAPP ↗
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Sección de Gráficas Promocionales Oficiales -->
              <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 22px; margin-bottom: 24px;">
                <div style="font-family: 'Courier New', monospace, monospace; font-size: 11px; font-weight: 700; color: #bbf451; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">
                  // MATERIAL PROMOCIONAL OFICIAL
                </div>
                <div style="font-size: 17px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">
                  📸 Tus Gráficas de Difusión en Alta Resolución
                </div>
                <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 18px 0;">
                  Hemos preparado para ti las piezas gráficas oficiales para compartir tu logro en redes sociales (Instagram Stories, TikTok, Feed y estados de WhatsApp).
                  ${has_attachments ? '<br /><strong style="color: #bbf451;">📎 Ambas imágenes vienen adjuntas directamente a este correo en máxima calidad.</strong>' : ''}
                </p>

                <!-- Vista previa de las imágenes -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      ${post_image_url ? `
                        <div style="margin-bottom: 20px;">
                          <div style="font-size: 12px; font-weight: 700; color: #e4e4e7; margin-bottom: 8px; font-family: 'Courier New', monospace;">
                            1. POST CUADRADO (Feed / WhatsApp · 1080x1080)
                          </div>
                          <img src="${post_image_url}" alt="Post Cuadrado Oficial" width="320" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #3f3f46; display: block; margin: 0 auto 10px auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5);" />
                          <div>
                            <a href="${post_image_url}" target="_blank" download="post-cuadrado.jpg" style="display: inline-block; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">
                              ⬇️ Descargar Post Cuadrado HD
                            </a>
                          </div>
                        </div>
                      ` : ''}

                      ${story_image_url ? `
                        <div style="margin-top: 10px;">
                          <div style="font-size: 12px; font-weight: 700; color: #e4e4e7; margin-bottom: 8px; font-family: 'Courier New', monospace;">
                            2. STORY VERTICAL (Instagram / TikTok / WA · 1080x1920)
                          </div>
                          <img src="${story_image_url}" alt="Story Vertical Oficial" width="220" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #3f3f46; display: block; margin: 0 auto 10px auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5);" />
                          <div>
                            <a href="${story_image_url}" target="_blank" download="story-vertical.jpg" style="display: inline-block; background: rgba(187, 244, 81, 0.15); color: #bbf451; border: 1px solid rgba(187, 244, 81, 0.4); padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; text-decoration: none;">
                              ⬇️ Descargar Story Vertical HD
                            </a>
                          </div>
                        </div>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Mensaje de Redes Sociales -->
              <div style="text-align: center; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px dashed #27272a; border-radius: 6px;">
                <div style="font-size: 12.5px; color: #a1a1aa; line-height: 1.5;">
                  ¿Vas a compartir la noticia en tus redes? Etiquétanos como <strong style="color: #fff;">@thenewindiewave</strong> para que podamos compartir tu música con toda nuestra comunidad.
                </div>
              </div>

            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #0a0a0c; padding: 24px 28px; border-top: 1px solid #27272a; text-align: center;">
              <div style="font-size: 12px; color: #71717a; margin-bottom: 10px;">
                The New Indie Wave · Curaduría Musical Independiente
              </div>
              <div style="font-size: 12px;">
                <a href="https://thenewindiewave.online" target="_blank" style="color: #a1a1aa; text-decoration: none; margin: 0 10px;">Web Oficial</a>
                <span style="color: #3f3f46;">•</span>
                <a href="https://open.spotify.com/user/thenewindiewave" target="_blank" style="color: #a1a1aa; text-decoration: none; margin: 0 10px;">Spotify</a>
                <span style="color: #3f3f46;">•</span>
                <a href="https://www.instagram.com/thenewindiewave" target="_blank" style="color: #a1a1aa; text-decoration: none; margin: 0 10px;">Instagram</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -------------------------------------------------------------
// HELPER: Enviar a través de SMTP (Gmail u otros), Resend o Brevo
// -------------------------------------------------------------
async function sendEmailViaConfiguredProvider({
  to,
  artist_name,
  subject,
  html,
  text,
  attachments,
  base64Attachments
}) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  const fromEmail = process.env.EMAIL_FROM || (smtpUser ? `"The New Indie Wave" <${smtpUser}>` : 'The New Indie Wave <curador@thenewindiewave.online>');

  // 1. SMTP (Gmail u otros con Nodemailer)
  if (smtpUser && smtpPass) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const secure = port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      text,
      html,
      attachments: attachments && attachments.length ? attachments : undefined
    });

    return { provider: 'smtp', messageId: info.messageId };
  }

  // 2. Resend API
  if (resendKey) {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'The New Indie Wave <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        text,
        attachments: base64Attachments && base64Attachments.length
          ? base64Attachments.map(a => ({ filename: a.filename, content: a.content }))
          : undefined
      })
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(resendData)}`);
    }
    return { provider: 'resend', id: resendData.id };
  }

  // 3. Brevo API
  if (brevoKey) {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'The New Indie Wave', email: process.env.BREVO_FROM_EMAIL || 'info@thenewindiewave.online' },
        to: [{ email: to, name: artist_name }],
        subject,
        htmlContent: html,
        textContent: text,
        attachment: base64Attachments && base64Attachments.length
          ? base64Attachments.map(a => ({ name: a.name, content: a.content }))
          : undefined
      })
    });

    const brevoData = await brevoRes.json();
    if (!brevoRes.ok) {
      throw new Error(`Brevo Error: ${JSON.stringify(brevoData)}`);
    }
    return { provider: 'brevo', messageId: brevoData.messageId };
  }

  // 4. SendGrid API
  if (sendgridKey) {
    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to, name: artist_name }] }],
        from: { email: process.env.SENDGRID_FROM || 'curador@thenewindiewave.online', name: 'The New Indie Wave' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html }
        ],
        attachments: base64Attachments && base64Attachments.length
          ? base64Attachments.map(a => ({
              content: a.content,
              filename: a.filename,
              type: a.type,
              disposition: 'attachment'
            }))
          : undefined
      })
    });

    if (!sgRes.ok) {
      const errText = await sgRes.text();
      throw new Error(`SendGrid Error: ${errText}`);
    }
    return { provider: 'sendgrid' };
  }

  // Si no hay proveedor configurado aún en las variables de entorno
  const error = new Error('No se ha configurado ningún proveedor de correo en .env');
  error.hint = 'Configura SMTP_USER y SMTP_PASS (de Gmail con contraseña de app) o RESEND_API_KEY en tu archivo .env o en el panel de Vercel.';
  throw error;
}
