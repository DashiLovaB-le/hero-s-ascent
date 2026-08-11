import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { chatCompletion } from "@/mentor/openrouter";
import {
  buildMentorContextBlock,
  challengeFollowUpUserText,
  defaultObjectiveForHero,
  detectPresenceKind,
  habitSuggestionFollowUpUserText,
  habitTitlesConflict,
  parseMentorAiPayload,
  presenceUserPrompt,
  type ChallengeOutcome,
  type MentorPresenceKind,
} from "@/mentor/context";
import { getMentorSystemPromptForUser } from "@/mentor/prompt.server";
import { fetchWeatherForCoords, formatWeatherForMentor } from "@/lib/weather";
import { mlScoresFromRow, recomputeUserMl } from "@/lib/ml/recompute";
import {
  applyChallengeGuardrails,
  decideChallengePolicy,
  scoresFromMlRow,
} from "@/lib/ml/adaptive";
import { loadCheckinsForMentor } from "@/lib/checkins.functions";
import { addDaysToDateKey, calendarDateInTz, hourInTz, hojeISO } from "@/lib/datetime";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assembleMentorGoals } from "@/lib/mentor-goals";
import { resolveHabitXpReward } from "@/lib/habit-xp";
import { summarizeChessForMentor } from "@/mentor/chess-context";

type Client = SupabaseClient<Database>;

const MSG_COLS = "id, role, kind, content, metadata, created_at";
const CHALLENGE_COLS =
  "id, user_id, titulo, descricao, duracao_dias, xp_recompensa, titulo_recompensa, status, starts_at, ends_at, completed_at, created_at, habit_id, completions_required";
const OBJECTIVE_COLS = "user_id, titulo, motivo, source, ativo, created_at, updated_at";
const HABIT_COLS = "id, titulo, descricao, xp_recompensa, atributo, categoria, ativo, created_at";
const MAX_ACTIVE_HABITS_FOR_SUGGESTION = 14;

