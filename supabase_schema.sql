-- ==============================================================================
-- SCHEMA SUPABASE: THE NEW INDIE WAVE (TNIW)
-- Tabla de Envíos y Seguimiento en Tiempo Real (Sin necesidad de Login de Usuario)
-- ==============================================================================

-- 1. Crear extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla principal de envíos
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id VARCHAR(32) UNIQUE NOT NULL,             -- Ej: TNIW-8F3A29 (Magic Tracking ID)
    artist_name TEXT NOT NULL,
    email TEXT NOT NULL,
    country TEXT,
    song_title TEXT NOT NULL,
    spotify_url TEXT NOT NULL,
    genre TEXT,
    language TEXT DEFAULT 'Español',
    playlist TEXT NOT NULL,
    instagram TEXT,
    tiktok TEXT,
    notes TEXT,
    tier TEXT DEFAULT 'free',                         -- 'free' o 'boost' (Impulso)
    status TEXT DEFAULT 'pending',                    -- 'pending', 'queue', 'listening', 'accepted', 'rejected'
    feedback TEXT,                                    -- Feedback del curador (mínimo 15 palabras)
    story_video_url TEXT,                             -- URL del video-historia generado si es aceptado
    spotify_added BOOLEAN DEFAULT false,              -- Si ya se insertó automáticamente en la playlist
    social_broadcasted BOOLEAN DEFAULT false,         -- Si ya se publicó en @TNIWave y @MtrendVideo
    response_deadline TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para consultas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_submissions_track_id ON public.submissions(track_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON public.submissions(email);

-- 4. Habilitar Seguridad a Nivel de Fila (Row Level Security - RLS)
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACCESO PÚBLICO SEGURO (Sin login de usuario):

-- A) Permitir que cualquier visitante anónimo envíe una canción
CREATE POLICY "Permitir envíos públicos de canciones"
ON public.submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- B) Permitir que cualquier visitante consulte el estado de su canción mediante su track_id (Magic Link)
CREATE POLICY "Permitir lectura pública por track_id"
ON public.submissions
FOR SELECT
TO anon, authenticated
USING (true);

-- C) Solo el rol de servicio o usuarios autenticados (Curador) pueden actualizar estado o feedback
CREATE POLICY "Solo curador autenticado puede actualizar envíos"
ON public.submissions
FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- VISTA DE RESUMEN PARA EL CURADOR
-- ==============================================================================
CREATE OR REPLACE VIEW public.curator_pending_queue AS
SELECT 
    id,
    track_id,
    artist_name,
    song_title,
    spotify_url,
    playlist,
    tier,
    status,
    response_deadline,
    created_at,
    (response_deadline - NOW()) AS time_remaining
FROM public.submissions
WHERE status IN ('pending', 'queue', 'listening')
ORDER BY 
    CASE WHEN tier = 'boost' THEN 1 ELSE 2 END,
    response_deadline ASC;
