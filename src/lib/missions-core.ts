import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { missionTemplatesForChapter } from "@/lib/mission-templates";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Client = SupabaseClient<Database>;

export const MISSION_COLS =
  "id, user_id, kind, capitulo, titulo, descricao, xp_recompensa, status, progresso_atual, progresso_alvo, habit_id, track, created_at, completed_at";

export type MissionRow = {
  id: string;
  user_id: string;
  kind: Database["public"]["Enums"]["mission_kind"];
  capitulo: number;
  titulo: string;
  descricao: string;
  xp_recompensa: number;
  status: string;
  progresso_atual: number;
  progresso_alvo: number;
  habit_id: string | null;
  track: string;
  created_at: string;
  completed_at: string | null;
};

/**
 * Garante missões do capítulo. Se abandonPrevious, arquiva ativas de outros capítulos.
 */
export async function ensureChapterMissions(
  _supabase: Client,
  userId: string,
  capitulo: number,
  opts: { abandonPrevious?: boolean } = {},
): Promise<MissionRow[]> {
  const supabase = supabaseAdmin;
  if (opts.abandonPrevious) {
    await supabase
      .from("missions")
      .update({ status: "abandonada" })
      .eq("user_id", userId)
      .eq("status", "ativa")
      .neq("capitulo", capitulo);
  }

  const { data: existing, error: exErr } = await supabase
    .from("missions")
    .select(MISSION_COLS)
    .eq("user_id", userId)
    .eq("capitulo", capitulo)
    .eq("status", "ativa");

  if (exErr) {
    if (/missions|relation|schema cache/i.test(exErr.message)) {
      console.warn("[missions] ensure skipped:", exErr.message);
      return [];
    }
    throw new Error(exErr.message);
  }

  if ((existing ?? []).length > 0) {
    return existing as MissionRow[];
  }

  const templates = missionTemplatesForChapter(capitulo);
  const rows = templates.map((t) => ({
    user_id: userId,
    kind: t.kind,
    capitulo,
    titulo: t.titulo,
    descricao: t.descricao,
    xp_recompensa: t.xp_recompensa,
    status: "ativa" as const,
    progresso_atual: 0,
    progresso_alvo: t.progresso_alvo,
    track: t.track,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("missions")
    .insert(rows)
    .select(MISSION_COLS);

  if (insErr) throw new Error(insErr.message);
  return (inserted ?? []) as MissionRow[];
}

export type MissionCompletionGrant = {
  mission: MissionRow;
  xp: number;
};

/**
 * Incrementa missões ativas rastreadas por habit_completions (ou habit_id).
 * Retorna missões que acabaram de completar (ainda sem XP aplicado).
 */
export async function bumpMissionsOnHabitComplete(
  _supabase: Client,
  userId: string,
  habitId: string,
): Promise<MissionCompletionGrant[]> {
  const supabase = supabaseAdmin;
  const { data: active, error } = await supabase
    .from("missions")
    .select(MISSION_COLS)
    .eq("user_id", userId)
    .eq("status", "ativa");

  if (error || !active?.length) return [];

  const completed: MissionCompletionGrant[] = [];

  for (const m of active as MissionRow[]) {
    const linked = m.habit_id != null;
    const matches =
      (linked && m.habit_id === habitId) ||
      (!linked && m.track === "habit_completions");
    if (!matches) continue;

    const next = Math.min(m.progresso_alvo, m.progresso_atual + 1);
    const done = next >= m.progresso_alvo;

    const { data: updated, error: uErr } = await supabase
      .from("missions")
      .update({
        progresso_atual: next,
        ...(done
          ? { status: "concluida", completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", m.id)
      .eq("user_id", userId)
      .eq("status", "ativa")
      .select(MISSION_COLS)
      .maybeSingle();

    if (uErr || !updated) continue;
    if (done) {
      completed.push({
        mission: updated as MissionRow,
        xp: (updated as MissionRow).xp_recompensa,
      });
    }
  }

  return completed;
}

/** Aplica XP de missões concluídas + activity + notificação + progress engine. */
export async function grantMissionRewards(
  _supabase: Client,
  userId: string,
  grants: MissionCompletionGrant[],
  before: {
    xp_total: number;
    streak_atual: number;
    streak_maximo: number;
    capitulo_atual: number;
  },
) {
  const supabase = supabaseAdmin;
  if (!grants.length) {
    return {
      xp_total: before.xp_total,
      capitulo_atual: before.capitulo_atual,
      unlockedAchievements: [] as Awaited<
        ReturnType<typeof import("@/lib/progress-engine").evaluateProgress>
      >["unlockedAchievements"],
      chapterChanged: undefined as
        | { from: number; to: number; nome: string }
        | undefined,
      missionXp: 0,
    };
  }

  let xp = before.xp_total;
  for (const g of grants) {
    xp += g.xp;
    await supabase.from("activity_history").insert({
      user_id: userId,
      tipo: "mission_complete",
      descricao: `Missão concluída: ${g.mission.titulo}`,
      xp_delta: g.xp,
      metadata: { mission_id: g.mission.id, kind: g.mission.kind },
    });

    try {
      const { createNotification } = await import("@/notifications/create");
      await createNotification({
        userId,
        tipo: "system",
        titulo: `Missão concluída: ${g.mission.titulo}`,
        corpo: `+${g.xp} XP`,
        metadata: { mission_id: g.mission.id, href: "/journey" },
      });
    } catch (e) {
      console.error("[missions] notify", e);
    }
  }

  const missionXp = grants.reduce((s, g) => s + g.xp, 0);
  await supabase.from("profiles").update({ xp_total: xp }).eq("id", userId);

  const { evaluateProgress } = await import("@/lib/progress-engine");
  const progress = await evaluateProgress(
    supabase,
    userId,
    before,
    {
      xp_total: xp,
      streak_atual: before.streak_atual,
      streak_maximo: before.streak_maximo,
      capitulo_atual: before.capitulo_atual,
    },
  );

  return {
    xp_total: progress.xp_total,
    capitulo_atual: progress.capitulo_atual,
    unlockedAchievements: progress.unlockedAchievements,
    chapterChanged: progress.chapterChanged,
    missionXp,
  };
}
