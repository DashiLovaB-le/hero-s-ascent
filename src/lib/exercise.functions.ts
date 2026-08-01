import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hojeISO, ontemISO } from "@/lib/datetime";
import { evaluateProgress } from "@/lib/progress-engine";
import {
  computeHybridExerciseXp,
  EXERCISE_CONSENT_VERSION,
  PUSHUP_SLUG,
} from "@/lib/exercise-xp";

type Client = SupabaseClient<Database>;

const TYPE_COLS =
  "id, slug, nome, descricao, atributo_padrao, categoria_padrao, xp_base, xp_por_rep_valida, xp_sessao_max, sessoes_por_dia_max, ativo, sort_order";
const SESSION_COLS =
  "id, user_id, exercise_type_id, habit_id, status, started_at, ended_at, consent_version, client_meta, xp_ganho, created_at";
const METRICS_COLS =
  "session_id, reps_validas, reps_invalidas, duracao_ms, amplitude_media, forma_pct, cadencia_rpm, fatigue_rep_index, created_at";
const HABIT_COLS =
  "id, titulo, descricao, xp_recompensa, atributo, categoria, ativo, created_at, exercise_type_id";

async function requireOnboardingComplete(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.onboarding_completo) throw new Error("Complete o onboarding antes.");
}

async function loadExerciseTypeBySlug(supabase: Client, slug: string) {
  const { data: row, error } = await supabase
    .from("exercise_types")
    .select(TYPE_COLS)
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Exercício não encontrado.");
  return row;
}

async function ensureHabitForType(
  supabase: Client,
  userId: string,
  exType: {
    id: string;
    nome: string;
    descricao: string | null;
    atributo_padrao: Database["public"]["Enums"]["attribute_type"];
    categoria_padrao: Database["public"]["Enums"]["goal_category"];
    xp_base: number;
  },
) {
  const { data: existing, error: hErr } = await supabase
    .from("habits")
    .select(HABIT_COLS)
    .eq("user_id", userId)
    .eq("exercise_type_id", exType.id)
    .eq("ativo", true)
    .maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (existing) return { habit: existing, created: false as const };

  const { data: inserted, error: iErr } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      titulo: exType.nome,
      descricao: exType.descricao,
      xp_recompensa: exType.xp_base,
      atributo: exType.atributo_padrao,
      categoria: exType.categoria_padrao,
      exercise_type_id: exType.id,
      ativo: true,
    })
    .select(HABIT_COLS)
    .single();
  if (iErr) throw new Error(iErr.message);
  return { habit: inserted, created: true as const };
}

export const listExerciseTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exercise_types")
      .select(TYPE_COLS)
      .eq("ativo", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getExerciseTypeBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ slug: z.string().trim().min(1).max(40) }).parse(i))
  .handler(async ({ context, data }) => {
    return loadExerciseTypeBySlug(context.supabase as Client, data.slug);
  });

/** Garante hábito validado do usuário para o tipo (1 ativo por tipo). */
export const ensureValidatedExerciseHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(40).default(PUSHUP_SLUG) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);
    const exType = await loadExerciseTypeBySlug(supabase as Client, data.slug);
    const ensured = await ensureHabitForType(supabase as Client, userId, exType);
    return { habit: ensured.habit, exerciseType: exType, created: ensured.created };
  });

export const startExerciseSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        slug: z.string().trim().min(1).max(40).default(PUSHUP_SLUG),
        clientMeta: z.record(z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);

    const exType = await loadExerciseTypeBySlug(supabase as Client, data.slug);
    const ensured = await ensureHabitForType(supabase as Client, userId, exType);
    const habit = ensured.habit;

    const dayStart = `${hojeISO()}T00:00:00.000Z`;
    const { count, error: cErr } = await supabaseAdmin
      .from("exercise_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("exercise_type_id", exType.id)
      .eq("status", "completed")
      .gte("ended_at", dayStart);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) >= exType.sessoes_por_dia_max) {
      throw new Error(
        `Limite diário atingido (${exType.sessoes_por_dia_max} sessões de ${exType.nome}).`,
      );
    }

    await supabaseAdmin
      .from("exercise_sessions")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");

    const { data: session, error } = await supabaseAdmin
      .from("exercise_sessions")
      .insert({
        user_id: userId,
        exercise_type_id: exType.id,
        habit_id: habit.id,
        status: "active",
        consent_version: EXERCISE_CONSENT_VERSION,
        client_meta: (data.clientMeta ?? {}) as Json,
      })
      .select(SESSION_COLS)
      .single();
    if (error) throw new Error(error.message);

    return { session, habit, exerciseType: exType };
  });

