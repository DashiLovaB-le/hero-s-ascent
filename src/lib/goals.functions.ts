import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateProgress } from "@/lib/progress-engine";
import { ensureChapterMissions } from "@/lib/missions-core";
import { hojeISO } from "@/lib/datetime";
import { resolveHabitXpReward } from "@/lib/habit-xp";

type Client = SupabaseClient<Database>;

const GOAL_CAT = z.enum([
  "corpo",
  "mente",
  "espirito",
  "prosperidade",
  "relacionamentos",
  "proposito",
]);

const GOAL_STATUS = z.enum(["ativa", "pausada", "concluida"]);

const GOAL_COLS =
  "id, categoria, titulo, descricao, motivo, prazo, status, is_norte, ativo, xp_recompensa, completed_at, created_at";

const ATTR_BY_CAT: Record<
  z.infer<typeof GOAL_CAT>,
  Database["public"]["Enums"]["attribute_type"]
> = {
  corpo: "forca",
  mente: "disciplina",
  espirito: "espirito",
  prosperidade: "prosperidade",
  relacionamentos: "lideranca",
  proposito: "sabedoria",
};

async function requireOnboarding(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.onboarding_completo) throw new Error("Complete o onboarding primeiro.");
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function syncAtivo(status: z.infer<typeof GOAL_STATUS>): boolean {
  return status !== "concluida";
}