function daysBetween(isoA: string, isoB: string) {
  const a = new Date(`${isoA}T12:00:00`).getTime();
  const b = new Date(`${isoB}T12:00:00`).getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

async function expireOverdueChallenges(
  _supabase: Client,
  userId: string,
): Promise<Array<{ id: string; titulo: string }>> {
  const { expireUserOverdueChallengesAndNotify } = await import("@/notifications/jobs");
  const result = await expireUserOverdueChallengesAndNotify(supabaseAdmin, userId);
  return result.expired;
}

async function pruneMemories(supabase: Client, userId: string) {
  const { data: allMem } = await supabase
    .from("mentor_memories")
    .select("id, importance, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: true })
    .order("created_at", { ascending: true });

  if (allMem && allMem.length > 20) {
    const drop = allMem.slice(0, allMem.length - 20).map((m) => m.id);
    if (drop.length) await supabase.from("mentor_memories").delete().in("id", drop);
  }
}

async function ensureObjective(
  supabase: Client,
  userId: string,
  nome: string,
  xp: number,
): Promise<{ titulo: string; motivo: string | null }> {
  const { data: existing } = await supabase
    .from("mentor_objectives")
    .select(OBJECTIVE_COLS)
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (existing) {
    return { titulo: existing.titulo, motivo: existing.motivo };
  }

  const def = defaultObjectiveForHero(nome, xp);
  const { data: inserted, error } = await supabase
    .from("mentor_objectives")
    .upsert(
      {
        user_id: userId,
        titulo: def.titulo,
        motivo: def.motivo,
        source: "system",
        ativo: true,
      },
      { onConflict: "user_id" },
    )
    .select(OBJECTIVE_COLS)
    .single();

  if (error || !inserted) {
    console.error("[mentor] objective upsert", error?.message);
    return def;
  }
  return { titulo: inserted.titulo, motivo: inserted.motivo };
}

type ChallengeRow = Database["public"]["Tables"]["mentor_challenges"]["Row"];

async function enrichChallenges(supabase: Client, userId: string, challenges: ChallengeRow[]) {
  const habitIds = challenges.map((c) => c.habit_id).filter(Boolean) as string[];
  let habitTitles: Record<string, string> = {};
  const completionCounts: Record<string, number> = {};

  if (habitIds.length) {
    const { data: habits } = await supabase.from("habits").select("id, titulo").in("id", habitIds);
    habitTitles = Object.fromEntries((habits ?? []).map((h) => [h.id, h.titulo]));

    for (const c of challenges) {
      if (!c.habit_id || !c.starts_at) continue;
      const startDay = c.starts_at.slice(0, 10);
      const { count } = await supabase
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("habit_id", c.habit_id)
        .gte("dia", startDay);
      completionCounts[c.id] = count ?? 0;
    }
  }

  return challenges.map((c) => ({
    ...c,
    habit_titulo: c.habit_id ? (habitTitles[c.habit_id] ?? null) : null,
    completions_done: c.habit_id ? (completionCounts[c.id] ?? 0) : null,
  }));
}

async function findPendingQuestionFromDb(supabase: Client, userId: string) {
  const { data: msgs } = await supabase
    .from("mentor_messages")
    .select("id, role, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);

  const list = [...(msgs ?? [])].reverse();
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.role !== "assistant") continue;
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    if (meta.question_answered) break;
    const pq = meta.pending_question;
    if (pq && typeof pq === "object") {
      const q = pq as Record<string, unknown>;
      if (typeof q.prompt === "string" && q.prompt.trim()) {
        const options = Array.isArray(q.options)
          ? q.options.filter((o): o is string => typeof o === "string")
          : null;
        return {
          prompt: q.prompt,
          options: options && options.length >= 2 ? options : null,
          messageId: m.id,
        };
      }
    }
    break;
  }
  return null;
}

async function findPendingHabitSuggestionFromDb(supabase: Client, userId: string) {
  const { data: msgs } = await supabase
    .from("mentor_messages")
    .select("id, role, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(24);

  for (const m of msgs ?? []) {
    if (m.role !== "assistant") continue;
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    if (meta.habit_suggestion_answered) continue;
    const hs = meta.pending_habit_suggestion;
    if (!hs || typeof hs !== "object") continue;
    const h = hs as Record<string, unknown>;
    if (typeof h.titulo !== "string" || !h.titulo.trim()) continue;
    if (typeof h.atributo !== "string") continue;
    return {
      titulo: h.titulo,
      descricao: typeof h.descricao === "string" ? h.descricao : null,
      xp_recompensa: Math.min(50, Math.max(5, Number(h.xp_recompensa) || 10)),
      atributo: h.atributo,
      categoria: typeof h.categoria === "string" ? h.categoria : null,
      messageId: m.id,
    };
  }
  return null;
}

async function hadStructuredQuestionToday(supabase: Client, userId: string) {
  const today = hojeISO();
  const { data } = await supabase
    .from("mentor_messages")
    .select("metadata, created_at")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .limit(40);

  return (data ?? []).some((m) => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    return Boolean(meta.pending_question);
  });
}

async function loadJourneySnapshot(supabase: Client, userId: string) {
  const hoje = hojeISO();
  const from21Iso = addDaysToDateKey(hoje, -21);

  await expireOverdueChallenges(supabase, userId);

  let profileRes = await supabase
    .from("profiles")
    .select(
      "id, nome, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, created_at, location_label, location_lat, location_lon, location_timezone, charlie_personality",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileRes.error && /charlie_personality/i.test(profileRes.error.message)) {
    profileRes = await supabase
      .from("profiles")
      .select(
        "id, nome, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, created_at, location_label, location_lat, location_lon, location_timezone",
      )
      .eq("id", userId)
      .maybeSingle();
  }

  if (profileRes.error && /location_/i.test(profileRes.error.message)) {
    profileRes = await supabase
      .from("profiles")
      .select(
        "id, nome, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, created_at",
      )
      .eq("id", userId)
      .maybeSingle();
  }

  const [
    attrsRes,
    habitsRes,
    goalsRes,
    todayRes,
    compsRes,
    memRes,
    chalRes,
    lastMsgRes,
    objRes,
    mlRes,
    chessRes,
    alterEgoRes,
  ] = await Promise.all([
      supabase
        .from("attributes")
        .select(
          "forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("habits")
        .select("id, titulo, descricao, atributo, categoria, goal_id, ativo")
        .eq("user_id", userId)
        .eq("ativo", true),
      supabase
        .from("goals")
        .select(
          "id, titulo, categoria, status, is_norte, motivo, prazo, completed_at",
        )
        .eq("user_id", userId)
        .in("status", ["ativa", "pausada", "concluida"])
        .order("is_norte", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("habit_completions").select("habit_id").eq("user_id", userId).eq("dia", hoje),
      supabase
        .from("habit_completions")
        .select("habit_id, dia")
        .eq("user_id", userId)
        .gte("dia", from21Iso),
      supabase
        .from("mentor_memories")
        .select("content, importance")
        .eq("user_id", userId)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("mentor_challenges")
        .select("titulo, descricao, status")
        .eq("user_id", userId)
        .eq("status", "ativo"),
      supabase
        .from("mentor_messages")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("mentor_objectives")
        .select("titulo, motivo")
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle(),
      supabase.from("user_ml_scores").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("charlie_chess_games")
        .select("status, result_reason, updated_at, created_at")
        .eq("user_id", userId)
        .in("status", ["won", "lost", "draw"])
        .gte("updated_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
        .order("updated_at", { ascending: false })
        .limit(40),
      supabase
        .from("hero_alter_ego")
        .select("nome, codigo, virtudes, inimigo, resumo, active")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  for (const [label, res] of [
    ["profiles", profileRes],
    ["attributes", attrsRes],
    ["habits", habitsRes],
    ["goals", goalsRes],
    ["habit_completions_today", todayRes],
    ["habit_completions_21", compsRes],
    ["mentor_memories", memRes],
    ["mentor_challenges", chalRes],
    ["mentor_messages", lastMsgRes],
  ] as const) {
    if (res.error) throw new Error(`Falha ao carregar ${label}: ${res.error.message}`);
  }

  // mentor_objectives may not exist until migration — treat as optional
  if (objRes.error && !objRes.error.message.includes("does not exist")) {
    console.error("[mentor] objectives", objRes.error.message);
  }

  // user_ml_scores optional until migration
  if (mlRes.error && !/does not exist|user_ml_scores/i.test(mlRes.error.message)) {
    console.error("[mentor] ml scores", mlRes.error.message);
  }

  // charlie_chess_games optional until migration
  if (chessRes.error && !/does not exist|charlie_chess_games/i.test(chessRes.error.message)) {
    console.error("[mentor] chess games", chessRes.error.message);
  }

  // hero_alter_ego optional until migration
  if (
    alterEgoRes.error &&
    !/does not exist|hero_alter_ego/i.test(alterEgoRes.error.message)
  ) {
    console.error("[mentor] alter ego", alterEgoRes.error.message);
  }

  if (!profileRes.data || !attrsRes.data) {
    throw new Error("Perfil incompleto. Abra a Jornada antes de falar com o Mentor.");
  }

  let daysSinceLastVisit: number | null = null;
  if (lastMsgRes.data?.created_at) {
    daysSinceLastVisit = daysBetween(lastMsgRes.data.created_at.slice(0, 10), hoje);
  } else if (profileRes.data.ultimo_dia_completo) {
    daysSinceLastVisit = daysBetween(profileRes.data.ultimo_dia_completo, hoje);
  }

  const objective =
    objRes.data ??
    (await ensureObjective(
      supabase,
      userId,
      profileRes.data.nome,
      profileRes.data.xp_total,
    ));

  const pending = await findPendingQuestionFromDb(supabase, userId);
  const askedToday = await hadStructuredQuestionToday(supabase, userId);
  const allowQuestion = !pending && !askedToday;
  const pendingHabit = await findPendingHabitSuggestionFromDb(supabase, userId);
  const habitsCount = (habitsRes.data ?? []).length;
  const allowHabitSuggestion =
    !pendingHabit && habitsCount < MAX_ACTIVE_HABITS_FOR_SUGGESTION;

  let weather = null as Awaited<ReturnType<typeof fetchWeatherForCoords>>;
  const profileLoc = profileRes.data as typeof profileRes.data & {
    location_label?: string | null;
    location_lat?: number | null;
    location_lon?: number | null;
    location_timezone?: string | null;
  };
  const lat = profileLoc.location_lat;
  const lon = profileLoc.location_lon;
  if (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    weather = await fetchWeatherForCoords({
      lat,
      lon,
      label: profileLoc.location_label?.trim() || "sua região",
      timezone: profileLoc.location_timezone,
    });
  }

  let mlScores = mlRes.error ? null : mlScoresFromRow(mlRes.data);
  if (!mlScores) {
    try {
      const computed = await recomputeUserMl(supabase, userId, hoje);
      mlScores = computed.scores;
    } catch (e) {
      console.warn("[mentor] ml recompute on snapshot", e);
    }
  }

  const chessSummary = chessRes.error
    ? null
    : summarizeChessForMentor(chessRes.data ?? [], {
        timezone: profileLoc.location_timezone,
      }).line;

  const alterEgoRow =
    !alterEgoRes.error && alterEgoRes.data && alterEgoRes.data.active !== false
      ? {
          nome: String(alterEgoRes.data.nome ?? ""),
          codigo: Array.isArray(alterEgoRes.data.codigo)
            ? alterEgoRes.data.codigo.map(String)
            : [],
          virtudes: Array.isArray(alterEgoRes.data.virtudes)
            ? alterEgoRes.data.virtudes.map(String)
            : [],
          inimigo: String(alterEgoRes.data.inimigo ?? ""),
          resumo: String(alterEgoRes.data.resumo ?? ""),
        }
      : null;

  const checkins = await loadCheckinsForMentor(supabase, userId, 5);
  let checkinsSummary: string | null = null;
  let identidadeHoje: string | null = null;
  if (checkins.length) {
    const lines = checkins.slice(0, 3).map((c) => {
      const parts = [`dia ${c.dia}`];
      if (c.sono_horas != null) parts.push(`sono ${c.sono_horas}h`);
      if (c.sono_qualidade != null) parts.push(`qualidade ${c.sono_qualidade}/5`);
      if (c.energia != null) parts.push(`energia ${c.energia}/5`);
      if (c.humor != null) parts.push(`humor ${c.humor}/5`);
      if ((c as { identidade_hoje?: string | null }).identidade_hoje) {
        parts.push(`identidade ${(c as { identidade_hoje: string }).identidade_hoje}`);
      }
      return parts.join(", ");
    });
    checkinsSummary = `CHECK-INS (mais recentes): ${lines.join(" | ")}`;
    const todayRow = checkins.find((c) => c.dia === hoje);
    identidadeHoje =
      (todayRow as { identidade_hoje?: string | null } | undefined)?.identidade_hoje ?? null;
  }

  const {
    getIdentityProofStats,
    listRecentIdentityProofs,
    formatIdentityProofsForMentor,
  } = await import("@/lib/identity-proofs");
  const proofStats = await getIdentityProofStats(supabase, userId, hoje);
  const recentProofs = await listRecentIdentityProofs(supabase, userId, 5);
  const identityProofsSummary = formatIdentityProofsForMentor({
    alterEgoNome: alterEgoRow?.nome,
    stats: proofStats,
    recentLabels: recentProofs.map((p) => p.label),
    identidadeHoje,
  });

  const since14 = `${addDaysToDateKey(hoje, -14)}T00:00:00.000Z`;
  const since7 = addDaysToDateKey(hoje, -6);
  const goalRows = (goalsRes.data ?? []).filter((g) => {
    if (g.status === "ativa" || g.status === "pausada") return true;
    if (g.status === "concluida" && g.completed_at && g.completed_at >= since14) return true;
    return false;
  });
  const comps7d = (compsRes.data ?? []).filter((c) => c.dia >= since7);
  const mentorGoals = assembleMentorGoals({
    goals: goalRows.map((g) => ({
      id: g.id,
      titulo: g.titulo,
      categoria: g.categoria,
      status: g.status as "ativa" | "pausada" | "concluida",
      is_norte: Boolean(g.is_norte),
      motivo: g.motivo ?? null,
      prazo: g.prazo ?? null,
      completed_at: g.completed_at ?? null,
    })),
    habits: (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      titulo: h.titulo,
      categoria: (h as { categoria?: string | null }).categoria ?? null,
      goal_id: (h as { goal_id?: string | null }).goal_id ?? null,
      ativo: true,
    })),
    completions7d: comps7d,
    hoje,
  });

  return {
    profile: profileRes.data,
    attributes: attrsRes.data,
    habits: (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      titulo: h.titulo,
      atributo: h.atributo,
      descricao: (h as { descricao?: string | null }).descricao ?? null,
    })),
    goals: mentorGoals,
    completedTodayIds: (todayRes.data ?? []).map((r) => r.habit_id),
    completionsLast21: compsRes.data ?? [],
    memories: memRes.data ?? [],
    activeChallenges: chalRes.data ?? [],
    daysSinceLastVisit,
    objective,
    pendingQuestion: pending,
    allowQuestion,
    pendingHabitSuggestion: Boolean(pendingHabit),
    allowHabitSuggestion,
    weather,
    mlScores,
    checkinsSummary,
    chessSummary,
    alterEgo: alterEgoRow,
    identityProofsSummary,
  };
}

async function callMentor(
  supabase: Client,
  userId: string,
  opts: {
    kind: Exclude<MentorPresenceKind, null> | "chat" | "challenge" | "insight";
    userText: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    cyclePhaseHint?: string | null;
    challengeOutcome?: ChallengeOutcome | null;
  },
) {
  const snap = await loadJourneySnapshot(supabase, userId);
  const weatherLine = formatWeatherForMentor(snap.weather);

  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { count: created48h } = await supabase
    .from("mentor_challenges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since48h);

  const adaptiveScores = scoresFromMlRow(
    snap.mlScores
      ? {
          risco_streak: snap.mlScores.risco_streak,
          risco_abandono: snap.mlScores.risco_abandono,
          weekday_weakest: snap.mlScores.weekday_weakest,
          explicacao: snap.mlScores.explicacao,
        }
      : null,
  );

  const challengePolicy = decideChallengePolicy({
    scores: adaptiveScores,
    activeChallengeCount: snap.activeChallenges.length,
    challengesCreatedLast48h: created48h ?? 0,
  });

  const promptMeta = await getMentorSystemPromptForUser(userId);

  const contextBlock = buildMentorContextBlock({
    nome: snap.profile.nome,
    xp_total: snap.profile.xp_total,
    streak_atual: snap.profile.streak_atual,
    streak_maximo: snap.profile.streak_maximo,
    capitulo_atual: snap.profile.capitulo_atual,
    ultimo_dia_completo: snap.profile.ultimo_dia_completo,
    created_at: snap.profile.created_at,
    attributes: snap.attributes,
    habits: snap.habits,
    goals: snap.goals,
    completionsLast21: snap.completionsLast21,
    completedTodayIds: snap.completedTodayIds,
    memories: snap.memories,
    activeChallenges: snap.activeChallenges,
    daysSinceLastVisit: snap.daysSinceLastVisit,
    objective: snap.objective,
    pendingQuestionToday: Boolean(snap.pendingQuestion),
    allowQuestion: snap.allowQuestion,
    pendingHabitSuggestion: snap.pendingHabitSuggestion,
    allowHabitSuggestion: snap.allowHabitSuggestion,
    weather: snap.weather
      ? { label: snap.weather.label, summaryLine: weatherLine }
      : null,
    mlScores: snap.mlScores,
    challengePolicyHint: challengePolicy.promptHint,
    checkinsSummary: snap.checkinsSummary,
    chessSummary: snap.chessSummary,
    personality: { slug: promptMeta.slug, name: promptMeta.name },
    alterEgo: snap.alterEgo,
    identityProofsSummary: snap.identityProofsSummary,
    cyclePhaseHint: opts.cyclePhaseHint ?? null,
  });

  const systemPrompt = promptMeta.prompt;

  let wisdomBlock = "";
  try {
    const { resolveWisdomBlock } = await import("@/lib/wisdom.functions");
    wisdomBlock = await resolveWisdomBlock({
      userText: opts.userText,
      personalitySlug: promptMeta.slug,
      contextBlock,
    });
  } catch (e) {
    console.warn("[mentor] wisdom block skipped", e);
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    {
      role: "system" as const,
      content: `CONTEXTO ATUAL DA JORNADA\n${contextBlock}${
        wisdomBlock ? `\n\n${wisdomBlock}` : ""
      }`,
    },
    ...opts.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: opts.userText },
  ];

  let { content, model, finishReason } = await chatCompletion({
    messages,
    jsonMode: true,
    temperature: 0.8,
    maxTokens: 1200,
    usageContext: { userId, source: `mentor:${opts.kind}` },
  });

  // Truncamento (max tokens) ou JSON claramente incompleto → uma nova tentativa mais curta
  const looksTruncated =
    finishReason === "length" ||
    (content.trim().startsWith("{") &&
      (!content.includes('"message"') ||
        /(?:<\/){3,}/.test(content) ||
        (content.match(/"/g) ?? []).length % 2 === 1));

  if (looksTruncated) {
    console.warn("[mentor] resposta truncada/corrompida — retry");
    const retry = await chatCompletion({
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "Sua resposta anterior veio incompleta. Reenvie o JSON completo e curto: message (máx 4 frases), question null ou prompt curto, challenge null, habit_suggestion null.",
        },
      ],
      jsonMode: true,
      temperature: 0.5,
      maxTokens: 900,
      usageContext: { userId, source: `mentor:${opts.kind}:retry` },
    });
    content = retry.content;
    model = retry.model;
    finishReason = retry.finishReason;
  }

  let payload = parseMentorAiPayload(content);

  const metadata: Record<string, Json> = {
    model,
    kind: opts.kind,
    has_challenge: Boolean(payload.challenge),
    has_habit_suggestion: Boolean(payload.habit_suggestion),
  };
  if (opts.challengeOutcome) {
    metadata.cycle = "verify_learn";
    metadata.challenge_outcome = opts.challengeOutcome;
  }

  // Objective update from AI (only if none or AI proposes and we allow replace when source system)
  if (payload.objective?.titulo) {
    await supabase.from("mentor_objectives").upsert(
      {
        user_id: userId,
        titulo: payload.objective.titulo,
        motivo: payload.objective.motivo,
        source: "ai",
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  let pendingHabitSuggestion: {
    titulo: string;
    descricao: string | null;
    xp_recompensa: number;
    atributo: string;
    categoria: string | null;
    messageId: string;
  } | null = null;

  if (payload.habit_suggestion) {
    const suggestion = payload.habit_suggestion;
    const duplicate = snap.habits.some((h) => habitTitlesConflict(h.titulo, suggestion.titulo));
    if (!snap.allowHabitSuggestion) {
      metadata.habit_suggestion_blocked = true;
      metadata.habit_suggestion_block_reason = snap.pendingHabitSuggestion
        ? "pending_exists"
        : "habit_cap";
    } else if (duplicate) {
      metadata.habit_suggestion_blocked = true;
      metadata.habit_suggestion_block_reason = "duplicate_title";
    } else {
      metadata.pending_habit_suggestion = {
        titulo: suggestion.titulo,
        descricao: suggestion.descricao,
        xp_recompensa: suggestion.xp_recompensa,
        atributo: suggestion.atributo,
        categoria: suggestion.categoria,
      };
      // messageId filled after insert
      pendingHabitSuggestion = {
        titulo: suggestion.titulo,
        descricao: suggestion.descricao,
        xp_recompensa: suggestion.xp_recompensa,
        atributo: suggestion.atributo,
        categoria: suggestion.categoria,
        messageId: "",
      };
      // Never also create a challenge in the same turn
      payload.challenge = null;
      metadata.has_challenge = false;
    }
  }

  let challengeRow = null;
  if (payload.challenge && !pendingHabitSuggestion) {
    const guarded = applyChallengeGuardrails(
      {
        titulo: payload.challenge.titulo,
        descricao: payload.challenge.descricao,
        duracao_dias: payload.challenge.duracao_dias,
        xp_recompensa: payload.challenge.xp_recompensa,
        titulo_recompensa: payload.challenge.titulo_recompensa,
        habit_id: payload.challenge.habit_id,
        completions_required: payload.challenge.completions_required,
      },
      challengePolicy,
    );

    if (guarded && snap.activeChallenges.length < challengePolicy.maxActive) {
      const habitOk =
        guarded.habit_id && snap.habits.some((h) => h.id === guarded.habit_id)
          ? guarded.habit_id
          : null;

      const ends = new Date();
      ends.setDate(ends.getDate() + guarded.duracao_dias);
      const { data: chal, error: chalErr } = await supabaseAdmin
        .from("mentor_challenges")
        .insert({
          user_id: userId,
          titulo: guarded.titulo,
          descricao: guarded.descricao,
          duracao_dias: guarded.duracao_dias,
          xp_recompensa: guarded.xp_recompensa,
          titulo_recompensa: guarded.titulo_recompensa ?? null,
          status: "ativo",
          ends_at: ends.toISOString(),
          habit_id: habitOk,
          completions_required: guarded.completions_required ?? 1,
        })
        .select(CHALLENGE_COLS)
        .single();
      if (chalErr) {
        console.error("[mentor] challenge insert", chalErr.message);
      } else if (chal) {
        const [enriched] = await enrichChallenges(supabase, userId, [chal]);
        challengeRow = enriched;
        metadata.challenge_id = chal.id;
        metadata.adaptive_challenge = true;
        metadata.adaptive_reasons = challengePolicy.reasons;
        const { createNotification } = await import("@/notifications/create");
        const codigoLine = snap.alterEgo?.codigo?.[0]?.trim() || null;
        await createNotification({
          userId,
          tipo: "mentor_challenge",
          titulo: "Novo desafio do Charlie",
          corpo: chal.titulo,
          metadata: {
            challenge_id: chal.id,
            href: "/mentor",
            ml_guided: true,
            ...(codigoLine
              ? {
                  identity_codigo: codigoLine,
                  identity_inimigo: snap.alterEgo?.inimigo || null,
                  alter_ego_nome: snap.alterEgo?.nome ?? null,
                }
              : {}),
          },
        });
      }
    } else if (payload.challenge && !guarded) {
      metadata.challenge_blocked = true;
      metadata.adaptive_reasons = challengePolicy.reasons;
    }
  }

  if (payload.memory) {
    const { error: memErr } = await supabase.from("mentor_memories").insert({
      user_id: userId,
      content: payload.memory.slice(0, 400),
      importance: payload.memory_importance,
    });
    if (memErr) console.error("[mentor] memory insert", memErr.message);
    await pruneMemories(supabase, userId);
  }

  if (payload.question && snap.allowQuestion) {
    metadata.pending_question = {
      prompt: payload.question.prompt,
      options: payload.question.options,
    };
  }

  metadata.has_habit_suggestion = Boolean(pendingHabitSuggestion);
  metadata.has_challenge = Boolean(challengeRow);

  const { data: assistantMsg, error: aErr } = await supabase
    .from("mentor_messages")
    .insert({
      user_id: userId,
      role: "assistant",
      kind: opts.kind === "chat" ? "chat" : opts.kind,
      content: payload.message,
      metadata: metadata as Json,
    })
    .select(MSG_COLS)
    .single();

  if (aErr || !assistantMsg) {
    throw new Error(`Falha ao salvar resposta do Mentor: ${aErr?.message ?? "desconhecido"}`);
  }

  if (pendingHabitSuggestion) {
    pendingHabitSuggestion = { ...pendingHabitSuggestion, messageId: assistantMsg.id };
    const { createNotification } = await import("@/notifications/create");
    await createNotification({
      userId,
      tipo: "mentor_presence",
      titulo: "Charlie sugeriu um hábito",
      corpo: pendingHabitSuggestion.titulo,
      metadata: {
        habit_suggestion: true,
        message_id: assistantMsg.id,
        href: "/mentor",
      },
    });
  }

  return {
    assistantMsg,
    challenge: challengeRow,
    payload,
    objective: payload.objective ?? snap.objective,
    pendingQuestion:
      payload.question && snap.allowQuestion
        ? {
            prompt: payload.question.prompt,
            options: payload.question.options,
            messageId: assistantMsg.id,
          }
        : null,
    pendingHabitSuggestion,
  };
}

export const getMentorThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const expired = await expireOverdueChallenges(supabase, userId);
    const expireFollowUp = await maybeExpireCycleFollowUpOnVisit(supabase, userId, expired);

    const [msgsRes, chalRes, profileRes, objRes, mlRes] = await Promise.all([
      supabase
        .from("mentor_messages")
        .select(MSG_COLS)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(120),
      supabase
        .from("mentor_challenges")
        .select(CHALLENGE_COLS)
        .eq("user_id", userId)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("profiles")
        .select("nome, onboarding_completo, xp_total, charlie_personality")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("mentor_objectives")
        .select(OBJECTIVE_COLS)
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle(),
      supabase
        .from("user_ml_scores")
        .select("risco_streak, risco_abandono, weekday_weakest, explicacao")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    let profileData = profileRes.data;
    if (profileRes.error && /charlie_personality/i.test(profileRes.error.message)) {
      const fallback = await supabase
        .from("profiles")
        .select("nome, onboarding_completo, xp_total")
        .eq("id", userId)
        .maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      profileData = fallback.data as typeof profileData;
    } else if (profileRes.error) {
      throw new Error(profileRes.error.message);
    }

    if (msgsRes.error) throw new Error(msgsRes.error.message);
    if (chalRes.error) throw new Error(chalRes.error.message);

    let objective = objRes.data
      ? { titulo: objRes.data.titulo, motivo: objRes.data.motivo }
      : null;

    if (!objective && profileData) {
      objective = await ensureObjective(
        supabase,
        userId,
        profileData.nome,
        profileData.xp_total ?? 0,
      );
    }

    let pendingQuestion = await findPendingQuestionFromDb(supabase, userId);
    if (expireFollowUp.pendingQuestion) {
      pendingQuestion = expireFollowUp.pendingQuestion;
    }

    const pendingHabitSuggestion = await findPendingHabitSuggestionFromDb(supabase, userId);

    const challengesEnriched = await enrichChallenges(supabase, userId, chalRes.data ?? []);

    const ml = mlRes.error ? null : mlScoresFromRow(mlRes.data as never);
    let mlRiskLine: string | null = null;
    if (ml && (ml.risco_streak >= 0.55 || ml.risco_abandono >= 0.55)) {
      const pct = Math.round(Math.max(ml.risco_streak, ml.risco_abandono) * 100);
      const which =
        ml.risco_streak >= ml.risco_abandono ? "perder streak" : "queda de ritmo";
      const weak = ml.explicacao.weekday_weakest_label;
      mlRiskLine = `Risco de ${which}: alto (${pct}%)${weak ? ` · padrão fraco: ${weak}` : ""}`;
    } else if (ml && ml.risco_streak >= 0.35) {
      mlRiskLine = `Risco de perder streak: moderado (${Math.round(ml.risco_streak * 100)}%)`;
    }

    const { getMentorSystemPromptForUser } = await import("@/mentor/prompt.server");
    const promptMeta = await getMentorSystemPromptForUser(userId);

    return {
      messages: msgsRes.data ?? [],
      challenges: challengesEnriched,
      heroName: profileData?.nome ?? "Herói",
      onboardingCompleto: profileData?.onboarding_completo ?? false,
      objective,
      pendingQuestion,
      pendingHabitSuggestion,
      mlRiskLine,
      personality: {
        slug: promptMeta.slug,
        name: promptMeta.name,
        tagline: promptMeta.tagline,
      },
      expiredChallengesJustNow: expired.length,
      expireFollowUpCreated: Boolean(expireFollowUp.message),
    };
  });

export const ensureMentorPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: recent, error } = await supabase
      .from("mentor_messages")
      .select("id, role, kind, content, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) throw new Error(error.message);

    const messages = [...(recent ?? [])].reverse();
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const hour = hourInTz();
    const today = hojeISO();
    const todayMsgs = messages.filter((m) => calendarDateInTz(new Date(m.created_at)) === today);

    let daysSinceLastVisit: number | null = null;
    if (lastAssistant?.created_at) {
      daysSinceLastVisit = daysBetween(
        calendarDateInTz(new Date(lastAssistant.created_at)),
        hojeISO(),
      );
    }

    let kind = detectPresenceKind({
      messageCount: messages.length,
      lastAssistantKind: lastAssistant?.kind ?? null,
      lastAssistantAt: lastAssistant?.created_at ?? null,
      hour,
      daysSinceLastVisit,
      hadMorningToday: todayMsgs.some((m) => m.role === "assistant" && m.kind === "morning"),
      hadEveningToday: todayMsgs.some((m) => m.role === "assistant" && m.kind === "evening"),
      hadAssistantToday: todayMsgs.some((m) => m.role === "assistant"),
    });

    // ML: presença proativa quando risco alto e ainda não houve assistente hoje
    if (!kind && !todayMsgs.some((m) => m.role === "assistant")) {
      const { data: mlRow } = await supabase
        .from("user_ml_scores")
        .select("risco_streak, risco_abandono")
        .eq("user_id", userId)
        .maybeSingle();
      const risco = Math.max(
        Number(mlRow?.risco_streak) || 0,
        Number(mlRow?.risco_abandono) || 0,
      );
      if (risco >= 0.55) {
        kind = "insight";
      }
    }

    if (!kind) {
      return {
        created: false as const,
        message: null,
        challenge: null,
        pendingQuestion: null,
        pendingHabitSuggestion: null,
      };
    }

    if (kind !== "welcome" && lastAssistant?.kind === kind) {
      const age = Date.now() - new Date(lastAssistant.created_at).getTime();
      if (age < 1000 * 60 * 60 * 6) {
        return {
          created: false as const,
          message: null,
          challenge: null,
          pendingQuestion: null,
          pendingHabitSuggestion: null,
        };
      }
    }

    const history = messages.slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const pending = await findPendingQuestionFromDb(supabase, userId);
    const askedToday = await hadStructuredQuestionToday(supabase, userId);

    const result = await callMentor(supabase, userId, {
      kind,
      userText: presenceUserPrompt(kind, { allowQuestion: !pending && !askedToday }),
      history,
    });

    return {
      created: true as const,
      message: result.assistantMsg,
      challenge: result.challenge,
      pendingQuestion: result.pendingQuestion,
      pendingHabitSuggestion: result.pendingHabitSuggestion,
      objective: result.objective,
    };
  });

export const sendMentorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        content: z.string().trim().min(1, "Escreva algo.").max(2000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const content = data.content.trim();

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: cErr } = await supabase
      .from("mentor_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", hourAgo);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) >= 20) {
      throw new Error("O silêncio também ensina. Volte em breve para continuar.");
    }

    // If answering a pending structured question → memory + mark answered
    const pending = await findPendingQuestionFromDb(supabase, userId);
    if (pending) {
      await supabase.from("mentor_memories").insert({
        user_id: userId,
        content: `Sobre "${pending.prompt}": ${content}`.slice(0, 400),
        importance: 5,
      });
      await pruneMemories(supabase, userId);

      const { data: msg } = await supabase
        .from("mentor_messages")
        .select("id, metadata")
        .eq("id", pending.messageId)
        .maybeSingle();
      if (msg) {
        const meta = { ...((msg.metadata ?? {}) as object), question_answered: true };
        await supabase.from("mentor_messages").update({ metadata: meta as Json }).eq("id", msg.id);
      }
    }

    const { data: userMsg, error: uErr } = await supabase
      .from("mentor_messages")
      .insert({
        user_id: userId,
        role: "user",
        kind: "chat",
        content,
        metadata: pending ? ({ answers_question: pending.messageId } as Json) : {},
      })
      .select(MSG_COLS)
      .single();
    if (uErr || !userMsg) throw new Error(uErr?.message ?? "Falha ao salvar mensagem.");

    const { data: recent, error: hErr } = await supabase
      .from("mentor_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(16);
    if (hErr) throw new Error(hErr.message);

    const histClean = [...(recent ?? [])]
      .reverse()
      .filter((m) => !(m.role === "user" && m.content === content))
      .slice(-14)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const result = await callMentor(supabase, userId, {
      kind: "chat",
      userText: content,
      history: histClean,
    });

    return {
      userMessage: userMsg,
      assistantMessage: result.assistantMsg,
      challenge: result.challenge,
      pendingQuestion: result.pendingQuestion,
      pendingHabitSuggestion: result.pendingHabitSuggestion,
      objective: result.objective,
    };
  });

export const updateMentorChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["complete", "decline"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    await expireOverdueChallenges(supabase, userId);

    const { data: chal, error } = await supabase
      .from("mentor_challenges")
      .select(CHALLENGE_COLS)
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!chal) throw new Error("Desafio não encontrado.");
    if (chal.status !== "ativo") throw new Error("Este desafio já foi encerrado.");

    if (data.action === "decline") {
      const { data: updated, error: uErr } = await supabaseAdmin
        .from("mentor_challenges")
        .update({ status: "recusado" })
        .eq("id", data.id)
        .eq("user_id", userId)
        .select(CHALLENGE_COLS)
        .single();
      if (uErr) throw new Error(uErr.message);
      const [enriched] = await enrichChallenges(supabase, userId, [updated]);

      const followUp = await maybeChallengeFollowUp(supabase, userId, {
        titulo: chal.titulo,
        action: "decline",
      });

      return { challenge: enriched, xpGanho: 0, ...followUp };
    }

    // Habit verification when linked
    if (chal.habit_id) {
      const startDay = (chal.starts_at ?? new Date().toISOString()).slice(0, 10);
      const { count } = await supabase
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("habit_id", chal.habit_id)
        .gte("dia", startDay);
      const needed = chal.completions_required ?? 1;
      if ((count ?? 0) < needed) {
        throw new Error(
          `Ainda faltam conclusões do hábito vinculado (${count ?? 0}/${needed}). Complete o hábito e tente de novo.`,
        );
      }
    }

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("mentor_challenges")
      .update({ status: "concluido", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(CHALLENGE_COLS)
      .single();
    if (uErr) throw new Error(uErr.message);

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("xp_total, streak_atual, streak_maximo, capitulo_atual")
      .eq("id", userId)
      .single();
    if (pErr) throw new Error(pErr.message);

    const before = {
      xp_total: profile.xp_total ?? 0,
      streak_atual: profile.streak_atual ?? 0,
      streak_maximo: profile.streak_maximo ?? 0,
      capitulo_atual: profile.capitulo_atual ?? 1,
    };
    const novoXp = before.xp_total + chal.xp_recompensa;
    const { error: xpErr } = await supabaseAdmin
      .from("profiles")
      .update({ xp_total: novoXp })
      .eq("id", userId);
    if (xpErr) throw new Error(xpErr.message);

    await supabaseAdmin.from("activity_history").insert({
      user_id: userId,
      tipo: "mentor_challenge",
      descricao: `Desafio do Mentor concluído: ${chal.titulo}`,
      xp_delta: chal.xp_recompensa,
      metadata: { challenge_id: chal.id },
    });

    const { createNotification } = await import("@/notifications/create");
    await createNotification({
      userId,
      tipo: "mentor_challenge_done",
      titulo: "Desafio concluído",
      corpo: `${chal.titulo} · +${chal.xp_recompensa} XP`,
      metadata: {
        challenge_id: chal.id,
        xp: chal.xp_recompensa,
        href: "/profile",
      },
    });

    const { emitIdentityProof, getIdentityProofStats } = await import("@/lib/identity-proofs");
    await emitIdentityProof(supabase, {
      userId,
      sourceType: "challenge",
      sourceId: chal.id,
      label: `Desafio concluído: ${chal.titulo}`,
    });
    const proofStats = await getIdentityProofStats(supabase, userId);

    const { evaluateProgress } = await import("@/lib/progress-engine");
    const progress = await evaluateProgress(
      supabase,
      userId,
      before,
      {
        ...before,
        xp_total: novoXp,
      },
      {
        proofsWeek: proofStats.week,
        proofsTotal: proofStats.total,
      },
    );

    const [enriched] = await enrichChallenges(supabase, userId, [updated]);
    const followUp = await maybeChallengeFollowUp(supabase, userId, {
      titulo: chal.titulo,
      action: "complete",
    });

    return {
      challenge: enriched,
      xpGanho: chal.xp_recompensa + progress.xpBonusTotal,
      unlockedAchievements: progress.unlockedAchievements,
      identityProof: true as const,
      proofStats,
      chapterChanged: progress.chapterChanged,
      ...followUp,
    };
  });

async function hadExpireCycleFollowUpToday(supabase: Client, userId: string): Promise<boolean> {
  const today = hojeISO();
  const { data } = await supabase
    .from("mentor_messages")
    .select("id, metadata, created_at")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("kind", "challenge")
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).some((m) => {
    if (calendarDateInTz(new Date(m.created_at)) !== today) return false;
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    return meta.cycle === "verify_learn" && meta.challenge_outcome === "expire";
  });
}

async function maybeChallengeFollowUp(
  supabase: Client,
  userId: string,
  info: { titulo: string; action: ChallengeOutcome },
) {
  const pending = await findPendingQuestionFromDb(supabase, userId);
  const askedToday = await hadStructuredQuestionToday(supabase, userId);
  const allowQuestion = !pending && !askedToday;

  const { data: recent } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const history = [...(recent ?? [])]
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const { userText, cyclePhaseHint } = challengeFollowUpUserText(
    info.titulo,
    info.action,
    allowQuestion,
  );

  try {
    const result = await callMentor(supabase, userId, {
      kind: "challenge",
      userText,
      history,
      cyclePhaseHint,
      challengeOutcome: info.action,
    });
    return {
      message: result.assistantMsg,
      pendingQuestion: result.pendingQuestion,
      pendingHabitSuggestion: result.pendingHabitSuggestion,
    };
  } catch (e) {
    console.error("[mentor] challenge follow-up", e);
    return {
      message: null as null,
      pendingQuestion: null as null,
      pendingHabitSuggestion: null as null,
    };
  }
}

/** No máximo 1 follow-up de expiração por dia ao abrir o Mentor. */
async function maybeExpireCycleFollowUpOnVisit(
  supabase: Client,
  userId: string,
  expired: Array<{ id: string; titulo: string }>,
) {
  if (!expired.length) {
    return {
      message: null as null,
      pendingQuestion: null as null,
      pendingHabitSuggestion: null as null,
    };
  }
  if (await hadExpireCycleFollowUpToday(supabase, userId)) {
    return {
      message: null as null,
      pendingQuestion: null as null,
      pendingHabitSuggestion: null as null,
    };
  }
  return maybeChallengeFollowUp(supabase, userId, {
    titulo: expired[0]!.titulo,
    action: "expire",
  });
}

async function maybeHabitSuggestionFollowUp(
  supabase: Client,
  userId: string,
  info: { titulo: string; action: "accept" | "decline" },
) {
  const pending = await findPendingQuestionFromDb(supabase, userId);
  const askedToday = await hadStructuredQuestionToday(supabase, userId);
  const allowQuestion = !pending && !askedToday;

  const { data: recent } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const history = [...(recent ?? [])]
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const { userText, cyclePhaseHint } = habitSuggestionFollowUpUserText(
    info.titulo,
    info.action,
    allowQuestion,
  );

  try {
    const result = await callMentor(supabase, userId, {
      kind: "chat",
      userText,
      history,
      cyclePhaseHint,
    });
    return {
      message: result.assistantMsg,
      pendingQuestion: result.pendingQuestion,
      pendingHabitSuggestion: result.pendingHabitSuggestion,
    };
  } catch (e) {
    console.error("[mentor] habit suggestion follow-up", e);
    return {
      message: null as null,
      pendingQuestion: null as null,
      pendingHabitSuggestion: null as null,
    };
  }
}

export const respondMentorHabitSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        messageId: z.string().uuid(),
        action: z.enum(["accept", "decline"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const pending = await findPendingHabitSuggestionFromDb(supabase, userId);
    if (!pending || pending.messageId !== data.messageId) {
      throw new Error("Nenhuma sugestão de hábito pendente.");
    }

    const { data: msg, error: msgErr } = await supabase
      .from("mentor_messages")
      .select("id, metadata")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (msgErr) throw new Error(msgErr.message);
    if (!msg) throw new Error("Mensagem não encontrada.");

    const atributoSchema = z.enum([
      "forca",
      "disciplina",
      "sabedoria",
      "espirito",
      "testosterona",
      "prosperidade",
      "conhecimento",
      "lideranca",
    ]);
    const categoriaSchema = z
      .enum(["corpo", "mente", "espirito", "prosperidade", "relacionamentos", "proposito"])
      .nullable();

    const atributoParsed = atributoSchema.safeParse(pending.atributo);
    const atributo = atributoParsed.success ? atributoParsed.data : "disciplina";
    const categoriaParsed = categoriaSchema.safeParse(pending.categoria);
    const categoria = categoriaParsed.success ? categoriaParsed.data : null;

    let habit = null as
      | {
          id: string;
          titulo: string;
          descricao: string | null;
          xp_recompensa: number;
          atributo: string;
          categoria: string | null;
          ativo: boolean;
          created_at: string;
        }
      | null;

    if (data.action === "accept") {
      const { data: existing } = await supabase
        .from("habits")
        .select("id, titulo")
        .eq("user_id", userId)
        .eq("ativo", true);

      if ((existing ?? []).some((h) => habitTitlesConflict(h.titulo, pending.titulo))) {
        throw new Error("Você já tem um hábito parecido. Recuse ou ajuste o título.");
      }

      const xp = await resolveHabitXpReward();
      const { data: row, error: hErr } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          titulo: pending.titulo,
          descricao: pending.descricao ?? undefined,
          xp_recompensa: xp,
          atributo,
          categoria: categoria ?? undefined,
        })
        .select(HABIT_COLS)
        .single();
      if (hErr) throw new Error(hErr.message);
      habit = row;

      await supabase.from("mentor_memories").insert({
        user_id: userId,
        content: `Aceitou hábito sugerido por Charlie: "${pending.titulo}"`.slice(0, 400),
        importance: 4,
      });
      await pruneMemories(supabase, userId);
    }

    const meta = {
      ...((msg.metadata ?? {}) as object),
      habit_suggestion_answered: true,
      habit_suggestion_outcome: data.action,
      ...(habit ? { created_habit_id: habit.id } : {}),
    };
    const { error: upErr } = await supabase
      .from("mentor_messages")
      .update({ metadata: meta as Json })
      .eq("id", msg.id)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    const followUp = await maybeHabitSuggestionFollowUp(supabase, userId, {
      titulo: pending.titulo,
      action: data.action,
    });

    return {
      habit,
      action: data.action,
      ...followUp,
    };
  });