const metricsSchema = z.object({
  reps_validas: z.number().int().min(0).max(500),
  reps_invalidas: z.number().int().min(0).max(500).default(0),
  duracao_ms: z.number().int().min(0).max(3_600_000),
  amplitude_media: z.number().min(0).max(100).nullable().optional(),
  forma_pct: z.number().min(0).max(100).nullable().optional(),
  cadencia_rpm: z.number().min(0).max(200).nullable().optional(),
  fatigue_rep_index: z.number().int().min(0).max(500).nullable().optional(),
});

export const completeExerciseSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        metrics: metricsSchema,
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);

    const { data: session, error: sErr } = await supabaseAdmin
      .from("exercise_sessions")
      .select(SESSION_COLS)
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Sessão não encontrada.");
    if (session.status !== "active") throw new Error("Esta sessão já foi encerrada.");

    const { data: exType, error: tErr } = await supabase
      .from("exercise_types")
      .select(TYPE_COLS)
      .eq("id", session.exercise_type_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!exType) throw new Error("Tipo de exercício inválido.");

    const m = data.metrics;
    if (m.reps_validas < 1) {
      await supabaseAdmin
        .from("exercise_sessions")
        .update({
          status: "rejected",
          ended_at: new Date().toISOString(),
          xp_ganho: 0,
        })
        .eq("id", session.id);
      throw new Error("Sessão sem repetições válidas — sem XP.");
    }

    const { xp, breakdown } = computeHybridExerciseXp({
      xpBase: exType.xp_base,
      xpPorRepValida: exType.xp_por_rep_valida,
      xpSessaoMax: exType.xp_sessao_max,
      repsValidas: m.reps_validas,
      formaPct: m.forma_pct ?? null,
    });

    const { error: metErr } = await supabaseAdmin.from("exercise_session_metrics").insert({
      session_id: session.id,
      reps_validas: m.reps_validas,
      reps_invalidas: m.reps_invalidas,
      duracao_ms: m.duracao_ms,
      amplitude_media: m.amplitude_media ?? null,
      forma_pct: m.forma_pct ?? null,
      cadencia_rpm: m.cadencia_rpm ?? null,
      fatigue_rep_index: m.fatigue_rep_index ?? null,
    });
    if (metErr) throw new Error(metErr.message);

    const endedAt = new Date().toISOString();
    const { data: completed, error: uErr } = await supabaseAdmin
      .from("exercise_sessions")
      .update({
        status: "completed",
        ended_at: endedAt,
        xp_ganho: xp,
      })
      .eq("id", session.id)
      .select(SESSION_COLS)
      .single();
    if (uErr) throw new Error(uErr.message);

    // Progressão: XP + streak + attr + habit_completion do dia (1x)
    const hoje = hojeISO();
    const [profRes, attrsRes, priorCountRes, existingComp] = await Promise.all([
      supabase
        .from("profiles")
        .select("xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("attributes")
        .select(
          "user_id, forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      session.habit_id
        ? supabase
            .from("habit_completions")
            .select("id")
            .eq("user_id", userId)
            .eq("habit_id", session.habit_id)
            .eq("dia", hoje)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const prof = profRes.data;
    if (!prof) throw new Error("Perfil não encontrado.");

    const ontemStr = ontemISO();
    let streak = prof.streak_atual;
    if (prof.ultimo_dia_completo === hoje) {
      // mantém
    } else if (prof.ultimo_dia_completo === ontemStr) {
      streak += 1;
    } else {
      streak = 1;
    }
    const streakMax = Math.max(prof.streak_maximo, streak);
    const novoXpTotal = prof.xp_total + xp;
    const attrKey = exType.atributo_padrao;

    const attrPatch: Record<string, number> = {};
    let novoAttrValor: number | undefined;
    if (attrsRes.data && attrKey) {
      const current = ((attrsRes.data as unknown) as Record<string, number>)[attrKey] ?? 1;
      novoAttrValor = current + 1;
      attrPatch[attrKey] = novoAttrValor;
    }

    const beforeProgress = {
      xp_total: prof.xp_total,
      streak_atual: prof.streak_atual,
      streak_maximo: prof.streak_maximo,
      capitulo_atual: prof.capitulo_atual ?? 1,
    };

    if (session.habit_id && !existingComp.data) {
      const { error: hcErr } = await supabaseAdmin.from("habit_completions").insert({
        user_id: userId,
        habit_id: session.habit_id,
        dia: hoje,
        xp_ganho: xp,
      });
      if (hcErr && !/duplicate|unique/i.test(hcErr.message)) throw new Error(hcErr.message);
    }

    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({
          xp_total: novoXpTotal,
          streak_atual: streak,
          streak_maximo: streakMax,
          ultimo_dia_completo: hoje,
        })
        .eq("id", userId),
      Object.keys(attrPatch).length
        ? supabaseAdmin.from("attributes").update(attrPatch as never).eq("user_id", userId)
        : Promise.resolve(),
      supabaseAdmin.from("activity_history").insert({
        user_id: userId,
        tipo: "exercise_session",
        descricao: `${exType.nome}: ${m.reps_validas} reps válidas`,
        xp_delta: xp,
        metadata: {
          session_id: session.id,
          exercise_type: exType.slug,
          reps_validas: m.reps_validas,
          forma_pct: m.forma_pct ?? null,
          xp_breakdown: breakdown,
        } as Json,
      }),
    ]);

    const progress = await evaluateProgress(
      supabase as Client,
      userId,
      beforeProgress,
      {
        xp_total: novoXpTotal,
        streak_atual: streak,
        streak_maximo: streakMax,
        capitulo_atual: beforeProgress.capitulo_atual,
      },
      { firstHabitEver: (priorCountRes.count ?? 0) === 0 },
    );

    const { data: metrics } = await supabase
      .from("exercise_session_metrics")
      .select(METRICS_COLS)
      .eq("session_id", session.id)
      .maybeSingle();

    return {
      session: completed,
      metrics,
      exerciseType: exType,
      xpGanho: xp + progress.xpBonusTotal,
      xpBreakdown: breakdown,
      streak,
      streakMaximo: streakMax,
      novoXpTotal: progress.xp_total,
      atributo: attrKey,
      novoAttrValor,
      unlockedAchievements: progress.unlockedAchievements,
      chapterChanged: progress.chapterChanged,
    };
  });

