-- Wallpaper preference on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallpaper_id TEXT NOT NULL DEFAULT 'none';
