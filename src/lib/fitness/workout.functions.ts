import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hojeISO, ontemISO } from "@/lib/datetime";
import { evaluateProgress } from "@/lib/progress-engine";
import { EXERCISE_CONSENT_VERSION } from "@/lib/exercise-xp";
import {
  WORKOUTS_PER_DAY_MAX,
  getWorkoutTemplateDef,
  listWorkoutTemplateDefs,
  type WorkoutSetProgress,
  type WorkoutTemplateDef,
} from "@/lib/fitness/workout-templates";
import {
  computeWorkoutXp,
  nextWorkoutCursor,
  workoutIsComplete,
} from "@/lib/fitness/workout-xp";

type Client = SupabaseClient<Database>;

const SESSION_COLS =
  "id, user_id, template_id, template_slug, status, started_at, ended_at, progress, xp_ganho, consent_version, client_meta, created_at";

const TYPE_COLS = "slug, xp_base, xp_por_rep_valida, xp_sessao_max";

async function requireOnboardingComplete(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.onboarding_completo) throw new Error("Complete o onboarding antes.");
}

function parseProgress(raw: Json | null | undefined): WorkoutSetProgress[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as WorkoutSetProgress[];
}

function sessionPayload(
  row: Database["public"]["Tables"]["workout_sessions"]["Row"],
  template: WorkoutTemplateDef,
) {
  const progress = parseProgress(row.progress);
  const cursor = nextWorkoutCursor(template, progress);
  return {
    session: row,
    template,
    progress,
    cursor,
    complete: workoutIsComplete(template, progress),
  };
}

async function loadActiveOrById(userId: string, workoutId: string) {
  const { data, error } = await supabaseAdmin
    .from("workout_sessions")
    .select(SESSION_COLS)
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Treino não encontrado.");
  const template = getWorkoutTemplateDef(data.template_slug);
  if (!template) throw new Error("Template de treino inválido.");
  return { row: data, template };
}

async function loadTypesMap(supabase: Client, slugs: string[]) {
  const unique = [...new Set(slugs)];
  const { data, error } = await supabase
    .from("exercise_types")
    .select(TYPE_COLS)
    .in("slug", unique)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((t) => [t.slug, t]));
  return map;
}

export const listWorkoutTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return listWorkoutTemplateDefs().map((t) => ({
      slug: t.slug,
      titulo: t.titulo,
      descricao: t.descricao,
      difficulty: t.difficulty,
      durationMin: t.durationMin,
      region: t.region,
      stepCount: t.steps.length,
      setCount: t.steps.reduce((n, s) => n + s.sets, 0),
    }));
  });

export const getWorkoutTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ slug: z.string().trim().min(1).max(40) }).parse(i))
  .handler(async ({ data }) => {
    const template = getWorkoutTemplateDef(data.slug);
    if (!template) throw new Error("Treino não encontrado.");
    return template;
  });

export const startWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        slug: z.string().trim().min(1).max(40),
        clientMeta: z.record(z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);

    const template = getWorkoutTemplateDef(data.slug);
    if (!template) throw new Error("Treino não encontrado.");

    const dayStart = `${hojeISO()}T00:00:00.000Z`;
    const { count, error: cErr } = await supabaseAdmin
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("ended_at", dayStart);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) >= WORKOUTS_PER_DAY_MAX) {
      throw new Error(`Limite diário de treinos atingido (${WORKOUTS_PER_DAY_MAX}/dia).`);
    }

    await supabaseAdmin
      .from("workout_sessions")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");

    const { data: tplRow } = await supabaseAdmin
      .from("workout_templates")
      .select("id")
      .eq("slug", template.slug)
      .maybeSingle();

    const { data: session, error } = await supabaseAdmin
      .from("workout_sessions")
      .insert({
        user_id: userId,
        template_id: tplRow?.id ?? null,
        template_slug: template.slug,
        status: "active",
        progress: [] as unknown as Json,
        consent_version: EXERCISE_CONSENT_VERSION,
        client_meta: (data.clientMeta ?? {}) as Json,
      })
      .select(SESSION_COLS)
      .single();
    if (error) throw new Error(error.message);

    return sessionPayload(session, template);
  });

export const getWorkoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ workoutId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { row, template } = await loadActiveOrById(context.userId, data.workoutId);
    return sessionPayload(row, template);
  });

const setMetricsSchema = z.object({
  stepIndex: z.number().int().min(0).max(20),
  setIndex: z.number().int().min(0).max(20),
  reps_validas: z.number().int().min(0).max(500),
  reps_invalidas: z.number().int().min(0).max(500).default(0),
  forma_pct: z.number().min(0).max(100),
  amplitude_media: z.number().min(0).max(100),
  duracao_ms: z.number().int().min(0).max(3_600_000),
});

