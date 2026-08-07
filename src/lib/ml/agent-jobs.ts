/**
 * Job ML Fase 4 — CF + iniciativas do agente (service role).
 * Usado pela Edge Function e pode ser chamado localmente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { decideAgentInitiative } from "@/lib/ml/agent";
import { scoresFromMlRow } from "@/lib/ml/adaptive";
import { computeCfRecommendations } from "@/lib/ml/collaborative";
import { isQuietHoursUtc } from "@/notifications/jobs";
import { createNotification } from "@/notifications/create";
import { hourInTz, hojeISO, zonedDayBoundsUtcIso } from "@/lib/datetime";

type Admin = SupabaseClient<Database>;

function dayBounds(dia: string) {
  return zonedDayBoundsUtcIso(dia);
}

export async function runCfAndAgentJobs(
  admin: Admin,
  opts?: { force?: boolean; now?: Date; limit?: number },
): Promise<{
  quietHours: boolean;
  cfUsers: number;
  cfWritten: number;
  initiativesCreated: number;
  skippedQuiet: boolean;
}> {
  const now = opts?.now ?? new Date();
  const force = Boolean(opts?.force);
  const quietHours = isQuietHoursUtc(now);
  const hoje = hojeISO(now);
  const limit = opts?.limit ?? 500;

  const cfWritten = await recomputeAllCf(admin, limit);

  let initiativesCreated = 0;
  let skippedQuiet = false;

  if (quietHours && !force) {
    skippedQuiet = true;
  } else {
    initiativesCreated = await createInitiatives(admin, hoje, now, limit);
  }

  return {
    quietHours,
    cfUsers: cfWritten.users,
    cfWritten: cfWritten.written,
    initiativesCreated,
    skippedQuiet,
  };
}

async function recomputeAllCf(admin: Admin, limit: number) {
  const { data: features } = await admin
    .from("user_features")
    .select("user_id, weekday_rates")
    .limit(limit);

  const userIds = (features ?? []).map((f) => f.user_id);
  if (!userIds.length) return { users: 0, written: 0 };

  const { data: habits } = await admin
    .from("habits")
    .select("user_id, titulo, atributo")
    .eq("ativo", true)
    .in("user_id", userIds);

  const habitsByUser = new Map<string, { titles: string[]; attrs: Record<string, string> }>();
  for (const h of habits ?? []) {
    const cur = habitsByUser.get(h.user_id) ?? { titles: [], attrs: {} };
    cur.titles.push(h.titulo);
    cur.attrs[h.titulo] = h.atributo;
    habitsByUser.set(h.user_id, cur);
  }

  const users = (features ?? []).map((f) => {
    const h = habitsByUser.get(f.user_id);
    const rates =
      typeof f.weekday_rates === "object" && f.weekday_rates && !Array.isArray(f.weekday_rates)
        ? (f.weekday_rates as Record<string, number>)
        : {};
    return {
      user_id: f.user_id,
      weekday_rates: rates,
      habit_titles: h?.titles ?? [],
      habit_attrs: h?.attrs,
    };
  });

  const recs = computeCfRecommendations(users);
  let written = 0;
  const nowIso = new Date().toISOString();

  for (const [userId, rec] of recs) {
    const { error } = await admin.from("user_cf_recommendations").upsert(
      {
        user_id: userId,
        computed_at: nowIso,
        model_version: "cf_weekday_v1",
        peer_count: rec.peer_count,
        suggestions: rec.suggestions as unknown as Json,
        explicacao: rec.explicacao as Json,
      },
      { onConflict: "user_id" },
    );
    if (!error) written += 1;
    else if (!/does not exist|user_cf_recommendations/i.test(error.message)) {
      console.error("[agent-cf]", userId, error.message);
    }
  }

  return { users: users.length, written };
}

async function createInitiatives(admin: Admin, hoje: string, now: Date, limit: number) {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("onboarding_completo", true)
    .limit(limit);

  let created = 0;
  const { start, end } = dayBounds(hoje);

  for (const p of profiles ?? []) {
    const userId = p.id;

    const [mlRes, checkinRes, pendingRes, notifRes, cfRes] = await Promise.all([
      admin
        .from("user_ml_scores")
        .select("risco_streak, risco_abandono, weekday_weakest, explicacao")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("user_checkins")
        .select("id")
        .eq("user_id", userId)
        .eq("dia", hoje)
        .maybeSingle(),
      admin
        .from("agent_initiatives")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle(),
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("tipo", "agent_initiative")
        .gte("created_at", start)
        .lte("created_at", end),
      admin
        .from("user_cf_recommendations")
        .select("peer_count, suggestions")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const suggestions = Array.isArray(cfRes.data?.suggestions)
      ? (cfRes.data!.suggestions as Array<{
          titulo?: string;
          score?: number;
          from_peers?: number;
          atributo?: string | null;
        }>)
      : [];
    const top = suggestions[0];
    const cfSuggestion =
      top?.titulo && (cfRes.data?.peer_count ?? 0) >= 5
        ? {
            titulo: top.titulo,
            score: Number(top.score) || 0,
            from_peers: Number(top.from_peers) || cfRes.data!.peer_count,
            atributo: top.atributo ?? null,
          }
        : null;

    const scores = scoresFromMlRow(mlRes.data);
    const decision = decideAgentInitiative({
      scores,
      hasCheckinToday: Boolean(checkinRes.data),
      hasPendingInitiative: Boolean(pendingRes.data),
      alreadyNotifiedToday: (notifRes.count ?? 0) > 0,
      quietHours: false,
      cfSuggestion,
      hourLocalApprox: hourInTz(now),
    });

    if (!decision.create || !decision.kind) continue;

    const expires = new Date(now);
    expires.setUTCDate(expires.getUTCDate() + 2);

    const { data: initiative, error: iErr } = await admin
      .from("agent_initiatives")
      .insert({
        user_id: userId,
        kind: decision.kind,
        titulo: decision.titulo,
        corpo: decision.corpo,
        status: "pending",
        href: decision.href,
        metadata: { reasons: decision.reasons } as Json,
        expires_at: expires.toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (iErr) {
      // unique pending index — skip
      continue;
    }

    const notif = await createNotification({
      userId,
      tipo: "agent_initiative",
      titulo: decision.titulo,
      corpo: decision.corpo,
      metadata: {
        href: decision.href,
        initiative_id: initiative?.id,
        kind: decision.kind,
        ml_guided: true,
        risco_streak: scores?.risco_streak ?? null,
        risco_abandono: scores?.risco_abandono ?? null,
        weekday_weakest_label: scores?.weekday_weakest_label ?? null,
      },
    });

    if (notif.ok) created += 1;
  }

  return created;
}