async function countNortes(supabase: Client, userId: string, excludeId?: string) {
  let q = supabase
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_norte", true)
    .in("status", ["ativa", "pausada"]);
  if (excludeId) q = q.neq("id", excludeId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type GoalBoardHabit = {
  id: string;
  titulo: string;
  categoria: string | null;
  ativo: boolean;
  doneToday: boolean;
  completions7d: number;
};

export type GoalBoardItem = {
  id: string;
  categoria: z.infer<typeof GOAL_CAT>;
  titulo: string;
  descricao: string | null;
  motivo: string | null;
  prazo: string | null;
  status: z.infer<typeof GOAL_STATUS>;
  is_norte: boolean;
  xp_recompensa: number;
  completed_at: string | null;
  created_at: string;
  habits: GoalBoardHabit[];
  /** 0–100, taxa de conclusão 7d dos hábitos ligados (ou da categoria se nenhum ligado) */
  progressPct: number;
  progressSource: "linked" | "category" | "none";
  overdue: boolean;
};

export type GoalsBoard = {
  goals: GoalBoardItem[];
  nortes: GoalBoardItem[];
  ativas: GoalBoardItem[];
  pausadas: GoalBoardItem[];
  concluidas: GoalBoardItem[];
  missions: Array<{
    id: string;
    titulo: string;
    kind: string;
    status: string;
    progresso: number;
    meta: number;
  }>;
  charlieHint: string;
  unlinkedHabits: Array<{ id: string; titulo: string; categoria: string | null }>;
};

function computeProgress(
  habits: GoalBoardHabit[],
  source: "linked" | "category" | "none",
): { progressPct: number; progressSource: "linked" | "category" | "none" } {
  if (!habits.length) return { progressPct: 0, progressSource: "none" };
  const active = habits.filter((h) => h.ativo);
  if (!active.length) return { progressPct: 0, progressSource: source };
  const rate =
    active.reduce((s, h) => s + Math.min(7, h.completions7d) / 7, 0) / active.length;
  return {
    progressPct: Math.round(rate * 100),
    progressSource: source,
  };
}

function charlieHintFor(board: {
  ativas: GoalBoardItem[];
  nortes: GoalBoardItem[];
}): string {
  const semHabito = board.ativas.filter((g) => g.habits.length === 0);
  if (board.ativas.length === 0) {
    return "Sem metas ativas. Defina 1–3 nortes — eu posso sugerir no chat.";
  }
  if (semHabito.length > 0) {
    return `${semHabito.length} meta(s) sem hábitos ligados. Conecte hábitos ou crie um a partir da meta.`;
  }
  const fracas = board.ativas.filter((g) => g.progressPct < 40);
  if (fracas.length > 0) {
    return `Ritmo baixo em “${fracas[0].titulo}” (${fracas[0].progressPct}% / 7 dias). Ajuste o hábito ou o prazo.`;
  }
  if (board.nortes.length === 0) {
    return "Marque até 3 metas como norte — o que não é norte fica secundário.";
  }
  return "Metas com hábitos e ritmo. Foque no norte; o resto é apoio.";
}

export const getGoalsBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoalsBoard> => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);

    const hoje = hojeISO();
    const since = daysAgoISO(6);

    const { data: profile } = await supabase
      .from("profiles")
      .select("capitulo_atual")
      .eq("id", userId)
      .maybeSingle();
    const capitulo = profile?.capitulo_atual ?? 1;
    try {
      await ensureChapterMissions(supabase as Client, userId, capitulo);
    } catch {
      /* missões opcionais na página */
    }

    const [goalsRes, habitsRes, compsRes, missionsRes] = await Promise.all([
      supabase
        .from("goals")
        .select(GOAL_COLS)
        .eq("user_id", userId)
        .order("is_norte", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("habits")
        .select("id, titulo, categoria, ativo, goal_id")
        .eq("user_id", userId)
        .eq("ativo", true),
      supabase
        .from("habit_completions")
        .select("habit_id, dia")
        .eq("user_id", userId)
        .gte("dia", since)
        .lte("dia", hoje),
      supabase
        .from("missions")
        .select("id, titulo, kind, status, progresso_atual, progresso_alvo")
        .eq("user_id", userId)
        .eq("capitulo", capitulo)
        .eq("status", "ativa")
        .order("kind"),
    ]);

    if (goalsRes.error) throw new Error(goalsRes.error.message);
    if (habitsRes.error) throw new Error(habitsRes.error.message);
    if (compsRes.error) throw new Error(compsRes.error.message);

    const compsByHabit = new Map<string, { n: number; today: boolean }>();
    for (const c of compsRes.data ?? []) {
      const cur = compsByHabit.get(c.habit_id) ?? { n: 0, today: false };
      cur.n += 1;
      if (c.dia === hoje) cur.today = true;
      compsByHabit.set(c.habit_id, cur);
    }

    const habits = (habitsRes.data ?? []).map((h) => {
      const c = compsByHabit.get(h.id);
      return {
        id: h.id,
        titulo: h.titulo,
        categoria: h.categoria,
        ativo: h.ativo,
        goal_id: h.goal_id as string | null,
        doneToday: c?.today ?? false,
        completions7d: c?.n ?? 0,
      };
    });

    const items: GoalBoardItem[] = (goalsRes.data ?? []).map((g) => {
      const linked = habits
        .filter((h) => h.goal_id === g.id)
        .map(({ goal_id: _g, ...rest }) => rest);
      let used = linked;
      let source: "linked" | "category" | "none" = linked.length ? "linked" : "none";
      if (!linked.length) {
        const byCat = habits
          .filter((h) => !h.goal_id && h.categoria === g.categoria)
          .map(({ goal_id: _g, ...rest }) => rest);
        if (byCat.length) {
          used = byCat;
          source = "category";
        }
      }
      const { progressPct, progressSource } = computeProgress(used, source);
      const overdue = !!g.prazo && g.status === "ativa" && g.prazo < hoje;
      return {
        id: g.id,
        categoria: g.categoria,
        titulo: g.titulo,
        descricao: g.descricao,
        motivo: g.motivo,
        prazo: g.prazo,
        status: g.status,
        is_norte: g.is_norte,
        xp_recompensa: g.xp_recompensa,
        completed_at: g.completed_at,
        created_at: g.created_at,
        habits: source === "linked" ? used : linked,
        progressPct,
        progressSource,
        overdue,
      };
    });

    const nortes = items.filter((g) => g.is_norte && g.status !== "concluida");
    const ativas = items.filter((g) => g.status === "ativa");
    const pausadas = items.filter((g) => g.status === "pausada");
    const concluidas = items.filter((g) => g.status === "concluida");

    const boardBase = { ativas, nortes };
    return {
      goals: items,
      nortes,
      ativas,
      pausadas,
      concluidas,
      missions: (missionsRes.data ?? []).map((m) => ({
        id: m.id,
        titulo: m.titulo,
        kind: m.kind,
        status: m.status,
        progresso: m.progresso_atual,
        meta: m.progresso_alvo,
      })),
      charlieHint: charlieHintFor(boardBase),
      unlinkedHabits: habits
        .filter((h) => !h.goal_id)
        .map((h) => ({ id: h.id, titulo: h.titulo, categoria: h.categoria })),
    };
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        categoria: GOAL_CAT,
        titulo: z.string().trim().min(2).max(80),
        motivo: z.string().trim().max(200).optional().nullable(),
        prazo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
        is_norte: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);

    if (data.is_norte) {
      const n = await countNortes(supabase as Client, userId);
      if (n >= 3) throw new Error("No máximo 3 metas norte ativas.");
    }

    const { data: row, error } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        categoria: data.categoria,
        titulo: data.titulo,
        motivo: data.motivo?.trim() || null,
        prazo: data.prazo || null,
        is_norte: data.is_norte ?? false,
        status: "ativa",
        ativo: true,
      })
      .select(GOAL_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().trim().min(2).max(80).optional(),
        motivo: z.string().trim().max(200).optional().nullable(),
        prazo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
        is_norte: z.boolean().optional(),
        status: GOAL_STATUS.optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);

    if (data.is_norte === true) {
      const n = await countNortes(supabase as Client, userId, data.id);
      if (n >= 3) throw new Error("No máximo 3 metas norte ativas.");
    }

    const patch: Database["public"]["Tables"]["goals"]["Update"] = {};
    if (data.titulo != null) patch.titulo = data.titulo;
    if (data.motivo !== undefined) patch.motivo = data.motivo?.trim() || null;
    if (data.prazo !== undefined) patch.prazo = data.prazo;
    if (data.is_norte != null) patch.is_norte = data.is_norte;
    if (data.status) {
      patch.status = data.status;
      patch.ativo = syncAtivo(data.status);
      if (data.status === "concluida") {
        patch.completed_at = new Date().toISOString();
      } else {
        patch.completed_at = null;
      }
    }

    const { data: row, error } = await supabase
      .from("goals")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(GOAL_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const completeGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);

    const { data: goal, error: gErr } = await supabase
      .from("goals")
      .select(GOAL_COLS)
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!goal) throw new Error("Meta não encontrada.");
    if (goal.status === "concluida") throw new Error("Meta já concluída.");

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("xp_total, streak_atual, streak_maximo, capitulo_atual")
      .eq("id", userId)
      .single();
    if (pErr || !prof) throw new Error(pErr?.message ?? "Perfil não encontrado.");

    const xpGain = goal.xp_recompensa || 40;
    const before = {
      xp_total: prof.xp_total,
      streak_atual: prof.streak_atual,
      streak_maximo: prof.streak_maximo,
      capitulo_atual: prof.capitulo_atual,
    };
    const afterXp = prof.xp_total + xpGain;

    const { error: upGoal } = await supabaseAdmin
      .from("goals")
      .update({
        status: "concluida",
        ativo: false,
        completed_at: new Date().toISOString(),
        is_norte: false,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (upGoal) throw new Error(upGoal.message);

    const { error: upProf } = await supabaseAdmin
      .from("profiles")
      .update({ xp_total: afterXp })
      .eq("id", userId);
    if (upProf) throw new Error(upProf.message);

    await supabaseAdmin.from("activity_history").insert({
      user_id: userId,
      tipo: "goal_complete",
      descricao: `Meta conquistada: ${goal.titulo}`,
      xp_delta: xpGain,
      metadata: { goal_id: goal.id, categoria: goal.categoria },
    });

    await supabaseAdmin.from("mentor_memories").insert({
      user_id: userId,
      content: `Conquistou a meta [${goal.categoria}] "${goal.titulo}"${
        goal.motivo ? ` — ${goal.motivo.slice(0, 120)}` : ""
      }.`,
      importance: 4,
    });

    // Manter no máx. ~20 memórias
    const { data: allMem } = await supabaseAdmin
      .from("mentor_memories")
      .select("id, importance, created_at")
      .eq("user_id", userId)
      .order("importance", { ascending: true })
      .order("created_at", { ascending: true });
    if (allMem && allMem.length > 20) {
      const drop = allMem.slice(0, allMem.length - 20).map((m) => m.id);
      if (drop.length) await supabaseAdmin.from("mentor_memories").delete().in("id", drop);
    }

    const progress = await evaluateProgress(supabase as Client, userId, before, {
      ...before,
      xp_total: afterXp,
    });

    return {
      xpGain,
      xpTotal: progress.xp_total,
      unlockedAchievements: progress.unlockedAchievements,
      chapterChanged: progress.chapterChanged,
    };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const linkHabitToGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        habitId: z.string().uuid(),
        goalId: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);

    if (data.goalId) {
      const { data: g } = await supabase
        .from("goals")
        .select("id, status")
        .eq("id", data.goalId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!g) throw new Error("Meta não encontrada.");
      if (g.status === "concluida") throw new Error("Não dá para ligar hábito a meta concluída.");
    }

    const { error } = await supabase
      .from("habits")
      .update({ goal_id: data.goalId })
      .eq("id", data.habitId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const createHabitForGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        goalId: z.string().uuid(),
        titulo: z.string().trim().min(2).max(80),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboarding(supabase as Client, userId);

    const { data: goal, error: gErr } = await supabase
      .from("goals")
      .select("id, categoria, status, titulo")
      .eq("id", data.goalId)
      .eq("user_id", userId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!goal) throw new Error("Meta não encontrada.");
    if (goal.status === "concluida") throw new Error("Meta já concluída.");

    const xp = await resolveHabitXpReward();
    const { data: row, error } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        titulo: data.titulo,
        descricao: `Sustenta a meta: ${goal.titulo}`,
        xp_recompensa: xp,
        atributo: ATTR_BY_CAT[goal.categoria],
        categoria: goal.categoria,
        goal_id: goal.id,
        ativo: true,
      })
      .select("id, titulo, categoria, goal_id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
