import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { calcularNivel } from "@/lib/journey";
import { chapterName, resolveChapter } from "@/lib/chapters";

type Client = SupabaseClient<Database>;

export type ProgressSnapshot = {
  xp_total: number;
  streak_atual: number;
  streak_maximo: number;
  capitulo_atual: number;
};

export type UnlockedAchievement = {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  xp_bonus: number;
};

export type ProgressResult = {
  xp_total: number;
  capitulo_atual: number;
  chapterChanged?: { from: number; to: number; nome: string };
  unlockedAchievements: UnlockedAchievement[];
  xpBonusTotal: number;
};

type ProgressFlags = {
  /** Esta ação concluiu o primeiro hábito da conta. */
  firstHabitEver?: boolean;
};

function achievementPredicates(flags: ProgressFlags) {
  return {
    primeiro_passo: () => Boolean(flags.firstHabitEver),
    streak_7: (s: ProgressSnapshot) => s.streak_maximo >= 7,
    streak_30: (s: ProgressSnapshot) => s.streak_maximo >= 30,
    streak_100: (s: ProgressSnapshot) => s.streak_maximo >= 100,
    primeiro_nivel: (s: ProgressSnapshot) => calcularNivel(s.xp_total).atual.nivel >= 2,
    cavaleiro: (s: ProgressSnapshot) => calcularNivel(s.xp_total).atual.nivel >= 7,
    lenda: (s: ProgressSnapshot) => calcularNivel(s.xp_total).atual.nivel >= 12,
  } as const;
}

/**
 * Avalia capítulo + conquistas após ganho de XP.
 * Idempotente: não re-desbloqueia conquistas já possuídas.
 * Bônus de conquista aplicados no máximo em 2 passes (nível pode subir com bônus).
 */
export async function evaluateProgress(
  supabase: Client,
  userId: string,
  before: ProgressSnapshot,
  after: ProgressSnapshot,
  flags: ProgressFlags = {},
): Promise<ProgressResult> {
  const unlockedAchievements: UnlockedAchievement[] = [];
  let xpBonusTotal = 0;
  let state: ProgressSnapshot = { ...after };

  const { data: catalog, error: catErr } = await supabase
    .from("achievements")
    .select("id, codigo, titulo, descricao, xp_bonus");
  if (catErr) {
    console.error("[progress] achievements catalog", catErr.message);
  }

  const { data: ownedRows } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  const owned = new Set((ownedRows ?? []).map((r) => r.achievement_id));

  const preds = achievementPredicates(flags);
  const byCodigo = new Map((catalog ?? []).map((a) => [a.codigo, a]));

  for (let pass = 0; pass < 2; pass++) {
    const batch: UnlockedAchievement[] = [];
    for (const [codigo, pred] of Object.entries(preds)) {
      const ach = byCodigo.get(codigo);
      if (!ach) continue;
      if (owned.has(ach.id)) continue;
      if (unlockedAchievements.some((u) => u.id === ach.id)) continue;
      if (!pred(state)) continue;
      batch.push({
        id: ach.id,
        codigo: ach.codigo,
        titulo: ach.titulo,
        descricao: ach.descricao,
        xp_bonus: ach.xp_bonus ?? 0,
      });
    }
    if (!batch.length) break;

    for (const ach of batch) {
      const { error: insErr } = await supabase.from("user_achievements").insert({
        user_id: userId,
        achievement_id: ach.id,
      });
      if (insErr) {
        // Já existe / race — ignora
        if (!/duplicate|unique/i.test(insErr.message)) {
          console.error("[progress] user_achievements", insErr.message);
        }
        continue;
      }
      owned.add(ach.id);
      unlockedAchievements.push(ach);
      xpBonusTotal += ach.xp_bonus;

      if (ach.xp_bonus > 0) {
        state = { ...state, xp_total: state.xp_total + ach.xp_bonus };
      }

      await supabase.from("activity_history").insert({
        user_id: userId,
        tipo: "achievement",
        descricao: `Conquista: ${ach.titulo}`,
        xp_delta: ach.xp_bonus,
        metadata: { achievement_id: ach.id, codigo: ach.codigo },
      });

      try {
        const { createNotification } = await import("@/notifications/create");
        await createNotification({
          userId,
          tipo: "achievement",
          titulo: `Conquista: ${ach.titulo}`,
          corpo: ach.descricao + (ach.xp_bonus ? ` · +${ach.xp_bonus} XP` : ""),
          metadata: {
            achievement_id: ach.id,
            codigo: ach.codigo,
            href: "/profile",
          },
        });
      } catch (e) {
        console.error("[progress] achievement notify", e);
      }
    }
  }

  const targetChapter = resolveChapter(state.xp_total);
  let chapterChanged: ProgressResult["chapterChanged"];

  if (targetChapter > state.capitulo_atual) {
    const from = state.capitulo_atual;
    const { error: chErr } = await supabase
      .from("profiles")
      .update({
        xp_total: state.xp_total,
        capitulo_atual: targetChapter,
      })
      .eq("id", userId);
    if (chErr) {
      console.error("[progress] chapter update", chErr.message);
    } else {
      state = { ...state, capitulo_atual: targetChapter };
      chapterChanged = {
        from,
        to: targetChapter,
        nome: chapterName(targetChapter),
      };

      await supabase.from("activity_history").insert({
        user_id: userId,
        tipo: "chapter_up",
        descricao: `Avançou para o capítulo ${targetChapter} — ${chapterName(targetChapter)}`,
        xp_delta: 0,
        metadata: { from, to: targetChapter },
      });

      try {
        const { createNotification } = await import("@/notifications/create");
        await createNotification({
          userId,
          tipo: "system",
          titulo: `Capítulo ${targetChapter}: ${chapterName(targetChapter)}`,
          corpo: "Um novo arco da sua jornada começa agora.",
          metadata: { href: "/journey", capitulo: targetChapter },
        });
      } catch (e) {
        console.error("[progress] chapter notify", e);
      }

      try {
        const { ensureChapterMissions } = await import("@/lib/missions-core");
        await ensureChapterMissions(supabase, userId, targetChapter, {
          abandonPrevious: true,
        });
      } catch (e) {
        console.error("[progress] seed missions", e);
      }
    }
  } else if (xpBonusTotal > 0) {
    const { error: xpErr } = await supabase
      .from("profiles")
      .update({ xp_total: state.xp_total })
      .eq("id", userId);
    if (xpErr) console.error("[progress] xp bonus update", xpErr.message);
  }

  // Wallpapers com capítulo/XP finais
  try {
    const { notifyNewlyUnlockedWallpapers } = await import("@/lib/wallpaper-notify");
    await notifyNewlyUnlockedWallpapers(
      userId,
      {
        xp_total: before.xp_total,
        streak_maximo: before.streak_maximo,
        capitulo_atual: before.capitulo_atual,
      },
      {
        xp_total: state.xp_total,
        streak_maximo: state.streak_maximo,
        capitulo_atual: state.capitulo_atual,
      },
    );
  } catch (e) {
    console.error("[progress] wallpaper notify", e);
  }

  return {
    xp_total: state.xp_total,
    capitulo_atual: state.capitulo_atual,
    chapterChanged,
    unlockedAchievements,
    xpBonusTotal,
  };
}