export const cancelExerciseSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { data: session, error } = await supabaseAdmin
      .from("exercise_sessions")
      .update({
        status: "cancelled",
        ended_at: new Date().toISOString(),
        xp_ganho: 0,
      })
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .eq("status", "active")
      .select(SESSION_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Nenhuma sessão ativa para cancelar.");
    return { session };
  });

export const listRecentExerciseSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        slug: z.string().trim().min(1).max(40).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    let typeId: string | null = null;
    if (data.slug) {
      const { data: t } = await context.supabase
        .from("exercise_types")
        .select("id")
        .eq("slug", data.slug)
        .maybeSingle();
      typeId = t?.id ?? null;
    }

    let q = context.supabase
      .from("exercise_sessions")
      .select(SESSION_COLS)
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(data.limit);

    if (typeId) q = q.eq("exercise_type_id", typeId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const sessions = rows ?? [];
    if (!sessions.length) return [] as Array<(typeof sessions)[number] & {
      metrics: {
        reps_validas: number;
        forma_pct: number | null;
        amplitude_media: number | null;
      } | null;
    }>;

    const ids = sessions.map((s) => s.id);
    const { data: metricsRows } = await context.supabase
      .from("exercise_session_metrics")
      .select("session_id, reps_validas, forma_pct, amplitude_media")
      .in("session_id", ids);
    const bySession = new Map((metricsRows ?? []).map((m) => [m.session_id, m]));

    return sessions.map((s) => ({
      ...s,
      metrics: bySession.get(s.id)
        ? {
            reps_validas: bySession.get(s.id)!.reps_validas,
            forma_pct: bySession.get(s.id)!.forma_pct,
            amplitude_media: bySession.get(s.id)!.amplitude_media,
          }
        : null,
    }));
  });
