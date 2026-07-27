-- =============================================================================
-- Região do herói — clima para o Charlie (Open-Meteo no servidor)
-- Rodar no SQL Editor se o CLI/MCP não aplicar automaticamente.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_timezone TEXT;

COMMENT ON COLUMN public.profiles.location_label IS 'Cidade/região exibida (geocoding Open-Meteo)';
COMMENT ON COLUMN public.profiles.location_lat IS 'Latitude da região do herói';
COMMENT ON COLUMN public.profiles.location_lon IS 'Longitude da região do herói';
COMMENT ON COLUMN public.profiles.location_timezone IS 'Timezone IANA retornada pelo geocoding';
