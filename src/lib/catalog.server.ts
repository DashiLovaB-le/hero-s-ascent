/**
 * Catálogo de níveis e wallpapers (DB com fallback estático).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LEVELS, type LevelInfo } from "@/lib/journey";
import {
  WALLPAPERS_FALLBACK as WALLPAPERS,
  type WallpaperDef,
  type WallpaperUnlock,
} from "@/lib/wallpapers";

export async function loadLevelsFromDb(): Promise<LevelInfo[]> {
  const { data, error } = await supabaseAdmin
    .from("levels")
    .select("nivel, titulo, xp_necessario")
    .order("xp_necessario", { ascending: true });
  if (error || !data?.length) {
    if (error) console.warn("[catalog] levels fallback:", error.message);
    return LEVELS;
  }
  return data.map((r) => ({
    nivel: r.nivel,
    titulo: r.titulo,
    xp_necessario: r.xp_necessario,
  }));
}

function rowToWallpaper(row: {
  id: string;
  titulo: string;
  descricao: string;
  file_name: string | null;
  image_url: string | null;
  unlock_kind: string;
  unlock_min: number;
}): WallpaperDef {
  const kind = row.unlock_kind as WallpaperUnlock["kind"];
  const unlock: WallpaperUnlock =
    kind === "always" ? { kind: "always" } : { kind, min: row.unlock_min };
  return {
    id: row.id,
    file: row.file_name,
    imageUrl: row.image_url,
    titulo: row.titulo,
    descricao: row.descricao,
    unlock,
  };
}

export async function loadWallpapersFromDb(opts?: {
  includeInactive?: boolean;
}): Promise<WallpaperDef[]> {
  let q = supabaseAdmin
    .from("wallpaper_catalog")
    .select("id, titulo, descricao, file_name, image_url, unlock_kind, unlock_min, sort_order, ativo")
    .order("sort_order", { ascending: true });
  if (!opts?.includeInactive) q = q.eq("ativo", true);

  const { data, error } = await q;
  if (error || !data?.length) {
    if (error) console.warn("[catalog] wallpapers fallback:", error.message);
    return WALLPAPERS;
  }
  return data.map(rowToWallpaper);
}
