import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { chatCompletion } from "@/mentor/openrouter";
import {
  MENTOR_SYSTEM_PROMPT,
  buildMentorContextBlock,
  detectPresenceKind,
  parseMentorAiPayload,
  presenceUserPrompt,
  type MentorPresenceKind,
} from "@/mentor/context";

type Client = SupabaseClient<Database>;

const MSG_COLS = "id, role, kind, content, metadata, created_at";
const CHALLENGE_COLS =
  "id, titulo, descricao, duracao_dias, xp_recompensa, titulo_recompensa, status, starts_at, ends_at, completed_at, created_at";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(isoA: string, isoB: string) {
  const a = new Date(`${isoA}T12:00:00`).getTime();
  const b = new Date(`${isoB}T12:00:00`).getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

async function loadJourneySnapshot(supabase: Client, userId: string) {
  const hoje = hojeISO();
  const from21 = new Date();
  from21.setDate(from21.getDate() - 21);
  const from21Iso = from21.toISOString().slice(0, 10);

  const [profileRes, attrsRes, habitsRes, goalsRes, todayRes, compsRes, memRes, chalRes, lastMsgRes] =
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

  if (!profileRes.data || !attrsRes.data) {
    throw new Error("Perfil incompleto. Abra a Jornada antes de falar com o Mentor.");
  }

  let daysSinceLastVisit: number | null = null;
  if (lastMsgRes.data?.created_at) {
    daysSinceLastVisit = daysBetween(lastMsgRes.data.created_at.slice(0, 10), hoje);
  } else if (profileRes.data.ultimo_dia_completo) {
    daysSinceLastVisit = daysBetween(profileRes.data.ultimo_dia_completo, hoje);
  }

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

  let challengeRow = null;
  if (payload.challenge && snap.activeChallenges.length < 2) {
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
      })
      .select(CHALLENGE_COLS)
      .single();
    if (chalErr) {
      console.error("[mentor] challenge insert", chalErr.message);
    } else {
      challengeRow = chal;
      metadata.challenge_id = chal.id;
    }
  }

  if (payload.memory) {
    const { error: memErr } = await supabase.from("mentor_memories").insert({
      user_id: userId,
      content: payload.memory.slice(0, 400),
      importance: 4,
    });
    if (memErr) console.error("[mentor] memory insert", memErr.message);

    // Keep memory table lean
    const { data: allMem } = await supabase
      .from("mentor_memories")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (allMem && allMem.length > 20) {
      const drop = allMem.slice(20).map((m) => m.id);
      await supabase.from("mentor_memories").delete().in("id", drop);
    }
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

  return { assistantMsg, challenge: challengeRow, payload };
}

export const getMentorThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [msgsRes, chalRes, profileRes] = await Promise.all([
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
        .in("status", ["ativo", "concluido"])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("profiles").select("nome, onboarding_completo").eq("id", userId).maybeSingle(),
    ]);

    if (msgsRes.error) throw new Error(msgsRes.error.message);
    if (chalRes.error) throw new Error(chalRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);

    return {
      messages: msgsRes.data ?? [],
      challenges: chalRes.data ?? [],
      heroName: profileRes.data?.nome ?? "Herói",
      onboardingCompleto: profileRes.data?.onboarding_completo ?? false,
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
      return { created: false as const, message: null, challenge: null };
    }

    // Avoid duplicate presence of same kind within 6h (except welcome which is once)
    if (kind !== "welcome" && lastAssistant?.kind === kind) {
      const age = Date.now() - new Date(lastAssistant.created_at).getTime();
      if (age < 1000 * 60 * 60 * 6) {
        return { created: false as const, message: null, challenge: null };
      }
    }

    const history = messages.slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const result = await callMentor(supabase, userId, {
      kind,
      userText: presenceUserPrompt(kind),
      history,
    });

    return {
      created: true as const,
      message: result.assistantMsg,
      challenge: result.challenge,
    };
  });

export const sendMentorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      content: z.string().trim().min(1, "Escreva algo.").max(2000),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const content = data.content.trim();

    // Rate limit: max 20 user messages / hour
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

    const { data: userMsg, error: uErr } = await supabase
      .from("mentor_messages")
      .insert({
        user_id: userId,
        role: "user",
        kind: "chat",
        content,
        metadata: {},
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
    };
  });

export const updateMentorChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["complete", "decline"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

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
      return { challenge: updated, xpGanho: 0 };
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

    return { challenge: updated, xpGanho: chal.xp_recompensa };
  });
