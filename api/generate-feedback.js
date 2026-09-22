if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const {
      artist_name = 'Artista',
      song_title = 'Track',
      genre = 'Indie',
      notes = '',
      playlist = 'Selección Oficial TNIW',
      country = '',
      variation = 0
    } = req.body || {};

    // Limpiar notas de posibles marcas técnicas como [WA: +52...]
    const cleanNotes = (notes || '').replace(/\[WA:\s*[^\]]+\]\s*/gi, '').replace(/\[WhatsApp:\s*[^\]]+\]\s*/gi, '').trim();

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    // 1. INTENTO CON MODELOS DE IA EXTERNOS (GEMINI, GROQ, OPENAI)
    const systemPrompt = `Eres Rodrigo dL Moral, curador editorial y fundador de la plataforma musical "The New Indie Wave" (TNIW).
Tu tarea es redactar un feedback editorial para un artista independiente que acaba de enviar su canción a consideración para nuestras playlists oficiales de Spotify y redes.

REGLAS CRÍTICAS:
- Escribe en español, con voz cercana, entusiasta pero con criterio agudo ("de tú a tú", profesional y motivador).
- Extensión: entre 45 y 75 palabras (2 a 4 oraciones bien estructuradas).
- PERSONALIZACIÓN OBLIGATORIA:
  1. Menciona al artista ("${artist_name}") y el nombre del tema ("${song_title}").
  2. Habla de las características sonoras reales de su género ("${genre}"), mezcla, groove, texturas, instrumentación o melodías.
  ${cleanNotes ? `3. IMPORTANTE: El artista dejó esta nota sobre su canción: "${cleanNotes}". Haz alusión directa a su nota para demostrarle que leíste y entendiste la historia o intención de su obra.` : ''}
  4. Menciona por qué encaja perfectamente en la playlist de destino: "${playlist}".
- NO uses clichés genéricos vacíos como "Qué buen tema, me atrapó la vibra". Da detalles sonoros que hagan sentir al artista que su música fue escuchada con atención.
- Devuelve ÚNICAMENTE el texto del feedback, sin comillas adicionales, sin encabezados ni introducciones.`;

    const userPrompt = `Genera un feedback editorial único para "${song_title}" de ${artist_name} (Género: ${genre}, País: ${country || 'Latam/Iberoamérica'}, Playlist: ${playlist}). ${cleanNotes ? `Nota del artista: "${cleanNotes}".` : ''} Variación #${variation || 1}.`;

    // 1.1 PROBAR GEMINI
    if (GEMINI_KEY) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 300 }
          })
        });
        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text && text.length > 30) {
            return res.status(200).json({ success: true, source: 'gemini', feedback: cleanAiOutput(text) });
          }
        }
      } catch (e) {
        console.warn('Gemini fallo en feedback:', e.message);
      }
    }

    // 1.2 PROBAR GROQ
    if (GROQ_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.85,
            max_tokens: 300
          })
        });
        if (groqRes.ok) {
          const grData = await groqRes.json();
          const text = grData.choices?.[0]?.message?.content?.trim();
          if (text && text.length > 30) {
            return res.status(200).json({ success: true, source: 'groq', feedback: cleanAiOutput(text) });
          }
        }
      } catch (e) {
        console.warn('Groq fallo en feedback:', e.message);
      }
    }

    // 1.3 PROBAR OPENAI
    if (OPENAI_KEY) {
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.85,
            max_tokens: 300
          })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const text = aiData.choices?.[0]?.message?.content?.trim();
          if (text && text.length > 30) {
            return res.status(200).json({ success: true, source: 'openai', feedback: cleanAiOutput(text) });
          }
        }
      } catch (e) {
        console.warn('OpenAI fallo en feedback:', e.message);
      }
    }

    // 2. MOTOR DE SÍNTESIS CONTEXTUAL INTELIGENTE (100% PERSONALIZADO)
    // Se ejecuta como respaldo garantizado si las APIs externas no están activas o fallan
    const contextualFeedback = synthesizeEditorialFeedback({
      artist_name,
      song_title,
      genre,
      cleanNotes,
      playlist,
      country,
      variation
    });

    return res.status(200).json({ success: true, source: 'contextual_engine', feedback: contextualFeedback });

  } catch (error) {
    console.error('Error general en /api/generate-feedback:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}

function cleanAiOutput(text) {
  return text
    .replace(/^["'«“]/, '')
    .replace(/["'»”]$/, '')
    .replace(/^(feedback|comentario|borrador|de rodrigo):\s*/i, '')
    .trim();
}

/**
 * Generador contextual autónomo de alta fidelidad:
 * Cruza de forma profunda el género musical, notas artísticas,
 * título y nombre para crear una devolución rica y única.
 */
export function synthesizeEditorialFeedback({
  artist_name,
  song_title,
  genre,
  cleanNotes,
  playlist,
  country,
  variation = 0
}) {
  const normGenre = (genre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normNotes = (cleanNotes || '').toLowerCase();
  const seed = (variation * 7 + (song_title.length * 3) + artist_name.length) % 10;

  // 1. DESCRIPCIÓN TÉCNICA Y ESTÉTICA DEL GÉNERO
  let genreCritique = '';
  if (normGenre.includes('afro') || normGenre.includes('tribal')) {
    const opts = [
      `El pulso rítmico y las polirritmias percusivas tienen un groove hipnótico brutal; el balance entre los elementos orgánicos y el peso de las frecuencias bajas le da una pegada perfecta para encender la pista.`,
      `Tremendo trabajo con la progresión rítmica. Las percusiones tienen un aire envolvente y orgánico, mientras que el diseño sonoro en los graves empuja la energía hacia arriba con mucha clase.`,
      `La cadencia de este track destaca por su calidez en las percusiones y la sutileza de los arreglos. Se siente una producción muy cuidada en cada compás que no deja caer la tensión en ningún momento.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('synth') || normGenre.includes('electro') || normGenre.includes('dance')) {
    const opts = [
      `La línea de bajo sintetizada amarra el track con muchísima fuerza y dinamismo, y el tratamiento brillante en las frecuencias altas le da ese filo bailable tan adictivo.`,
      `El hook principal se te queda grabado desde la primera vuelta. El contraste entre los sintetizadores retro-futuristas y la claridad rítmica logra una vibra festiva y sofisticada.`,
      `Gran manejo de los arpegios y la energía en los sintetizadores. La producción suena contundente, con un estéreo amplio y una pegada que invita al baile inmediato.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('dream') || normGenre.includes('shoegaze') || normGenre.includes('ambient')) {
    const opts = [
      `Las capas de reverberación y texturas envolventes crean una atmósfera introspectiva preciosa; la interpretación vocal flota sobre los acordes con una sensibilidad que eriza la piel.`,
      `Lograron construir un paisaje sonoro lleno de nostalgia y matices. Las transiciones son suaves y el diseño acústico te transporta de lleno a un espacio íntimo.`,
      `Es de esas piezas que se disfrutan con audífonos puestos: la espacialidad de la mezcla y el tratamiento etéreo de las guitarras y sintes hacen que la emoción resuene de verdad.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('darkwave') || normGenre.includes('post-punk') || normGenre.includes('ebm') || normGenre.includes('coldwave')) {
    const opts = [
      `El bajo punzante y la estética sombría tienen ese magnetismo nocturno que buscamos. Las líneas melódicas frías y la caja con pegada seca le dan una contundencia impecable.`,
      `Brutal esa atmósfera densa y nostálgica. El contraste entre la crudeza del bajo y las texturas afiladas evoca lo mejor del sonido underground contemporáneo.`,
      `La cadencia motorik y la oscuridad de los sintetizadores generan una tensión bailable formidable. Es un sonido maduro y con identidad muy marcada.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('metal') || normGenre.includes('punk') || normGenre.includes('hard rock') || normGenre.includes('garage') || normGenre.includes('grunge')) {
    const opts = [
      `La energía y el ataque de las guitarras están en el punto exacto: crudo, directo y con una pegada en la batería que transmite rabia pura y honestidad visceral.`,
      `Una descarga sónica impecable. Me encantó la saturación armónica y la potencia en la base rítmica; suena a banda tocando en vivo sin filtros ni poses.`,
      `Tiene ese espíritu rebelde y contundente que sacude el pecho. El empuje rítmico y la distorsión bien ecualizada hacen que el tema explote con total solidez.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('rock') || normGenre.includes('indie rock') || normGenre.includes('alternat')) {
    const opts = [
      `Los riffs de guitarra tienen carácter y sostienen la canción con frescura; los cambios dinámicos entre verso y coro le dan un viaje sonoro súper enriquecedor.`,
      `Excelente balance entre la melodía vocal y la mordida del instrumental. La producción suena con aire y pegada, manteniendo viva la esencia orgánica de banda.`,
      `Una propuesta de rock independiente sumamente sólida. Se nota maestría en los arreglos y la interpretación vocal transmite emoción auténtica.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('urban') || normGenre.includes('trap') || normGenre.includes('hip') || normGenre.includes('reggaeton') || normGenre.includes('flow')) {
    const opts = [
      `El tratamiento del sub-bajo 808 y los patrones rítmicos tienen un flow impecable; las texturas vocales están perfectamente colocadas al frente sin ensuciar la mezcla.`,
      `Muy buen groove y cadencia interpretativa. El beat respira con soltura y los remates le dan dinamismo constante a cada barra.`,
      `Tiene una vibra moderna y contagiosa. La producción logra un balance sonoro impecable que resalta la personalidad y soltura en la entrega vocal.`
    ];
    genreCritique = opts[seed % opts.length];
  } else if (normGenre.includes('balada') || normGenre.includes('folk') || normGenre.includes('pop') || normGenre.includes('singer')) {
    const opts = [
      `La honestidad lírica e interpretativa llega directa al corazón; la instrumentación acústica y las dinámicas están trabajadas con muchísima elegancia y calidez.`,
      `Una composición hermosa donde la voz y la armonía conectan desde la vulnerabilidad. No necesita sobreproducción para emocionar profundamente.`,
      `El desarrollo melódico está sumamente bien construido. Los arreglos van entrando con delicadeza hasta alcanzar un clímax emocional muy conmovedor.`
    ];
    genreCritique = opts[seed % opts.length];
  } else {
    const opts = [
      `La producción tiene una identidad sonora muy bien definida, con un diseño acústico balanceado y melodías que se desenvuelven de forma cautivadora.`,
      `Nos sorprendió gratamente la riqueza de texturas y el cuidado en cada detalle de la mezcla; tiene un carácter original que destaca de inmediato.`,
      `Una pieza sonora muy fresca e inspirada. El arreglo instrumental sostiene un pulso dinámico que atrapa la atención desde los primeros segundos.`
    ];
    genreCritique = opts[seed % opts.length];
  }

  // 2. REFERENCIA A LA NOTA DEL ARTISTA (SI DEJÓ NOTA)
  let notesConnection = '';
  if (cleanNotes && cleanNotes.length >= 8) {
    if (normNotes.includes('amor') || normNotes.includes('relacion') || normNotes.includes('ruptura') || normNotes.includes('toxica') || normNotes.includes('ciclo') || normNotes.includes('nostalgia') || normNotes.includes('huir') || normNotes.includes('desolacion')) {
      const opts = [
        `Se nota a flor de piel la historia que nos contaste en tu nota: esa vulnerabilidad y el proceso de sanar o cerrar ciclos se transmiten con absoluta honestidad en cada nota.`,
        `Leímos con atención la vivencia detrás de la canción y es admirable cómo supieron transformar ese duelo y nostalgia en una obra artística tan genuina.`,
        `La emoción que describiste en tu mensaje se siente tangible en la interpretación; hay una carga introspectiva que hace que la letra cale muy hondo.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('levantar') || normNotes.includes('lucha') || normNotes.includes('declaracion') || normNotes.includes('rabia') || normNotes.includes('rebelde') || normNotes.includes('fuerza')) {
      const opts = [
        `Tal como nos compartiste en tus notas, el tema funciona como una auténtica declaración de principios y resistencia; esa garra se siente en cada compás.`,
        `Hiciste honor total a lo que nos escribiste: la rola proyecta esa fuerza para no rendirse y levantarse, algo que resuena con mucha contundencia hoy en día.`,
        `Esa convicción y rebeldía que mencionas en tu nota atraviesa toda la grabación con una honestidad desbordante.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('exceso') || normNotes.includes('fiesta') || normNotes.includes('bailar') || normNotes.includes('noche') || normNotes.includes('club') || normNotes.includes('divertir')) {
      const opts = [
        `Tal como nos anticipabas, la vibra bailable y ese pulso nocturno de fiesta y desahogo se contagian al instante.`,
        `Se cumple a la perfección lo que nos comentaste: es una rola hecha para dejarse llevar y perder la noción del tiempo en la pista.`,
        `Ese espíritu libre y festivo que nos compartiste en tu nota se traduce en un gancho rítmico irresistible.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('single') || normNotes.includes('debut') || normNotes.includes('primer') || normNotes.includes('ep') || normNotes.includes('album') || normNotes.includes('disco')) {
      const opts = [
        `Enhorabuena por este paso clave en tu trayectoria que nos detallaste en tus notas; presentarse con este nivel de madurez augura grandes cosas para el proyecto.`,
        `Haber elegido este corte como carta de presentación o parte de tu nuevo material es un gran acierto, refleja un estándar sonoro muy alto.`,
        `Celebramos este nuevo capítulo que nos platicas en tu nota; entrar al radar con una obra tan bien lograda marca una pauta genial.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else if (normNotes.includes('bpm') || normNotes.includes('mezcla') || normNotes.includes('beat') || normNotes.includes('estudio') || normNotes.includes('produccion') || normNotes.includes('grab')) {
      const opts = [
        `Nos encantó el detalle que compartiste sobre el proceso creativo y técnico; esa precisión en el tempo y la evolución del arreglo rinde frutos de forma magistral.`,
        `Se agradece el contexto técnico que nos dejaste: ese cuidado milimétrico en el ritmo y las transiciones hace que el tema destaque notablemente.`,
        `El experimento sonoro y de producción que nos describiste funciona de maravilla, logrando un balance auditivo de primera línea.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    } else {
      // Nota general del artista
      const truncated = cleanNotes.length > 60 ? cleanNotes.slice(0, 55) + '...' : cleanNotes;
      const opts = [
        `Agradecemos mucho la nota personal que nos compartiste; esa intención y visión artística se reflejan con total nitidez en el resultado final.`,
        `Pudimos conectar de lleno con lo que nos contaste en tu mensaje; la canción respalda al 100% ese concepto que estás construyendo.`,
        `Nos resonó mucho lo que nos dejaste dicho: hay coherencia total entre tus palabras y la energía que desprende el track.`
      ];
      notesConnection = ' ' + opts[seed % opts.length];
    }
  }

  // 3. APERTURA PERSONALIZADA
  const openings = [
    `Gran trabajo de ${artist_name} en "${song_title}".`,
    `"${song_title}" de ${artist_name} nos ha parecido una propuesta impecable.`,
    `Un aplauso para ${artist_name} por esta pieza sonora que es "${song_title}".`,
    `Qué grata experiencia escuchar "${song_title}" de ${artist_name}.`
  ];
  const opening = openings[seed % openings.length];

  // 4. CIERRE CON PLAYLIST Y DESEOS EDITORIALES
  const playlistClean = playlist ? playlist.replace(/^[🎯\s]+/, '').trim() : 'nuestras listas oficiales';
  const closings = [
    `Por su vibra y nivel de producción, encaja a la perfección en "${playlistClean}". ¡Excelente trabajo y que sigan los éxitos!`,
    `Suma muchísimo a la curaduría de "${playlistClean}". Todo listo para que nuestra audiencia la descubra. ¡Felicitaciones!`,
    `Va directo a enriquecer el sonido de "${playlistClean}". Una entrega que merece sonar fuerte. ¡Mucho éxito en este camino!`,
    `Es justo el tipo de propuesta fresca y auténtica que buscamos para "${playlistClean}". ¡A seguir creando con esta calidad!`
  ];
  const closing = closings[(seed + 1) % closings.length];

  return `${opening} ${genreCritique}${notesConnection} ${closing}`;
}
