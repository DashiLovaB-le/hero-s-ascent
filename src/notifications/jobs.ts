import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification, type NotificationTipo } from "@/notifications/create";
import { decideReminders, scoresFromMlRow } from "@/lib/ml/adaptive";
import { hojeISO, isQuietHoursInTz, zonedDayBoundsUtcIso } from "@/lib/datetime";

type Admin = SupabaseClient<Database>;

/** Quiet hours ≈ 23:00–06:59 America/Sao_Paulo. */
export function isQuietHoursUtc(date = new Date()): boolean {
  return isQuietHoursInTz(date);
}

function dayBounds(dia: string) {
  return zonedDayBoundsUtcIso(dia);
}

/** Insert com anti-spam diário para tipos de reminder (respeita índice único). */
export async function createNotificationOncePerDay(input: {
  userId: string;
  tipo: Extract<NotificationTipo, "habit_reminder" | "streak_risk" | "identity_report">;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
  dia?: string;
}) {
  const dia = input.dia ?? hojeISO();
  const { start, end } = dayBounds(dia);

  const { count, error: countErr } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("tipo", input.tipo)
    .gte("created_at", start)
    .lte("created_at", end);

  if (countErr) {
    console.error("[notifications] oncePerDay count", countErr.message);
    return { ok: false as const, skipped: false, error: countErr.message };
  }
  if ((count ?? 0) > 0) {
    return { ok: true as const, skipped: true as const };
  }

  const created = await createNotification({
    userId: input.userId,
    tipo: input.tipo,
    titulo: input.titulo,
    corpo: input.corpo,
    metadata: input.metadata,
  });
  if (!created.ok) {
    if (
      created.error?.includes("idx_notifications_user_tipo_day") ||
      created.error?.includes("idx_notifications_identity_report_day") ||
      created.error?.toLowerCase().includes("duplicate")
    ) {
      return { ok: true as const, skipped: true as const };
    }
    return { ok: false as const, skipped: false, error: created.error };
  }
  return { ok: true as const, skipped: false as const };
}

export type NotificationJobsResult = {
  quietHours: boolean;
  forced: boolean;
  challengesExpired: number;
  habitReminders: number;
  streakRisks: number;
  identityReports: number;
  skippedReminders: boolean;
};

/**
 * Gatilhos de produto (Fase 2 + ML Fase 3 adaptive + relatório evening).
 * - Expira desafios overdue + notifica (sempre)
 * - habit_reminder / streak_risk / identity_report (pula em quiet hours, salvo force)
 *
 * Horário documentado do cron: 22:00 America/Sao_Paulo (= 01:00 UTC).
 */
export async function runProductNotificationJobs(opts?: {
  force?: boolean;
  now?: Date;
}): Promise<NotificationJobsResult> {
  const now = opts?.now ?? new Date();
  const forced = Boolean(opts?.force);
  const quietHours = isQuietHoursUtc(now);
  const hoje = hojeISO(now);

  const challengesExpired = await expireAllOverdueChallengesAndNotify(supabaseAdmin, now);

  let habitReminders = 0;
  let streakRisks = 0;
  let identityReports = 0;
  let skippedReminders = false;

  if (quietHours && !forced) {
    skippedReminders = true;
  } else {
    const reminders = await sendDailyProductReminders(supabaseAdmin, hoje);
    habitReminders = reminders.habitReminders;
    streakRisks = reminders.streakRisks;
    identityReports = await sendEveningIdentityReports(supabaseAdmin, hoje);
  }

  return {
    quietHours,
    forced,
    challengesExpired,
    habitReminders,
    streakRisks,
    identityReports,
    skippedReminders,
  };
}