export const listCompletedMentorChallenges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mentor_challenges")
      .select(CHALLENGE_COLS)
      .eq("user_id", context.userId)
      .eq("status", "concluido")
      .order("completed_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCharliePersonalities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCharliePersonalities: list, DEFAULT_CHARLIE_PERSONALITY } = await import(
      "@/mentor/prompt.server"
    );
    const rows = await list({ includeInactive: false });

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("charlie_personality")
      .eq("id", context.userId)
      .maybeSingle();

    const currentSlug =
      profile?.charlie_personality &&
      rows.some((r) => r.slug === profile.charlie_personality)
        ? profile.charlie_personality
        : DEFAULT_CHARLIE_PERSONALITY;

    return {
      currentSlug,
      personalities: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        description: r.description,
        sort_order: r.sort_order,
      })),
    };
  });

export const setCharliePersonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ slug: z.string().trim().min(2).max(40) }).parse(i))
  .handler(async ({ context, data }) => {
    const { listCharliePersonalities: list } = await import("@/mentor/prompt.server");
    const rows = await list({ includeInactive: false });
    const found = rows.find((r) => r.slug === data.slug);
    if (!found) throw new Error("Personalidade inválida ou inativa.");

    const { error } = await context.supabase
      .from("profiles")
      .update({ charlie_personality: data.slug })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      personality: {
        slug: found.slug,
        name: found.name,
        tagline: found.tagline,
      },
    };
  });
