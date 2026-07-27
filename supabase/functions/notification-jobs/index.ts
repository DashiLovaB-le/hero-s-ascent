/**
 * Edge Function: notification-jobs (Fase 2 + ML Fase 3 adaptive)
 *
 * Agenda sugerida: `0 1 * * *` (01:00 UTC = 22:00 Brasília).
 * Header: `x-cron-secret: <CRON_SECRET>` (mesmo valor do secret no projeto).
 * Body JSON opcional: `{ "force": true }` para ignorar quiet hours.
 *
 * Quiet hours ≈ 23:00–06:59 Brasília (02:00–09:59 UTC) — reminders pulados
 * (expiração de desafios sempre roda).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const REMINDER_TIPOS = ["habit_reminder", "streak_risk"] as const;
const ML_QUIET = 0.35;
const ML_MOD = 0.35;
const ML_HIGH = 0.55;

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const cronHeader = req.headers.get("x-cron-secret")?.trim() ?? "";
    const bearer =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
    // Prefer x-cron-secret; ignore JWT em Authorization (gateway / pg_net)
    const provided =
      cronHeader || (bearer.includes(".") ? "" : bearer);

    if (!cronSecret || provided !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = Boolean(body?.force);
      } catch {
        /* empty body ok */
      }
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return json({ error: "Missing Supabase env" }, 500);
    }

    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date();
    const quietHours = isQuietHoursUtc(now);
    const hoje = now.toISOString().slice(0, 10);

    const challengesExpired = await expireChallenges(admin, now);

    let habitReminders = 0;
    let streakRisks = 0;
    let skippedReminders = false;

    if (quietHours && !force) {
      skippedReminders = true;
    } else {
      const r = await sendReminders(admin, hoje);
      habitReminders = r.habitReminders;
      streakRisks = r.streakRisks;
    }

    return json({
      ok: true,
      quietHours,
      forced: force,
      challengesExpired,
      habitReminders,
      streakRisks,
      skippedReminders,
    });
  } catch (e) {
    console.error("[notification-jobs]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isQuietHoursUtc(date: Date) {
  const h = date.getUTCHours();
  // 23:00–06:59 Brasília (UTC−3) → 02:00–09:59 UTC
  return h >= 2 && h < 10;
}

async function expireChallenges(
  admin: ReturnType<typeof createClient>,
  now: Date,
) {
  const nowIso = now.toISOString();
  const { data: overdue, error } = await admin
    .from("mentor_challenges")
    .select("id, user_id, titulo")
    .eq("status", "ativo")
    .not("ends_at", "is", null)
    .lt("ends_at", nowIso);

  if (error || !overdue?.length) return 0;

  const { error: updErr } = await admin
    .from("mentor_challenges")
    .update({ status: "expirado" })
    .in(
      "id",
      overdue.map((c) => c.id),
    )
    .eq("status", "ativo");

  if (updErr) {
    console.error("expire update", updErr.message);
    return 0;
  }

  let n = 0;
  for (const c of overdue) {
    const { error: iErr } = await admin.from("notifications").insert({
      user_id: c.user_id,
      tipo: "mentor_challenge_expired",
      titulo: "Desafio expirado",
      corpo: c.titulo,
      metadata: { challenge_id: c.id, href: "/mentor" },
    });
    if (!iErr) {
      n += 1;
      await maybeTelegram(admin, {
        userId: c.user_id,
        tipo: "mentor_challenge_expired",
        titulo: "Desafio expirado",
        corpo: c.titulo,
        href: "/mentor",
      });
    }
  }
  return n;
}

async function oncePerDay(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tipo: (typeof REMINDER_TIPOS)[number],
  titulo: string,
  corpo: string,
  metadata: Record<string, unknown>,
  hoje: string,
) {
  const start = `${hoje}T00:00:00.000Z`;
  const end = `${hoje}T23:59:59.999Z`;
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tipo", tipo)
    .gte("created_at", start)
    .lte("created_at", end);

  if ((count ?? 0) > 0) return false;

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    tipo,
    titulo,
    corpo,
    metadata,
  });
  if (error) return false;

  const href = typeof metadata.href === "string" ? metadata.href : "/habits";
  await maybeTelegram(admin, { userId, tipo, titulo, corpo, href });
  return true;
}