export async function expireAllOverdueChallengesAndNotify(
  admin: Admin,
  now = new Date(),
): Promise<number> {
  const nowIso = now.toISOString();
  const { data: overdue, error } = await admin
    .from("mentor_challenges")
    .select("id, user_id, titulo")
    .eq("status", "ativo")
    .not("ends_at", "is", null)
    .lt("ends_at", nowIso);

  if (error) {
    console.error("[notifications] expire list", error.message);
    return 0;
  }
  if (!overdue?.length) return 0;

  const ids = overdue.map((c) => c.id);
  const { error: updErr } = await admin
    .from("mentor_challenges")
    .update({ status: "expirado" })
    .in("id", ids)
    .eq("status", "ativo");

  if (updErr) {
    console.error("[notifications] expire update", updErr.message);
    return 0;
  }

  let notified = 0;
  for (const c of overdue) {
    const res = await createNotification({
      userId: c.user_id,
      tipo: "mentor_challenge_expired",
      titulo: "Desafio expirado",
      corpo: c.titulo,
      metadata: {
        challenge_id: c.id,
        href: "/mentor",
      },
    });
    if (res.ok) notified += 1;
  }
  return notified;
}

/** Expira desafios de um usuário e notifica (lazy path do mentor). */
export async function expireUserOverdueChallengesAndNotify(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<{ notified: number; expired: Array<{ id: string; titulo: string }> }> {
  const nowIso = now.toISOString();
  const { data: overdue, error } = await client
    .from("mentor_challenges")
    .select("id, titulo")
    .eq("user_id", userId)
    .eq("status", "ativo")
    .not("ends_at", "is", null)
    .lt("ends_at", nowIso);

  if (error || !overdue?.length) return { notified: 0, expired: [] };

  const ids = overdue.map((c) => c.id);
  const { error: updErr } = await supabaseAdmin
    .from("mentor_challenges")
    .update({ status: "expirado" })
    .eq("user_id", userId)
    .in("id", ids)
    .eq("status", "ativo");

  if (updErr) {
    console.error("[notifications] expire user", updErr.message);
    return { notified: 0, expired: [] };
  }

  let notified = 0;
  for (const c of overdue) {
    const res = await createNotification({
      userId,
      tipo: "mentor_challenge_expired",
      titulo: "Desafio expirado",
      corpo: c.titulo,
      metadata: {
        challenge_id: c.id,
        href: "/mentor",
      },
    });
    if (res.ok) notified += 1;
  }
  return { notified, expired: overdue.map((c) => ({ id: c.id, titulo: c.titulo })) };
}

async function sendDailyProductReminders(admin: Admin, hoje: string) {
  let habitReminders = 0;
  let streakRisks = 0;

  const { data: habits, error: hErr } = await admin
    .from("habits")
    .select("id, user_id")
    .eq("ativo", true);

  if (hErr) {
    console.error("[notifications] habits", hErr.message);
    return { habitReminders, streakRisks };
  }

  const habitsByUser = new Map<string, string[]>();
  for (const h of habits ?? []) {
    const list = habitsByUser.get(h.user_id) ?? [];
    list.push(h.id);
    habitsByUser.set(h.user_id, list);
  }

  const userIds = [...habitsByUser.keys()];
  if (userIds.length === 0) return { habitReminders, streakRisks };

  const { data: completions, error: cErr } = await admin
    .from("habit_completions")
    .select("user_id, habit_id")
    .eq("dia", hoje)
    .in("user_id", userIds);

  if (cErr) {
    console.error("[notifications] completions", cErr.message);
    return { habitReminders, streakRisks };
  }

  const doneByUser = new Map<string, Set<string>>();
  for (const row of completions ?? []) {
    const set = doneByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.habit_id);
    doneByUser.set(row.user_id, set);
  }

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, streak_atual, ultimo_dia_completo, onboarding_completo")
    .in("id", userIds)
    .eq("onboarding_completo", true);

  if (pErr) {
    console.error("[notifications] profiles", pErr.message);
    return { habitReminders, streakRisks };
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: mlRows } = await admin
    .from("user_ml_scores")
    .select("user_id, risco_streak, risco_abandono, weekday_weakest, explicacao")
    .in("user_id", userIds);

  const mlByUser = new Map(
    (mlRows ?? []).map((r) => [r.user_id, scoresFromMlRow(r)]),
  );

  const { data: alterEgoRows } = await admin
    .from("hero_alter_ego")
    .select("user_id, nome, inimigo, codigo, active")
    .in("user_id", userIds)
    .eq("active", true);

  const alterEgoByUser = new Map(
    (alterEgoRows ?? []).map((r) => {
      const codigo = Array.isArray(r.codigo) ? r.codigo.map(String) : [];
      return [
        r.user_id,
        {
          nome: String(r.nome),
          inimigo: String(r.inimigo ?? ""),
          codigoLine: codigo[0]?.trim() || null,
        },
      ] as const;
    }),
  );

  for (const [userId, habitIds] of habitsByUser) {
    const profile = profileById.get(userId);
    if (!profile) continue;

    const done = doneByUser.get(userId) ?? new Set<string>();
    const pending = habitIds.filter((id) => !done.has(id)).length;
    const allDone = pending === 0;

    const decision = decideReminders({
      scores: mlByUser.get(userId) ?? null,
      pending,
      allDone,
      streakAtual: profile.streak_atual ?? 0,
      ultimoDiaCompleto: profile.ultimo_dia_completo,
      hoje,
    });

    if (decision.sendHabitReminder) {
      const res = await createNotificationOncePerDay({
        userId,
        tipo: "habit_reminder",
        titulo: decision.habitTitulo,
        corpo: decision.habitCorpo,
        metadata: {
          href: "/habits",
          pending,
          ...decision.metadataExtra,
          adaptive_reasons: decision.reasons,
          weekday_weakest_label: mlByUser.get(userId)?.weekday_weakest_label ?? null,
          // guardrail: sem identity_* em habit_reminder
        },
        dia: hoje,
      });
      if (res.ok && !res.skipped) habitReminders += 1;
    }

    if (decision.sendStreakRisk) {
      const ego = alterEgoByUser.get(userId);
      const res = await createNotificationOncePerDay({
        userId,
        tipo: "streak_risk",
        titulo: decision.streakTitulo,
        corpo: decision.streakCorpo,
        metadata: {
          href: ego ? "/identity" : "/habits",
          streak: profile.streak_atual,
          ...decision.metadataExtra,
          adaptive_reasons: decision.reasons,
          weekday_weakest_label: mlByUser.get(userId)?.weekday_weakest_label ?? null,
          ...(ego?.codigoLine
            ? {
                identity_codigo: ego.codigoLine,
                identity_inimigo: ego.inimigo || null,
                alter_ego_nome: ego.nome,
              }
            : {}),
        },
        dia: hoje,
      });
      if (res.ok && !res.skipped) streakRisks += 1;
    }
  }

  return { habitReminders, streakRisks };
}

