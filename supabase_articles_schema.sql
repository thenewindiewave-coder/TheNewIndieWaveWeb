-- ==============================================================================
-- SCHEMA SUPABASE: THE NEW INDIE WAVE (TNIW)
-- Módulo de Artículos / Noticias / Blog Editorial (Formato Rápido & Punchy)
-- ==============================================================================

-- 1. Crear tabla de artículos / noticias
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    author TEXT DEFAULT 'Rodrigo DL Moral',
    author_role TEXT DEFAULT 'Curador & Fundador TNIW',
    author_avatar TEXT DEFAULT 'rodrigo_studio_web.jpg',
    image_url TEXT NOT NULL,
    read_time TEXT DEFAULT '1.5 min',
    tags TEXT[] DEFAULT '{}',
    featured BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para consultas de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles(published_at DESC);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACCESO SEGURAS (Idempotentes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'articles' AND policyname = 'Permitir lectura pública de artículos publicados'
    ) THEN
        CREATE POLICY "Permitir lectura pública de artículos publicados"
        ON public.articles
        FOR SELECT
        TO anon, authenticated
        USING (published = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'articles' AND policyname = 'Permitir administración de artículos a curador autenticado'
    ) THEN
        CREATE POLICY "Permitir administración de artículos a curador autenticado"
        ON public.articles
        FOR ALL
        TO authenticated, service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;

-- ==============================================================================
-- 5. ARTÍCULOS SEMILLA (FORMATO DIRECTO, RÁPIDO, BAJA RETENCIÓN)
-- ==============================================================================

