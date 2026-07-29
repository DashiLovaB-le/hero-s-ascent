import { DEFAULT_WALLPAPER_ID, getWallpaperById, wallpaperSrc } from "@/lib/wallpapers";

const STORAGE_KEY = "v-project-wallpaper-id";
export const WALLPAPER_CHANGE_EVENT = "v-project-wallpaper-change";

export function readStoredWallpaperId(): string {
  if (typeof window === "undefined") return DEFAULT_WALLPAPER_ID;
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return getWallpaperById(id).id;
  } catch {
    return DEFAULT_WALLPAPER_ID;
  }
}

export function writeStoredWallpaperId(id: string) {
  const safe = getWallpaperById(id).id;
  try {
    localStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WALLPAPER_CHANGE_EVENT, { detail: safe }));
  }
  return safe;
}

export function resolveWallpaperBackground(id: string | null | undefined): {
  id: string;
  src: string | null;
} {
  const def = getWallpaperById(id);
  return { id: def.id, src: wallpaperSrc(def) };
}