/**
 * Relatório de identidade (evening) → in-app + Telegram + Discord.
 * Só usuários com canal opt-in (Telegram e/ou Discord).
 */
export async function sendEveningIdentityReports(
  admin: Admin,
  hoje: string,
): Promise<number> {
  const { buildIdentityEveningReport } = await import("@/lib/identity-evening-report");
  const { addDaysToDateKey } = await import("@/lib/datetime");

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, nome, onboarding_completo, telegram_chat_id, telegram_opt_in, discord_user_id, discord_opt_in",
    )
    .eq("onboarding_completo", true);

  if (error) {
    console.error("[notifications] identity report profiles", error.message);
    return 0;
  }

  const targets = (profiles ?? []).filter(
    (p) =>
      (p.telegram_opt_in && p.telegram_chat_id) ||
      (p.discord_opt_in && p.discord_user_id),
  );
  if (!targets.length) return 0;

  const userIds = targets.map((p) => p.id);
  const weekStart = addDaysToDateKey(hoje, -6);

  const [habitsRes, compsRes, alterEgoRes, checkinRes, mlRes, proofsRes] = await Promise.all([
    admin.from("habits").select("id, user_id").eq("ativo", true).in("user_id", userIds),
    admin
      .from("habit_completions")
      .select("user_id, habit_id")
      .eq("dia", hoje)
      .in("user_id", userIds),
    admin
      .from("hero_alter_ego")
      .select("user_id, nome, codigo, active")
      .in("user_id", userIds)
      .eq("active", true),
    admin
      .from("user_checkins")
      .select("user_id, identidade_hoje")
      .eq("dia", hoje)
      .in("user_id", userIds),
    admin.from("user_ml_scores").select("user_id, explicacao").in("user_id", userIds),
    admin
      .from("identity_proofs")
      .select("user_id")
      .in("user_id", userIds)
      .gte("dia", weekStart)
      .lte("dia", hoje),
  ]);

  const habitsByUser = new Map<string, string[]>();
  for (const h of habitsRes.data ?? []) {
    const list = habitsByUser.get(h.user_id) ?? [];
    list.push(h.id);
    habitsByUser.set(h.user_id, list);
  }

  const doneByUser = new Map<string, Set<string>>();
  for (const row of compsRes.data ?? []) {
    const set = doneByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.habit_id);
    doneByUser.set(row.user_id, set);
  }

  const egoByUser = new Map(
    (alterEgoRes.data ?? []).map((r) => {
      const codigo = Array.isArray(r.codigo) ? r.codigo.map(String) : [];
      return [
        r.user_id,
        { nome: String(r.nome), codigoLine: codigo[0]?.trim() || null },
      ] as const;
    }),
  );

  const checkinByUser = new Map(
    (checkinRes.data ?? []).map((r) => [
      r.user_id,
      (r as { identidade_hoje?: string | null }).identidade_hoje ?? null,
    ]),
  );

  const aderenciaByUser = new Map<string, number | null>();
  for (const row of mlRes.data ?? []) {
    const expl = (row.explicacao ?? {}) as { identity_adherence?: number };
    const v = Number(expl.identity_adherence);
    aderenciaByUser.set(row.user_id, Number.isFinite(v) ? Math.round(v * 100) : null);
  }

  const proofsWeekByUser = new Map<string, number>();
  for (const row of proofsRes.data ?? []) {
    proofsWeekByUser.set(row.user_id, (proofsWeekByUser.get(row.user_id) ?? 0) + 1);
  }

  let sent = 0;
  for (const profile of targets) {
    const habitIds = habitsByUser.get(profile.id) ?? [];
    const done = doneByUser.get(profile.id) ?? new Set<string>();
    const doneCount = habitIds.filter((id) => done.has(id)).length;
    const ego = egoByUser.get(profile.id);
    const firstName = profile.nome?.trim().split(/\s+/)[0] ?? null;

    const report = buildIdentityEveningReport({
      firstName,
      alterEgoNome: ego?.nome ?? null,
      codigoLine: ego?.codigoLine ?? null,
      habitsDone: doneCount,
      habitsTotal: habitIds.length,
      proofsWeek: proofsWeekByUser.get(profile.id) ?? 0,
      identidadeHoje: checkinByUser.get(profile.id) ?? null,
      aderenciaPct: aderenciaByUser.get(profile.id) ?? null,
    });

    const res = await createNotificationOncePerDay({
      userId: profile.id,
      tipo: "identity_report",
      titulo: report.titulo,
      corpo: report.corpo,
      metadata: {
        href: "/mentor",
        kind: "evening",
        identity_report: true,
        ...(ego?.codigoLine
          ? {
              identity_codigo: ego.codigoLine,
              alter_ego_nome: ego.nome,
            }
          : {}),
      },
      dia: hoje,
    });
    if (res.ok && !res.skipped) sent += 1;
  }

  return sent;
}