INSERT INTO public.articles (
    slug,
    title,
    summary,
    content,
    category,
    author,
    author_role,
    image_url,
    read_time,
    tags,
    featured,
    published,
    published_at
) VALUES 
(
    'spoiler-meter-musica-playlists-bots-mato-algoritmo-spotify',
    'Spoiler: Pagar por playlists de bots mató tu algoritmo de Spotify (y cómo revivirlo)',
    'Te prometieron 50,000 streams por $30 dólares. El problema es que Spotify no es tonto: detectó el fraude y congeló tu perfil. Te explicamos en 1 minuto cómo limpiar tu cuenta.',
    '<p class="lead">Si pagaste por entrar a una playlist milagrosa y de pronto tienes 30,000 streams pero <strong>cero seguidores y cero oyentes recurrentes</strong>: felicidades, caíste en la trampa de los bots.</p>
    
    <h2>La matemática que te arruinó</h2>
    <p>A Spotify no le impresionan los números inflados. Lo que el algoritmo mide en realidad es esto:</p>
    <ul>
      <li><strong>El botón de ''Me Gusta'':</strong> ¿Cuántos de esos 30,000 guardaron tu canción en su biblioteca? (Con bots: 0%).</li>
      <li><strong>El tiempo de escucha:</strong> Los bots saltan la rola al segundo 31. Para Spotify eso significa: <em>''A la gente le disgusta esta canción, no se la recomiendes a nadie''</em>.</li>
    </ul>

    <blockquote>"Spotify prefiere recomendar una canción con 300 reproducciones y 80 guardados reales, que una con 50,000 reproducciones vacías."</blockquote>

    <h2>¿Cómo salir del congelador?</h2>
    <ol>
      <li><strong>Sal de esas listas ya:</strong> Pide a esos ''promotores'' que te retiren de inmediato.</li>
      <li><strong>Enfócate en curators reales:</strong> Comunidades como The New Indie Wave donde escuchamos track por track con personas reales detrás.</li>
      <li><strong>Manda tráfico tuyo:</strong> Haz que 50 amigos de verdad la guarden y la escuchen completa. Con eso el algoritmo vuelve a respirar.</li>
    </ol>',
    'Estrategia & Algoritmos',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    '1.5 min',
    ARRAY['Spotify', 'Algoritmo', 'Anti-Bots', 'Música Indie'],
    true,
    true,
    NOW() - INTERVAL '1 day'
),
(
    'nadie-va-a-escuchar-tu-cancion-si-tu-portada-parece-de-paint',
    'Nadie va a escuchar tu rola si tu portada parece hecha en Paint en 5 minutos',
    'La gente scrollea a la velocidad de la luz. Tienes exactamente 0.3 segundos para que alguien decida darle ''Play'' o ignorarte para siempre. 3 tips visuales sin gastar un solo peso.',
    '<p class="lead">Seamos brutales pero honestos: puedes tener la mejor rola indie del año, pero si tu portada parece una selfie borrosa con letras de WordArt, nadie le va a dar play. La vista es el primer filtro.</p>

    <h2>Las 3 reglas de oro para que tu portada venda:</h2>
    <ul>
      <li><strong>Regla de la uña (Thumbnail Test):</strong> Reduce tu portada al tamaño de una moneda en tu celular. ¿Se entiende la foto o parece una mancha oscura? Si no tiene contraste, no sirve.</li>
      <li><strong>Deja de saturar de texto:</strong> Ya no estamos en 1995. No pongas ''PRODUCIDO POR...'', ''FEAT...'', ''DISPONIBLE EN...''. Solo el arte o máximo el nombre. La app ya dice quién eres.</li>
      <li><strong>Universo de color:</strong> Elige 2 colores dominantes y manténlos en tus fotos de perfil y videos. La coherencia visual crea fans, la improvisación crea indiferencia.</li>
    </ul>

    <blockquote>"El arte visual no compite con tu música: es el gancho que convence a un extraño de darle una oportunidad."</blockquote>',
    'Arte & Visuales',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    '1 min',
    ARRAY['Portadas', 'Diseño', 'Arte Visual', 'Branding'],
    false,
    true,
    NOW() - INTERVAL '2 days'
),
(
    'por-que-tu-cancion-suena-bajita-en-spotify-lufs-truco',
    '¿Por qué tu rola suena bajita y sin pegada en Spotify? (El truco de los -14 LUFS)',
    'En tus audífonos sonaba monstruosa, pero en Spotify suena aplastada y sin vida comparada con otras canciones. Por qué aplastar tu mezcla con limitadores te está jugando en contra.',
    '<p class="lead">El error novato más común en home studios: meter 4 limitadores en el máster para que ''suene durísimo'', solo para subirla a Spotify y escucharla más baja que el resto.</p>

    <h2>¿Por qué pasa esto?</h2>
    <p>Spotify tiene un policía automático de volumen configurado a <strong>-14 LUFS</strong>. Si tu mezcla entra a -7 LUFS (reventadísima), Spotify le baja 7 decibeles de golpe.</p>
    <p>¿El resultado? Como mataste toda la dinámica con los limitadores, tu bombo y tu bajo ya no tienen golpe. Suenas plano y pequeño.</p>

    <h2>La fórmula rápida para que suene cañón:</h2>
    <ul>
      <li><strong>Apunta a -13 o -14 LUFS integrados:</strong> Deja que la canción respire.</li>
      <li><strong>Deja el True Peak a -1.0 dB:</strong> Si lo dejas a 0 dB, al convertirse al formato de streaming va a distorsionar en los celulares.</li>
      <li><strong>No limites todo en el máster:</strong> Usa saturación de cinta o clipping suave en las pistas individuales.</li>
    </ul>',
    'Producción & Sonido',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    '2 min',
    ARRAY['Mezcla', 'LUFS', 'Mastering', 'Home Studio'],
    false,
    true,
    NOW() - INTERVAL '3 days'
),
(
    'tus-masters-valen-oro-cuidado-con-contratos-trampa',
    'Tus canciones valen oro: Ojo con los ''sellos'' que te piden tus derechos para siempre',
    'Te llega un DM sospechoso: ''Nos encanta tu proyecto, te firmamos por un porcentaje''. Antes de emocionarte y firmar tu vida, lee esto sobre quién es el verdadero dueño de tu música.',
    '<p class="lead">La regla de oro del músico independiente en 2026: <strong>Nunca cedas tus masters a perpetuidad a cambio de ''promoción'' que tú mismo puedes hacer con un celular.</strong></p>

    <h2>¿Qué es un contrato trampa?</h2>
    <p>Empresas o ''caza-talentos'' que te ofrecen meterte en sus listas a cambio de quedarse con el 50% o el 80% de tus regalías editoriales y fonográficas. Si tu rola pega dentro de dos años en una serie o en TikTok, ellos se quedan con la plata y tú con las migajas.</p>

    <h2>¿Qué hacer en su lugar?</h2>
    <ul>
      <li>Distribuye tú mismo (DistroKid, TuneCore, CD Baby, etc.). Eres dueño del 100%.</li>
      <li>Si vas a firmar con un sello independiente, que sea con <strong>licencia temporal</strong> (ej: 2 a 3 años), nunca de por vida.</li>
      <li>Aprende a leer qué porcentaje te están pidiendo de publishing y de máster antes de soltar la firma.</li>
    </ul>',
    'Industria Musical',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    '1.5 min',
    ARRAY['Masters', 'Derechos', 'Contratos', 'Regalías'],
    false,
    true,
    NOW() - INTERVAL '4 days'
),
(
    'hacer-musica-desde-tu-cuarto-ya-le-gana-a-estudios-millonarios',
    'Hacer rolas desde tu cuarto ya le gana a los estudios caros: La era dorada del DIY',
    'Ya no necesitas gastar $20,000 dólares en consolas analógicas para conmover a miles de personas. Por qué la honestidad bedroom-pop y shoegaze está conectando más que los tracks sobreproducidos.',
    '<p class="lead">Las disqueras millonarias gastan fortunas en pulir canciones hasta dejarlas sin alma. La gente joven ya no quiere perfección estéril: quiere canciones que se sientan vivas, íntimas y vulnerables.</p>

    <h2>La ventaja del artista de habitación:</h2>
    <ul>
      <li><strong>Libertad absoluta:</strong> Nadie en una oficina con corbata te dice qué acorde cambiar o cómo vestirte.</li>
      <li><strong>Velocidad:</strong> Terminas una rola hoy a las 3:00 AM y en 5 días está en las plataformas del mundo entero.</li>
      <li><strong>Conexión directa:</strong> Tu comunidad no idolatra a una estrella inalcanzable; conecta con un colega que comparte sus mismas emociones y dudas.</li>
    </ul>

    <blockquote>"El equipo más importante que tienes no es tu micrófono: es lo que tienes que decir y la verdad con la que lo dices."</blockquote>',
    'Cultura Indie',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    '1.5 min',
    ARRAY['Bedroom Pop', 'DIY', 'Shoegaze', 'Cultura Indie'],
    false,
    true,
    NOW() - INTERVAL '5 days'
)
ON CONFLICT (slug) DO NOTHING;
