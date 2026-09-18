-- ==============================================================================
-- SCHEMA SUPABASE: THE NEW INDIE WAVE (TNIW)
-- Módulo de Artículos / Noticias / Blog Editorial
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
    author_avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    image_url TEXT NOT NULL,
    read_time TEXT DEFAULT '4 min',
    tags TEXT[] DEFAULT '{}',
    featured BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles(published_at DESC);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACCESO:
-- Permitir lectura pública de artículos publicados a cualquier visitante
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
END
$$;

-- Permitir administración completa a usuarios autenticados / service_role
DO $$
BEGIN
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
-- SEED DATA: ARTÍCULOS EDITORIALES INICIALES
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
    'como-dominar-el-algoritmo-de-spotify-2026',
    'Cómo dominar el algoritmo de Spotify en 2026: Guardados, Radio y el fin del mito de los streams',
    'El verdadero secreto de Spotify no está en conseguir miles de reproducciones pasajeras, sino en la tasa de guardados (Save Rate), el porcentaje de reproducción completa y la activación de Radio y Release Radar.',
    '<p class="lead">Para un artista independiente en 2026, la métrica más engañosa es el número de reproducciones brutas. Un tema con 10,000 streams puede ser ignorado por Spotify si el 70% de los oyentes lo saltó antes de los 30 segundos.</p>
    
    <h2>1. La regla del Save Rate (Tasa de Guardados)</h2>
    <p>El algoritmo de recomendación de Spotify (principalmente Discover Weekly y Radio) evalúa la <strong>intención del oyente</strong>. La señal más potente no es reproducir una canción una vez, sino agregarla a "Canciones que te gustan" (Liked Songs) o incluirla en una playlist personal.</p>
    <p>Si tu ratio de guardados supera el <strong>8% al 12%</strong> del total de tus oyentes únicos, Spotify asume que tu música genera resonancia real y comienza a probarla orgánicamente ante audiencias similares.</p>

    <blockquote>"Spotify prefiere recomendar una canción con 500 reproducciones y 100 guardados que una con 10,000 reproducciones infladas sin una sola adición a biblioteca."</blockquote>

    <h2>2. El peligro de las playlists fraudulentas ("Pay-to-Play")</h2>
    <p>Comprar entradas en playlists no verificadas de terceros casi siempre destruye tu perfil algorítmico. Los bots o cuentas fantasma escuchan exactamente 31 segundos (para cobrar la regalía) sin guardar la canción ni explorar tu discografía. Cuando el algoritmo analiza a tu audiencia y detecta patrones artificiales, tu música es excluida de las herramientas automáticas de recomendación.</p>

    <h2>3. El rol de las playlists de curaduría independiente</h2>
    <p>Las playlists independientes con comunidades reales —como las que curamos en <strong>The New Indie Wave</strong>— tienen un valor inmenso: quienes escuchan estas listas son melómanos genuinos buscando nueva música. Cuando un oyente orgánico descubre tu canción en una playlist de nicho y le da "Me Gusta", estás enviando la señal algorítmica más pura posible al sistema.</p>',
    'Estrategia & Algoritmos',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    '5 min',
    ARRAY['Spotify', 'Algoritmo', 'Música Indie', 'Streaming', 'Estrategias'],
    true,
    true,
    NOW() - INTERVAL '1 day'
),
(
    'identidad-visual-para-musicos-estetica-indie',
    'Identidad visual para músicos: Por qué el arte y la estética importan tanto como la mezcla',
    'En un mercado saturado con más de 120,000 canciones publicadas a diario, la estética visual es el primer filtro. Claves para construir un universo gráfico coherente sin un presupuesto millonario.',
    '<p class="lead">Vivimos en una cultura hipervisual. Antes de que un usuario presione play en tu nuevo sencillo en Spotify o TikTok, su cerebro ya procesó los colores, la tipografía y la fotografía de tu portada en menos de 200 milisegundos.</p>

    <h2>El concepto de "Universo Visual"</h2>
    <p>Los proyectos musicales independientes más recordados no se limitan a lanzar canciones sueltas: construyen una atmósfera. Piensa en bandas como Beach House, Fontaines D.C. o The 1975. Cada era tiene una paleta de color estricta, un tipo de grano fotográfico, una tipografía recurrente y un estilo de vestuario reconocible.</p>

    <h2>3 errores comunes en portadas de artistas emergentes</h2>
    <ul>
      <li><strong>Sobrecarga de texto:</strong> En la era del smartphone, la portada se visualiza como una miniatura de 40x40 píxeles. Tipografías ilegibles o textos diminutos ensucian la composición.</li>
      <li><strong>Falta de concepto:</strong> Usar una selfie casual o un render genérico desconectado del mensaje emocional de la pista.</li>
      <li><strong>Inconsistencia entre plataformas:</strong> Tener una estética retro en Instagram, una foto corporativa en Spotify for Artists y una portada psicodélica confunde la retención del fan.</li>
    </ul>

    <blockquote>"Tu identidad visual no compite con tu música: es el puente que convence a un extraño de darle una oportunidad a tu sonido."</blockquote>',
    'Arte & Visuales',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    '4 min',
    ARRAY['Diseño', 'Arte', 'Portadas', 'Identidad', 'Branding Musical'],
    false,
    true,
    NOW() - INTERVAL '3 days'
),
(
    'distribucion-digital-vs-discograficas-tradicionales',
    'Distribución digital independiente vs. Contratos discográficos: El mapa actual de la industria',
    'Conservar el 100% de tus masters ya no es una limitación, es tu mayor activo financiero a largo plazo. Cuándo conviene mantenerse 100% independiente y cuándo tiene sentido asociarse con un sello.',
    '<p class="lead">El mito del "artista descubierto que firma un contrato millonario" ha quedado obsoleto. Hoy en día, los sellos discográficos no buscan talento en bruto; buscan proyectos con tracción demostrable, audiencia propia y catálogos consolidados.</p>

    <h2>El verdadero valor de tus Masters</h2>
    <p>En el modelo tradicional, un sello adelantaba dinero a cambio de quedarse con la propiedad permanente de las grabaciones maestras (masters). El artista recibía entre el 15% y el 20% de regalías solo después de haber devuelto hasta el último centavo de los gastos de producción y marketing.</p>
    <p>A través de agregadores como DistroKid, CD Baby, TuneCore o Too Lost, un músico independiente retiene el <strong>100% de sus derechos fonográficos</strong>. Si una canción tuya explota dentro de tres años en una serie o en un trend global, los ingresos ingresan directamente a tu cuenta bancaria.</p>

    <h2>¿Cuándo sí tiene sentido firmar?</h2>
    <p>Firmar con un sello independiente respetado o una discográfica mayor solo tiene sentido cuando necesitas músculo de distribución física internacional, adelantos sustanciales para costear giras complejas o colocaciones directas en sincronizaciones cinematográficas de gran escala.</p>',
    'Industria Musical',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    '6 min',
    ARRAY['Masters', 'Regalías', 'Distribución', 'Sellos Discográficos', 'Negocio Musical'],
    false,
    true,
    NOW() - INTERVAL '5 days'
),
(
    'estandares-sonoridad-lufs-streaming-mezcla',
    'Estándares de sonoridad (LUFS) en streaming: Mezclando para sonar potente sin arruinar la dinámica',
    'La guerra del volumen quedó atrás, pero muchos productores de home studio siguen aplastando sus mezclas con limitadores agresivos. Cómo calibrar tus másters a -14 LUFS para sonar con pegada y claridad.',
    '<p class="lead">Uno de los desengaños más comunes para un productor emergente es escuchar su tema sonar increíblemente ruidoso en su software de producción (DAW), pero sonar pequeño y sin vida cuando se reproduce en Spotify o Apple Music.</p>

    <h2>¿Qué es la normalización de volumen?</h2>
    <p>Plataformas como Spotify, Apple Music y YouTube aplican normalización automática para que el oyente no tenga que subir o bajar el volumen entre canciones consecutivas. Spotify utiliza un estándar de referencia de <strong>-14 LUFS integrados</strong>.</p>
    <p>Si masterizas tu pista a -8 LUFS (muy comprimida y sin rango dinámico), Spotify la bajará 6 dB en la reproducción. Como resultado, un tema con dinámica y transitorios claros masterizado a -13 LUFS sonará con mucho más impacto y golpe de batería que el tuyo.</p>

    <h2>Recomendaciones para tu mezcla:</h2>
    <ul>
      <li><strong>Deja aire al True Peak:</strong> Mantén el pico verdadero (True Peak) entre -1.0 dBFS y -0.5 dBFS para evitar distorsión inter-sample durante la compresión a códecs AAC y Ogg Vorbis.</li>
      <li><strong>Protege la pegada de la batería:</strong> No limites en exceso el bus maestro; utiliza compresión paralela o saturación sutil para ganar sonoridad sin perder los transitorios.</li>
    </ul>',
    'Producción & Sonido',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    '5 min',
    ARRAY['Producción', 'Masterización', 'LUFS', 'Home Studio', 'Mezcla'],
    false,
    true,
    NOW() - INTERVAL '8 days'
),
(
    'nueva-ola-indie-iberoamerica-habitaciones-a-festivales',
    'La nueva ola indie en Iberoamérica: De las habitaciones a los festivales',
    'El Bedroom Pop, Shoegaze, Post-Punk y Neo-Folk en español viven su momento más fructífero y auténtico. Por qué la producción casera y la curaduría comunitaria están conectando con toda una generación.',
    '<p class="lead">Hubo un tiempo en que grabar un álbum requería alquilar un estudio con consolas analógicas de decenas de miles de dólares. Hoy, algunas de las canciones más conmovedoras del circuito iberoamericano nacen con una tarjeta de sonido USB, un micrófono condensador y un software en una laptop en un dormitorio de Guadalajara, Bogotá, Buenos Aires o Madrid.</p>

    <h2>La autenticidad como nuevo estandarte</h2>
    <p>Las audiencias jóvenes están saturadas de producciones pulidas hasta la esterilidad algorítmica. Buscan vulnerabilidad lírica, texturas de guitarras con chorus y reverb, y voces que suenen cercanas, íntimas y humanas.</p>
    <p>El nacimiento de comunidades como <strong>The New Indie Wave</strong> responde precisamente a esa necesidad: crear un puente libre de barreras corporativas donde una banda de garaje de cualquier rincón del mundo pueda ser descubierta, escuchada con respeto y catapultada a nuevos públicos.</p>',
    'Cultura Indie',
    'Rodrigo DL Moral',
    'Curador & Fundador TNIW',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    '4 min',
    ARRAY['Cultura', 'Shoegaze', 'Bedroom Pop', 'Post-Punk', 'Indie Latino'],
    false,
    true,
    NOW() - INTERVAL '12 days'
)
ON CONFLICT (slug) DO NOTHING;