async function sendReminders(admin: ReturnType<typeof createClient>, hoje: string) {
  let habitReminders = 0;
  let streakRisks = 0;

  const { data: habits } = await admin.from("habits").select("id, user_id").eq("ativo", true);
  const habitsByUser = new Map<string, string[]>();
  for (const h of habits ?? []) {
    const list = habitsByUser.get(h.user_id) ?? [];
    list.push(h.id);
    habitsByUser.set(h.user_id, list);
  }

  const userIds = [...habitsByUser.keys()];
  if (!userIds.length) return { habitReminders, streakRisks };

  const { data: completions } = await admin
    .from("habit_completions")
    .select("user_id, habit_id")
    .eq("dia", hoje)
    .in("user_id", userIds);

  const doneByUser = new Map<string, Set<string>>();
  for (const row of completions ?? []) {
    const set = doneByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.habit_id);
    doneByUser.set(row.user_id, set);
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, streak_atual, ultimo_dia_completo, onboarding_completo")
    .in("id", userIds)
    .eq("onboarding_completo", true);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: mlRows } = await admin
    .from("user_ml_scores")
    .select("user_id, risco_streak, risco_abandono, weekday_weakest, explicacao")
    .in("user_id", userIds);

  const mlByUser = new Map((mlRows ?? []).map((r) => [r.user_id, r]));

  for (const [userId, habitIds] of habitsByUser) {
    const profile = profileById.get(userId);
    if (!profile) continue;

    const done = doneByUser.get(userId) ?? new Set<string>();
    const pending = habitIds.filter((id) => !done.has(id)).length;
    const allDone = pending === 0;
    const ml = mlByUser.get(userId);
    const decision = decideRemindersEdge({
      scores: ml
        ? {
            risco_streak: Number(ml.risco_streak) || 0,
            risco_abandono: Number(ml.risco_abandono) || 0,
            weekday_weakest_label:
              ((ml.explicacao as { weekday_weakest_label?: string } | null)
                ?.weekday_weakest_label) ?? null,
          }
        : null,
      pending,
      allDone,
      streakAtual: profile.streak_atual ?? 0,
      ultimoDiaCompleto: profile.ultimo_dia_completo,
      hoje,
    });

    if (decision.sendHabitReminder) {
      const ok = await oncePerDay(
        admin,
        userId,
        "habit_reminder",
        decision.habitTitulo,
        decision.habitCorpo,
        {
          href: "/habits",
          pending,
          ml_guided: decision.ml_guided,
          risco_streak: decision.risco_streak,
          risco_abandono: decision.risco_abandono,
        },
        hoje,
      );
      if (ok) habitReminders += 1;
    }

    if (decision.sendStreakRisk) {
      const ok = await oncePerDay(
        admin,
        userId,
        "streak_risk",
        decision.streakTitulo,
        decision.streakCorpo,
        {
          href: "/habits",
          streak: profile.streak_atual,
          ml_guided: decision.ml_guided,
          risco_streak: decision.risco_streak,
          risco_abandono: decision.risco_abandono,
        },
        hoje,
      );
      if (ok) streakRisks += 1;
    }
  }

  return { habitReminders, streakRisks };
}

/** Espelho enxuto de src/lib/ml/adaptive.ts decideReminders (Edge). */
function decideRemindersEdge(input: {
  scores: {
    risco_streak: number;
    risco_abandono: number;
    weekday_weakest_label: string | null;
  } | null;
  pending: number;
  allDone: boolean;
  streakAtual: number;
  ultimoDiaCompleto: string | null;
  hoje: string;
}) {
  const s = input.scores;
  const classicStreakRisk =
    input.streakAtual > 0 &&
    input.ultimoDiaCompleto !== input.hoje &&
    !input.allDone;

  let sendHabitReminder = !input.allDone && input.pending > 0;
  let sendStreakRisk = classicStreakRisk;

  if (
    sendHabitReminder &&
    input.pending === 1 &&
    s &&
    s.risco_streak < ML_QUIET &&
    s.risco_abandono < ML_QUIET
  ) {
    sendHabitReminder = false;
  }

  if (s && s.risco_streak >= ML_HIGH && input.streakAtual > 0 && !input.allDone) {
    sendStreakRisk = true;
  }

  let habitTitulo = "Missões do dia em aberto";
  let habitCorpo =
    input.pending === 1
      ? "Ainda falta 1 hábito hoje. Mantém o ritmo."
      : `Ainda faltam ${input.pending} hábitos hoje. Mantém o ritmo.`;

  if (s && s.risco_abandono >= ML_HIGH && sendHabitReminder) {
    habitTitulo = "Não quebre o ritmo hoje";
    habitCorpo =
      input.pending === 1
        ? "Um hábito ainda aberto — feche o dia antes que a ausência vire hábito."
        : `${input.pending} hábitos em aberto. Volte agora; o ritmo está em risco.`;
  } else if (s && s.risco_abandono >= ML_MOD && sendHabitReminder) {
    habitCorpo =
      input.pending === 1
        ? "Ainda falta 1 hábito. Um passo curto basta."
        : `Faltam ${input.pending} hábitos. Um de cada vez.`;
  }

  let streakTitulo = "Sua streak está em risco";
  let streakCorpo = `Sequência de ${input.streakAtual} dias — conclua um hábito hoje.`;

  if (s && s.risco_streak >= ML_HIGH && sendStreakRisk) {
    streakTitulo = "Streak em risco alto";
    const weak = s.weekday_weakest_label;
    streakCorpo = weak
      ? `Sequência de ${input.streakAtual} dias. Seu padrão fraco costuma ser ${weak} — não deixe hoje seguir o mesmo caminho.`
      : `Sequência de ${input.streakAtual} dias sob pressão. Conclua ao menos um hábito hoje.`;
  } else if (s && s.risco_streak >= ML_MOD && sendStreakRisk) {
    streakCorpo = `Sequência de ${input.streakAtual} dias. Um hábito hoje segura o ritmo.`;
  }

  return {
    sendHabitReminder,
    sendStreakRisk,
    habitTitulo,
    habitCorpo,
    streakTitulo,
    streakCorpo,
    ml_guided: Boolean(s),
    risco_streak: s?.risco_streak ?? null,
    risco_abandono: s?.risco_abandono ?? null,
  };
}

async function maybeTelegram(
  admin: ReturnType<typeof createClient>,
  input: {
    userId: string;
    tipo: string;
    titulo: string;
    corpo?: string;
    href?: string;
  },
) {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("telegram_chat_id, telegram_opt_in")
      .eq("id", input.userId)
      .maybeSingle();

    if (!profile?.telegram_opt_in || !profile.telegram_chat_id) return;

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return;

    const app =
      (Deno.env.get("APP_PUBLIC_URL") || "https://v-projectdashi.lovable.app").replace(
        /\/$/,
        "",
      );
    const path = input.href?.startsWith("/") ? input.href : "/habits";
    const lines = ["⚔ V-Project", input.titulo];
    if (input.corpo?.trim()) lines.push(input.corpo.trim());
    lines.push("", `${app}${path}`);

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text: lines.join("\n"),
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("[notification-jobs] telegram", e);
  }
}
