import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { chatCompletion } from "@/mentor/openrouter";
import {
  MENTOR_SYSTEM_PROMPT,
  buildMentorContextBlock,
  defaultObjectiveForHero,
  detectPresenceKind,
  parseMentorAiPayload,
  presenceUserPrompt,
  type MentorPresenceKind,
} from "@/mentor/context";

type Client = SupabaseClient<Database>;

const MSG_COLS = "id, role, kind, content, metadata, created_at";
const CHALLENGE_COLS =
  "id, user_id, titulo, descricao, duracao_dias, xp_recompensa, titulo_recompensa, status, starts_at, ends_at, completed_at, created_at, habit_id, completions_required";
const OBJECTIVE_COLS = "user_id, titulo, motivo, source, ativo, created_at, updated_at";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(isoA: string, isoB: string) {
  const a = new Date(`${isoA}T12:00:00`).getTime();
  const b = new Date(`${isoB}T12:00:00`).getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

async function expireOverdueChallenges(supabase: Client, userId: string) {
  const now = new Date().toISOString();
  await supabase
    .from("mentor_challenges")
    .update({ status: "expirado" })
    .eq("user_id", userId)
    .eq("status", "ativo")
    .not("ends_at", "is", null)
    .lt("ends_at", now);
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
  const from21 = new Date();
  from21.setDate(from21.getDate() - 21);
  const from21Iso = from21.toISOString().slice(0, 10);

  await expireOverdueChallenges(supabase, userId);

  const [profileRes, attrsRes, habitsRes, goalsRes, todayRes, compsRes, memRes, chalRes, lastMsgRes, objRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, nome, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, created_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("attributes")
        .select(
          "forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("habits")
        .select("id, titulo, atributo")
        .eq("user_id", userId)
        .eq("ativo", true),
      supabase.from("goals").select("titulo, categoria").eq("user_id", userId).eq("ativo", true),
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

  return {
    profile: profileRes.data,
    attributes: attrsRes.data,
    habits: habitsRes.data ?? [],
    goals: goalsRes.data ?? [],
    completedTodayIds: (todayRes.data ?? []).map((r) => r.habit_id),
    completionsLast21: compsRes.data ?? [],
    memories: memRes.data ?? [],
    activeChallenges: chalRes.data ?? [],
    daysSinceLastVisit,
    objective,
    pendingQuestion: pending,
    allowQuestion,
  };
}

async function callMentor(
  supabase: Client,
  userId: string,
  opts: {
    kind: Exclude<MentorPresenceKind, null> | "chat" | "challenge" | "insight";
    userText: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  },
) {
  const snap = await loadJourneySnapshot(supabase, userId);
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
  });

  const messages = [
    { role: "system" as const, content: MENTOR_SYSTEM_PROMPT },
    {
      role: "system" as const,
      content: `CONTEXTO ATUAL DA JORNADA\n${contextBlock}`,
    },
    ...opts.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: opts.userText },
  ];

  const { content, model } = await chatCompletion({
    messages,
    jsonMode: true,
    temperature: 0.8,
    maxTokens: 900,
  });

  const payload = parseMentorAiPayload(content);

  const metadata: Record<string, Json> = {
    model,
    kind: opts.kind,
    has_challenge: Boolean(payload.challenge),
  };

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

  let challengeRow = null;
  if (payload.challenge && snap.activeChallenges.length < 2) {
    const habitOk =
      payload.challenge.habit_id &&
      snap.habits.some((h) => h.id === payload.challenge!.habit_id)
        ? payload.challenge.habit_id
        : null;

    const ends = new Date();
    ends.setDate(ends.getDate() + payload.challenge.duracao_dias);
    const { data: chal, error: chalErr } = await supabase
      .from("mentor_challenges")
      .insert({
        user_id: userId,
        titulo: payload.challenge.titulo,
        descricao: payload.challenge.descricao,
        duracao_dias: payload.challenge.duracao_dias,
        xp_recompensa: payload.challenge.xp_recompensa,
        titulo_recompensa: payload.challenge.titulo_recompensa ?? null,
        status: "ativo",
        ends_at: ends.toISOString(),
        habit_id: habitOk,
        completions_required: payload.challenge.completions_required ?? 1,
      })
      .select(CHALLENGE_COLS)
      .single();
    if (chalErr) {
      console.error("[mentor] challenge insert", chalErr.message);
    } else if (chal) {
      const [enriched] = await enrichChallenges(supabase, userId, [chal]);
      challengeRow = enriched;
      metadata.challenge_id = chal.id;
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
  };
}

export const getMentorThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await expireOverdueChallenges(supabase, userId);

    const [msgsRes, chalRes, profileRes, objRes] = await Promise.all([
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
        .select("nome, onboarding_completo, xp_total")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("mentor_objectives")
        .select(OBJECTIVE_COLS)
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle(),
    ]);

    if (msgsRes.error) throw new Error(msgsRes.error.message);
    if (chalRes.error) throw new Error(chalRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);

    let objective = objRes.data
      ? { titulo: objRes.data.titulo, motivo: objRes.data.motivo }
      : null;

    if (!objective && profileRes.data) {
      objective = await ensureObjective(
        supabase,
        userId,
        profileRes.data.nome,
        profileRes.data.xp_total ?? 0,
      );
    }

    const pendingQuestion = await findPendingQuestionFromDb(supabase, userId);
    const challengesEnriched = await enrichChallenges(supabase, userId, chalRes.data ?? []);

    return {
      messages: msgsRes.data ?? [],
      challenges: challengesEnriched,
      heroName: profileRes.data?.nome ?? "Herói",
      onboardingCompleto: profileRes.data?.onboarding_completo ?? false,
      objective,
      pendingQuestion,
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
    const hour = new Date().getHours();
    const today = hojeISO();
    const todayMsgs = messages.filter((m) => m.created_at.slice(0, 10) === today);

    let daysSinceLastVisit: number | null = null;
    if (lastAssistant?.created_at) {
      daysSinceLastVisit = daysBetween(lastAssistant.created_at.slice(0, 10), hojeISO());
    }

    const kind = detectPresenceKind({
      messageCount: messages.length,
      lastAssistantKind: lastAssistant?.kind ?? null,
      lastAssistantAt: lastAssistant?.created_at ?? null,
      hour,
      daysSinceLastVisit,
      hadMorningToday: todayMsgs.some((m) => m.role === "assistant" && m.kind === "morning"),
      hadEveningToday: todayMsgs.some((m) => m.role === "assistant" && m.kind === "evening"),
      hadAssistantToday: todayMsgs.some((m) => m.role === "assistant"),
    });

    if (!kind) {
      return { created: false as const, message: null, challenge: null, pendingQuestion: null };
    }

    if (kind !== "welcome" && lastAssistant?.kind === kind) {
      const age = Date.now() - new Date(lastAssistant.created_at).getTime();
      if (age < 1000 * 60 * 60 * 6) {
        return { created: false as const, message: null, challenge: null, pendingQuestion: null };
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
      const { data: updated, error: uErr } = await supabase
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

    const { data: updated, error: uErr } = await supabase
      .from("mentor_challenges")
      .update({ status: "concluido", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(CHALLENGE_COLS)
      .single();
    if (uErr) throw new Error(uErr.message);

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("xp_total")
      .eq("id", userId)
      .single();
    if (pErr) throw new Error(pErr.message);

    const novoXp = (profile.xp_total ?? 0) + chal.xp_recompensa;
    const { error: xpErr } = await supabase
      .from("profiles")
      .update({ xp_total: novoXp })
      .eq("id", userId);
    if (xpErr) throw new Error(xpErr.message);

    await supabase.from("activity_history").insert({
      user_id: userId,
      tipo: "mentor_challenge",
      descricao: `Desafio do Mentor concluído: ${chal.titulo}`,
      xp_delta: chal.xp_recompensa,
      metadata: { challenge_id: chal.id },
    });

    const [enriched] = await enrichChallenges(supabase, userId, [updated]);
    const followUp = await maybeChallengeFollowUp(supabase, userId, {
      titulo: chal.titulo,
      action: "complete",
    });

    return { challenge: enriched, xpGanho: chal.xp_recompensa, ...followUp };
  });

async function maybeChallengeFollowUp(
  supabase: Client,
  userId: string,
  info: { titulo: string; action: "complete" | "decline" },
) {
  const pending = await findPendingQuestionFromDb(supabase, userId);
  const askedToday = await hadStructuredQuestionToday(supabase, userId);
  if (pending || askedToday) {
    return { message: null as null, pendingQuestion: null as null };
  }

  const { data: recent } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const history = [...(recent ?? [])]
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const verb = info.action === "complete" ? "concluiu" : "adiou";
  try {
    const result = await callMentor(supabase, userId, {
      kind: "challenge",
      userText: `O herói ${verb} o desafio "${info.titulo}". Comente em 1–2 frases e faça UMA pergunta estruturada sobre o que isso revelou (tempo, energia, disciplina ou próximo passo).`,
      history,
    });
    return {
      message: result.assistantMsg,
      pendingQuestion: result.pendingQuestion,
    };
  } catch (e) {
    console.error("[mentor] challenge follow-up", e);
    return { message: null as null, pendingQuestion: null as null };
  }
}

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
