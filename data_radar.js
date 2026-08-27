// Base de datos oficial de ARTISTAS EN EL RADAR - THE NEW INDIE WAVE
var DEFAULT_RADAR_ARTISTS = [
  {
    "id": "radar-1",
    "name": "Lunar Daydream",
    "city": "CIUDAD DE MÉXICO",
    "genre": "DREAM POP / SHOEGAZE",
    "type": "top3",
    "order": 1,
    "badge": "TOP RADAR #1",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&q=80",
    "track_id": "3n3Ppam7vgaVa1iaRUc9Lp",
    "short_bio": "Capas envolventes de reverb, sintetizadores análogos nostálgicos y una melodía hipnótica perfecta para la noche.",
    "full_review": "Originarios del sur de la Ciudad de México, Lunar Daydream mezcla guitarras espaciales cargadas de chorus con cajas de ritmos vintage y melodías etéreas. Su reciente EP ha capturado la atención de la escena independiente latinoamericana, consolidándolos como una de las propuestas más sólidas del dream pop contemporáneo.",
    "career_notes": "Formados en 2023, han compartido escenario con bandas icónicas del shoegaze y cuentan con más de 80,000 escuchas mensuales en Spotify.",
    "events_note": "Showcase TNIW Vol. 04 — Foro Cultural Indie (24 OCT 2026)",
    "spotify_url": "https://open.spotify.com/artist/3n3Ppam7vgaVa1iaRUc9Lp",
    "instagram": "@lunardaydream"
  },
  {
    "id": "radar-2",
    "name": "Distorsión Fría",
    "city": "BUENOS AIRES",
    "genre": "POST-PUNK / DARKWAVE",
    "type": "top3",
    "order": 2,
    "badge": "TOP RADAR #2",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=900&q=80",
    "track_id": "0VjIjW4GlUZAMYd2vXMi3b",
    "short_bio": "Líneas de bajo penetrantes, cajas de ritmo ochenteras y líricas existenciales con una ejecución en vivo demoledora.",
    "full_review": "Desde los sótanos underground de Buenos Aires, este dúo post-punk revitaliza las texturas frías de los sintetizadores analógicos con bajos distorsionados y voces graves cargadas de reverberación. Su sonido visceral y directo conecta con la nueva ola de darkwave en español.",
    "career_notes": "Ganadores del circuito emergente porteño 2025, actualmente grabando su primer larga duración en cinta analógica.",
    "events_note": "Festival TNIW 2026 — Escenario Alterno (05 DIC 2026)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@distorsionfria"
  },
  {
    "id": "radar-3",
    "name": "Cero Tardes",
    "city": "BOGOTÁ",
    "genre": "INDIE POP / FOLK",
    "type": "top3",
    "order": 3,
    "badge": "TOP RADAR #3",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=80",
    "track_id": "7qiZfU4dY1lWllzX7mPBI3",
    "short_bio": "Frescura acústica con arreglos de cuerdas sutiles y ganchos vocales inolvidables para escuchar al atardecer.",
    "full_review": "Con una instrumentación orgánica que combina guitarras acústicas afinadas en abierto, percusiones suaves y armonías vocales a dos voces, Cero Tardes crea paisajes sonoros íntimos que transportan a tardes lluviosas y melancolía luminosa.",
    "career_notes": "Proyecto solista colaborativo fundado en Colombia con presentaciones acústicas en teatros independientes.",
    "events_note": "Secret Rooftop Sessions — Terraza Roma Norte (12 NOV 2026)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@cerotardes"
  },
  {
    "id": "radar-4",
    "name": "Siluetas de Verano",
    "city": "SANTIAGO DE CHILE",
    "genre": "BEDROOM POP / LO-FI",
    "type": "secondary",
    "order": 4,
    "badge": "ESTRENO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=600&q=80",
    "track_id": "4cOdK2wGLETKBW3PvgPWqT",
    "short_bio": "Texturas de cinta de cuatro canales con armonías vocales íntimas y sinceras grabadas en casa.",
    "full_review": "Composiciones caseras nacidas durante noches de insomnio. Melodías de ensueño con guitarras jangle y sintes casio.",
    "career_notes": "Pioneros del sonido bedroom chileno con lanzamientos en cassette de edición limitada.",
    "events_note": "Gira acústica Cono Sur 2026",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@siluetasdeverano"
  },
  {
    "id": "radar-5",
    "name": "Los Extraviados",
    "city": "MADRID / CDMX",
    "genre": "INDIE ROCK / GARAJE",
    "type": "secondary",
    "order": 5,
    "badge": "COLECTIVO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&q=80",
    "track_id": "3jjujdUJ72nuh5eMFTpqQB",
    "short_bio": "Potencia rítmica directa, guitarras crudas y coros enérgicos que conectan con la nueva oleada independiente.",
    "full_review": "Riffs veloces y actitud punk melódica con letras honestas sobre la vida urbana contemporánea.",
    "career_notes": "Banda binacional con base entre España y México, con más de 20 shows en vivo durante el último año.",
    "events_note": "Showcase Madrid - Sala Sol (Próximamente)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@losextraviados"
  },
  {
    "id": "radar-6",
    "name": "Frecuencia Marina",
    "city": "LIMA",
    "genre": "DREAM POP / SYNTH",
    "type": "secondary",
    "order": 6,
    "badge": "RECOMENDADO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80",
    "track_id": "1xK59OXxi2TAAAbmZK0hp9",
    "short_bio": "Sintetizadores acuáticos y melodías envolventes que capturan la bruma costera del Pacífico.",
    "full_review": "Atmósferas espaciales que fusionan el shoegaze latino con beats electrónicos elegantes.",
    "career_notes": "Trío limeño elogiado por revistas especializadas en música alternativa.",
    "events_note": "Festival Costa Verde 2026",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@frecuenciamarina"
  },
  {
    "id": "radar-7",
    "name": "Sombras de Neón",
    "city": "MONTERREY",
    "genre": "DARKWAVE / EBM",
    "type": "secondary",
    "order": 7,
    "badge": "DESTACADO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&q=80",
    "track_id": "2takcwOaAZWiRsqPHPb7uy",
    "short_bio": "Secuencias industriales bailables y estéticas retro-futuristas nocturnas de alto impacto.",
    "full_review": "Bajo arpegiado analógico implacable con cajas de ritmo potentes para clubes oscuros.",
    "career_notes": "Presentaciones estelares en festivales de música electrónica underground.",
    "events_note": "Club Darkwave MTY (Noviembre 2026)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@sombrasdeneon"
  },
  {
    "id": "radar-8",
    "name": "La Última Niebla",
    "city": "VALPARAÍSO",
    "genre": "SHOEGAZE / NOISE",
    "type": "secondary",
    "order": 8,
    "badge": "EN ROTACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80",
    "track_id": "7qiZfU4dY1lWllzX7mPBI3",
    "short_bio": "Murallas sónicas de distorsión dulce y melodías vocales sumergidas en delay infinito.",
    "full_review": "Exploración sonora intensa inspirada en el shoegaze de los 90s con un toque sudamericano moderno.",
    "career_notes": "Banda de culto en el puerto de Valparaíso con discos editados en sellos independientes.",
    "events_note": "Ciclo Ruido y Mar — Valparaíso",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@laultimaniebla"
  },
  {
    "id": "radar-9",
    "name": "Río Salvaje",
    "city": "GUADALAJARA",
    "genre": "INDIE FOLK / PSICODELIA",
    "type": "secondary",
    "order": 9,
    "badge": "ESTRENO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
    "track_id": "0VjIjW4GlUZAMYd2vXMi3b",
    "short_bio": "Guitarras acústicas hipnóticas, pedales de modulación y poesía introspectiva sobre la naturaleza.",
    "full_review": "Folk psicodélico que evoca caminos de montaña y fogatas al aire libre con coros expansivos.",
    "career_notes": "Grabaciones en vivo en bosques de Jalisco con gran recepción en plataformas digitales.",
    "events_note": "Sesión Acústica GDL (Octubre 2026)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@riosalvaje.musica"
  },
  {
    "id": "radar-10",
    "name": "Autopista Central",
    "city": "SAN JOSÉ",
    "genre": "POST-PUNK / GARAJE",
    "type": "secondary",
    "order": 10,
    "badge": "RECOMENDADO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80",
    "track_id": "3n3Ppam7vgaVa1iaRUc9Lp",
    "short_bio": "Energía cruda centroamericana con baterías veloces y guitarras filosas cargadas de adrenalina.",
    "full_review": "Canciones directas de menos de tres minutos que retratan el caos y la juventud urbana.",
    "career_notes": "Una de las bandas más activas del circuito indie de Costa Rica.",
    "events_note": "Toquín San José Punk Fest 2026",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@autopistacentral"
  },
  {
    "id": "radar-11",
    "name": "Cintas Magnéticas",
    "city": "MEDELLÍN",
    "genre": "LO-FI BEATS / CHILL",
    "type": "secondary",
    "order": 11,
    "badge": "DESTACADO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80",
    "track_id": "4cOdK2wGLETKBW3PvgPWqT",
    "short_bio": "Samples de vinilo cálidos, pianos nostálgicos y bajos suaves para estudiar o relajarse.",
    "full_review": "Productor independiente que rescata grabaciones de boleros viejos y las fusiona con texturas modernas.",
    "career_notes": "Más de 500,000 streams acumulados en playlists globales de Lo-Fi.",
    "events_note": "Lanzamiento nuevo beat tape (Noviembre)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@cintasmagneticas"
  },
  {
    "id": "radar-12",
    "name": "Velo Nocturno",
    "city": "PUEBLA",
    "genre": "GOTH ROCK / DARKWAVE",
    "type": "secondary",
    "order": 12,
    "badge": "EN ROTACIÓN",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
    "track_id": "3jjujdUJ72nuh5eMFTpqQB",
    "short_bio": "Lirismo gótico elegante, guitarras con flanger marcado y una voz profunda inconfundible.",
    "full_review": "Atmósferas victorianas combinadas con ritmos bailables inspirados en The Cure y Clan of Xymox.",
    "career_notes": "Reconocidos en la escena oscura mexicana por sus presentaciones teatrales.",
    "events_note": "Noche Gótica Cholula (Diciembre 2026)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@velonocturno"
  },
  {
    "id": "radar-13",
    "name": "Satélites Olvidados",
    "city": "BARCELONA",
    "genre": "MATH ROCK / EMO INDIE",
    "type": "secondary",
    "order": 13,
    "badge": "ESTRENO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1520523839898-50712825e617?w=600&q=80",
    "track_id": "1xK59OXxi2TAAAbmZK0hp9",
    "short_bio": "Compases intrincados, guitarras tapping brillantes y explosiones emocionales catárticas.",
    "full_review": "Técnica musical depurada al servicio de canciones cargadas de nostalgia y fuerza juvenil.",
    "career_notes": "Cuarteto formado en Cataluña con giras por salas autogestionadas.",
    "events_note": "Gira peninsular 2026",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@satelitesolvidados"
  },
  {
    "id": "radar-14",
    "name": "Aurora Estéreo",
    "city": "MONTEVIDEO",
    "genre": "SYNTH POP / NEW WAVE",
    "type": "secondary",
    "order": 14,
    "badge": "RECOMENDADO",
    "media_type": "image",
    "media_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
    "track_id": "2takcwOaAZWiRsqPHPb7uy",
    "short_bio": "Melodías pop luminosas con sintetizadores analógicos brillantes y un groove bailable irresistible.",
    "full_review": "Herederos del pop refinado del Río de la Plata con arreglos vocales sofisticados.",
    "career_notes": "Banda revelación de la escena uruguaya con videoclips de estética cinematográfica.",
    "events_note": "Showcase Sala Zitarrosa (Próximamente)",
    "spotify_url": "https://open.spotify.com/",
    "instagram": "@auroraestereo"
  }
];

function getRadarArtists() {
  try {
    var local = localStorage.getItem('tniw_radar_artists');
    if (local) {
      var parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e) {
    console.error('Error reading radar artists', e);
  }
  return DEFAULT_RADAR_ARTISTS;
}

function saveRadarArtists(artists) {
  try {
    localStorage.setItem('tniw_radar_artists', JSON.stringify(artists));
  } catch(e) {
    console.error('Error saving radar artists', e);
  }
}

if (typeof window !== 'undefined') {
  window.DEFAULT_RADAR_ARTISTS = DEFAULT_RADAR_ARTISTS;
  window.getRadarArtists = getRadarArtists;
  window.saveRadarArtists = saveRadarArtists;
}
