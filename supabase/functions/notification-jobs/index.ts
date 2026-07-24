/**
 * Edge Function: notification-jobs (Fase 2)
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
    if (!iErr) n += 1;
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
  return !error;
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

  for (const [userId, habitIds] of habitsByUser) {
    const profile = profileById.get(userId);
    if (!profile) continue;

    const done = doneByUser.get(userId) ?? new Set<string>();
    const pending = habitIds.filter((id) => !done.has(id)).length;
    const allDone = pending === 0;

    if (!allDone) {
      const ok = await oncePerDay(
        admin,
        userId,
        "habit_reminder",
        "Missões do dia em aberto",
        pending === 1
          ? "Ainda falta 1 hábito hoje. Mantém o ritmo."
          : `Ainda faltam ${pending} hábitos hoje. Mantém o ritmo.`,
        { href: "/habits", pending },
        hoje,
      );
      if (ok) habitReminders += 1;
    }

    if ((profile.streak_atual ?? 0) > 0 && profile.ultimo_dia_completo !== hoje && !allDone) {
      const ok = await oncePerDay(
        admin,
        userId,
        "streak_risk",
        "Sua streak está em risco",
        `Sequência de ${profile.streak_atual} dias — conclua um hábito hoje.`,
        { href: "/habits", streak: profile.streak_atual },
        hoje,
      );
      if (ok) streakRisks += 1;
    }
  }

  return { habitReminders, streakRisks };
}
