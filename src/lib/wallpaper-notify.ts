import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification } from "@/notifications/create";
import {
  getNewlyUnlockedWallpapers,
  type WallpaperProgress,
} from "@/lib/wallpapers";

/**
 * Cria notificações no sino para fundos recém-desbloqueados.
 * Deduplica por metadata.wallpaper_id.
 */
export async function notifyNewlyUnlockedWallpapers(
  userId: string,
  before: WallpaperProgress,
  after: WallpaperProgress,
) {
  const newly = getNewlyUnlockedWallpapers(before, after);
  if (!newly.length) return { created: 0 };

  let created = 0;
  for (const w of newly) {
    const { count, error: countErr } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("tipo", "achievement")
      .filter("metadata->>wallpaper_id", "eq", w.id);

    if (countErr) {
      console.error("[wallpaper] notify count", countErr.message);
      continue;
    }
    if ((count ?? 0) > 0) continue;

    const res = await createNotification({
      userId,
      tipo: "achievement",
      titulo: `Fundo liberado: ${w.titulo}`,
      corpo: `Você desbloqueou um novo fundo de tela. Veja em Perfil.`,
      metadata: {
        wallpaper_id: w.id,
        kind: "wallpaper_unlock",
        href: "/profile",
      } as Record<string, Json | undefined>,
    });
    if (res.ok) created += 1;
  }

  return { created };
}
