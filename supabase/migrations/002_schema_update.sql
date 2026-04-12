-- 002_schema_update.sql
-- Fix schema drift: add missing columns to analysis_records,
-- create athletes table, and enable RLS

-- ============================================================
-- 1. Add missing columns to analysis_records
-- ============================================================
ALTER TABLE public.analysis_records
  ADD COLUMN IF NOT EXISTS technical_score integer,
  ADD COLUMN IF NOT EXISTS risk_score integer,
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS priority_focus text,
  ADD COLUMN IF NOT EXISTS natural_language_diagnosis text,
  ADD COLUMN IF NOT EXISTS readiness_adjustment text,
  ADD COLUMN IF NOT EXISTS coach_cues text[],
  ADD COLUMN IF NOT EXISTS notes text;

-- Make score column nullable (old schema had NOT NULL, new flow may omit it)
ALTER TABLE public.analysis_records
  ALTER COLUMN score DROP NOT NULL;

-- ============================================================
-- 2. Create athletes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.athletes (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text,
    age integer,
    category text DEFAULT 'recreational',
    specialty text,
    injury_history text,
    goals text,
    garmin_connected boolean DEFAULT false,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS athletes_name_idx ON public.athletes (name);

-- ============================================================
-- 3. Seed athletes table with demo data
-- ============================================================
INSERT INTO public.athletes (id, name, age, category, specialty, goals)
VALUES
  ('athlete_mariana', 'Mariana Lopez', 28, 'elite', 'medio fondo', 'Clasificar a Juegos Centroamericanos'),
  ('athlete_carlos', 'Carlos Rivera', 35, 'recreational', 'maraton', 'Sub 3:30 en maraton'),
  ('athlete_sofia', 'Sofia Chen', 22, 'competitive', 'trail running', 'Completar ultra de 100k'),
  ('athlete_diego', 'Diego Herrera', 31, 'competitive', '10k', 'Romper 38 min en 10k'),
  ('athlete_ana', 'Ana Martinez', 26, 'elite', '5k/10k', 'Mejorar tecnica y reducir lesiones')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Enable Row Level Security
-- ============================================================
ALTER TABLE public.analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all records (coach scenario)
CREATE POLICY IF NOT EXISTS "Authenticated users can read analysis_records"
  ON public.analysis_records
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can insert analysis records
CREATE POLICY IF NOT EXISTS "Authenticated users can insert analysis_records"
  ON public.analysis_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can read all athletes
CREATE POLICY IF NOT EXISTS "Authenticated users can read athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can manage athletes
CREATE POLICY IF NOT EXISTS "Authenticated users can manage athletes"
  ON public.athletes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: allow service role full access (for API routes)
CREATE POLICY IF NOT EXISTS "Service role full access to analysis_records"
  ON public.analysis_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role full access to athletes"
  ON public.athletes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. Storage bucket policies
-- ============================================================
CREATE POLICY IF NOT EXISTS "Authenticated users can upload videos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dizkos-videos');

CREATE POLICY IF NOT EXISTS "Authenticated users can read videos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'dizkos-videos');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload overlays"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dizkos-overlays');

CREATE POLICY IF NOT EXISTS "Authenticated users can read overlays"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'dizkos-overlays');