export const recordWorkoutSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        workoutId: z.string().uuid(),
        metrics: setMetricsSchema,
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { row, template } = await loadActiveOrById(context.userId, data.workoutId);
    if (row.status !== "active") throw new Error("Este treino já foi encerrado.");

    const progress = parseProgress(row.progress);
    const expected = nextWorkoutCursor(template, progress);
    if (!expected) throw new Error("Treino já está completo.");
    if (
      expected.stepIndex !== data.metrics.stepIndex ||
      expected.setIndex !== data.metrics.setIndex
    ) {
      throw new Error("Série fora de ordem — atualize a página.");
    }

    const step = template.steps[expected.stepIndex];
    if (!step) throw new Error("Step inválido.");
    if (data.metrics.reps_validas < 1) {
      throw new Error(
        step.targetHoldSec != null
          ? "Hold insuficiente — sem registrar série."
          : "Sem repetições válidas — sem registrar série.",
      );
    }

    const entry: WorkoutSetProgress = {
      stepIndex: expected.stepIndex,
      setIndex: expected.setIndex,
      exerciseSlug: step.exerciseSlug,
      reps_validas: data.metrics.reps_validas,
      reps_invalidas: data.metrics.reps_invalidas,
      forma_pct: data.metrics.forma_pct,
      amplitude_media: data.metrics.amplitude_media,
      duracao_ms: data.metrics.duracao_ms,
      completedAt: new Date().toISOString(),
    };

    const nextProgress = [...progress, entry];
    const { data: updated, error } = await supabaseAdmin
      .from("workout_sessions")
      .update({ progress: nextProgress as unknown as Json })
      .eq("id", row.id)
      .eq("status", "active")
      .select(SESSION_COLS)
      .single();
    if (error) throw new Error(error.message);

    const cursor = nextWorkoutCursor(template, nextProgress);
    const restMs = step.restMs > 0 && cursor ? step.restMs : 0;

    return {
      ...sessionPayload(updated, template),
      restMs,
      lastSet: entry,
    };
  });

export const completeWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ workoutId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);

    const { row, template } = await loadActiveOrById(userId, data.workoutId);
    if (row.status !== "active") throw new Error("Este treino já foi encerrado.");

    const progress = parseProgress(row.progress);
    if (!workoutIsComplete(template, progress)) {
      throw new Error("Complete todas as séries antes de finalizar.");
    }

    const typesMap = await loadTypesMap(
      supabase as Client,
      template.steps.map((s) => s.exerciseSlug),
    );
    const { xp, perSet } = computeWorkoutXp(template, progress, typesMap);

    const endedAt = new Date().toISOString();
    const { data: completed, error: uErr } = await supabaseAdmin
      .from("workout_sessions")
      .update({
        status: "completed",
        ended_at: endedAt,
        xp_ganho: xp,
      })
      .eq("id", row.id)
      .eq("status", "active")
      .select(SESSION_COLS)
      .single();
    if (uErr) throw new Error(uErr.message);

    const hoje = hojeISO();
    const [profRes, attrsRes] = await Promise.all([
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

    const attrPatch: Record<string, number> = {};
    let novoAttrValor: number | undefined;
    if (attrsRes.data) {
      const current = attrsRes.data.forca ?? 1;
      novoAttrValor = current + 1;
      attrPatch.forca = novoAttrValor;
      const disc = attrsRes.data.disciplina ?? 1;
      attrPatch.disciplina = disc + 1;
    }

    const beforeProgress = {
      xp_total: prof.xp_total,
      streak_atual: prof.streak_atual,
      streak_maximo: prof.streak_maximo,
      capitulo_atual: prof.capitulo_atual ?? 1,
    };

    const totalReps = progress.reduce((n, p) => n + p.reps_validas, 0);

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
        tipo: "workout_session",
        descricao: `${template.titulo}: ${progress.length} séries`,
        xp_delta: xp,
        metadata: {
          workout_id: completed.id,
          template_slug: template.slug,
          sets: progress.length,
          volume: totalReps,
          xp_per_set: perSet,
        } as Json,
      }),
    ]);

    const progressEval = await evaluateProgress(
      supabase as Client,
      userId,
      beforeProgress,
      {
        xp_total: novoXpTotal,
        streak_atual: streak,
        streak_maximo: streakMax,
        capitulo_atual: beforeProgress.capitulo_atual,
      },
      { firstHabitEver: false },
    );

    return {
      session: completed,
      template,
      progress,
      xpGanho: xp + progressEval.xpBonusTotal,
      xpBase: xp,
      streak,
      streakMaximo: streakMax,
      novoXpTotal: progressEval.xp_total,
      unlockedAchievements: progressEval.unlockedAchievements,
      chapterChanged: progressEval.chapterChanged,
      perSet,
    };
  });

export const cancelWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ workoutId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("workout_sessions")
      .update({
        status: "cancelled",
        ended_at: new Date().toISOString(),
        xp_ganho: 0,
      })
      .eq("id", data.workoutId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .select(SESSION_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Nenhum treino ativo para cancelar.");
    return { session };
  });

export const listRecentWorkouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ limit: z.number().int().min(1).max(20).default(5) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("workout_sessions")
      .select(SESSION_COLS)
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => {
      const template = getWorkoutTemplateDef(row.template_slug);
      return {
        ...row,
        titulo: template?.titulo ?? row.template_slug,
        setCount: parseProgress(row.progress).length,
      };
    });
  });
