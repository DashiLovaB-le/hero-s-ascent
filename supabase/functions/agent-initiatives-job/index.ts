/**
 * Edge Function: agent-initiatives-job (ML Fase 4)
 * Agenda: 04:00 UTC. Header x-cron-secret.
 * Body: `{ "force": true }` ignora quiet hours.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ML_HIGH = 0.55;
const ML_MOD = 0.35;
const MIN_PEERS = 5;

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const cronHeader = req.headers.get("x-cron-secret")?.trim() ?? "";
    const bearer =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
    const provided = cronHeader || (bearer.includes(".") ? "" : bearer);
    if (!cronSecret || provided !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = Boolean(body?.force);
      } catch {
        /* ok */
      }
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Missing Supabase env" }, 500);

    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date();
    const quiet = isQuietHoursUtc(now);
    const hoje = now.toISOString().slice(0, 10);

    const cf = await recomputeCf(admin);
    let initiatives = 0;
    let skippedQuiet = false;
    if (quiet && !force) skippedQuiet = true;
    else initiatives = await createInitiatives(admin, hoje, now);

    return json({
      ok: true,
      quietHours: quiet,
      forced: force,
      skippedQuiet,
      cfUsers: cf.users,
      cfWritten: cf.written,
      initiativesCreated: initiatives,
    });
  } catch (e) {
    console.error("[agent-initiatives-job]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
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
  return h >= 2 && h < 10;
}

function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function rateVec(rates: Record<string, number>) {
  return Array.from({ length: 7 }, (_, i) => Number(rates[String(i)] ?? 0));
}

async function recomputeCf(admin: ReturnType<typeof createClient>) {
  const { data: features } = await admin.from("user_features").select("user_id, weekday_rates").limit(500);
  const userIds = (features ?? []).map((f: { user_id: string }) => f.user_id);
  if (!userIds.length) return { users: 0, written: 0 };

  const { data: habits } = await admin
    .from("habits")
    .select("user_id, atributo")
    .eq("ativo", true)
    .in("user_id", userIds);

  const attrsByUser = new Map<string, string[]>();
  for (const h of habits ?? []) {
    const list = attrsByUser.get(h.user_id) ?? [];
    if (h.atributo) list.push(h.atributo);
    attrsByUser.set(h.user_id, list);
  }

  const users = (features ?? []).map((f: { user_id: string; weekday_rates: unknown }) => ({
    user_id: f.user_id,
    weekday_rates:
      typeof f.weekday_rates === "object" && f.weekday_rates && !Array.isArray(f.weekday_rates)
        ? (f.weekday_rates as Record<string, number>)
        : {},
    habit_attrs: attrsByUser.get(f.user_id) ?? [],
  }));

  let written = 0;
  const nowIso = new Date().toISOString();

  for (const target of users) {
    const tv = rateVec(target.weekday_rates);
    const peers = users
      .filter((u) => u.user_id !== target.user_id)
      .map((u) => ({ u, sim: cosine(tv, rateVec(u.weekday_rates)) }))
      .filter((x) => x.sim > 0.35)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 12);

    let suggestions: Array<{ titulo: string; atributo: string; score: number; from_peers: number }> = [];
    if (peers.length >= MIN_PEERS) {
      const mine = new Set(
        target.habit_attrs.map((a) => a.trim().toLowerCase()).filter(Boolean),
      );
      const votes = new Map<string, { score: number; count: number }>();
      for (const p of peers) {
        const seen = new Set<string>();
        for (const raw of p.u.habit_attrs) {
          const attr = raw.trim().toLowerCase();
          if (!attr || mine.has(attr) || seen.has(attr)) continue;
          seen.add(attr);
          const prev = votes.get(attr) ?? { score: 0, count: 0 };
          prev.score += p.sim;
          prev.count += 1;
          votes.set(attr, prev);
        }
      }
      suggestions = [...votes.entries()]
        .map(([atributo, v]) => ({
          titulo: atributo,
          atributo,
          score: v.score / Math.max(1, v.count),
          from_peers: v.count,
        }))
        .filter((s) => s.from_peers >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }

    const { error } = await admin.from("user_cf_recommendations").upsert(
      {
        user_id: target.user_id,
        computed_at: nowIso,
        model_version: "cf_weekday_v1",
        peer_count: peers.length,
        suggestions,
        explicacao: { model: "cf_weekday_v1" },
      },
      { onConflict: "user_id" },
    );
    if (!error) written += 1;
  }

  return { users: users.length, written };
}

async function createInitiatives(
  admin: ReturnType<typeof createClient>,
  hoje: string,
  now: Date,
) {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("onboarding_completo", true)
    .limit(500);

  let created = 0;
  const start = `${hoje}T00:00:00.000Z`;
  const end = `${hoje}T23:59:59.999Z`;

  for (const p of profiles ?? []) {
    const userId = p.id;
    const [mlRes, checkinRes, pendingRes, notifRes, cfRes] = await Promise.all([
      admin
        .from("user_ml_scores")
        .select("risco_streak, risco_abandono, explicacao")
        .eq("user_id", userId)
        .maybeSingle(),
      admin.from("user_checkins").select("id").eq("user_id", userId).eq("dia", hoje).maybeSingle(),
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

    if (pendingRes.data || (notifRes.count ?? 0) > 0) continue;

    const riscoS = Number(mlRes.data?.risco_streak) || 0;
    const riscoA = Number(mlRes.data?.risco_abandono) || 0;
    const weak =
      (mlRes.data?.explicacao as { weekday_weakest_label?: string } | null)
        ?.weekday_weakest_label ?? null;
    const hour = now.getUTCHours() - 3;
    const evening = hour >= 20 || hour < 2;

    let kind: string | null = null;
    let titulo = "";
    let corpo = "";
    let href = "/mentor";

    if (riscoS >= ML_HIGH) {
      kind = "streak_protect";
      titulo = "Iniciativa: proteja sua sequência";
      corpo = weak
        ? `Risco de streak alto. Seu padrão fraco costuma ser ${weak}. Fale com o Charlie ou feche um hábito hoje.`
        : "Risco de streak alto. Um hábito hoje segura o ritmo — o Charlie pode orientar.";
      href = "/habits";
    } else if (!checkinRes.data && (riscoA >= ML_MOD || riscoS >= ML_MOD || evening)) {
      kind = "checkin_nudge";
      titulo = "Check-in do dia";
      corpo = "Registre sono, energia e humor na Jornada — o Charlie usa isso com parcimônia.";
      href = "/journey";
    } else {
      const suggestions = Array.isArray(cfRes.data?.suggestions) ? cfRes.data!.suggestions : [];
      const top = suggestions[0] as { atributo?: string; titulo?: string } | undefined;
      const attr = (top?.atributo ?? "").trim();
      if (attr && (cfRes.data?.peer_count ?? 0) >= MIN_PEERS) {
        kind = "cf_habit_hint";
        titulo = "Ideia de quem caminha parecido";
        corpo = `Heróis com ritmo similar costumam fortalecer ${attr.toLowerCase()}. Vale um hábito nessa linha — sem obrigação.`;
        href = "/habits";
      }
    }

    if (!kind) continue;

    const expires = new Date(now);
    expires.setUTCDate(expires.getUTCDate() + 2);

    const { data: initiative, error: iErr } = await admin
      .from("agent_initiatives")
      .insert({
        user_id: userId,
        kind,
        titulo,
        corpo,
        status: "pending",
        href,
        metadata: {},
        expires_at: expires.toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (iErr) continue;

    const { error: nErr } = await admin.from("notifications").insert({
      user_id: userId,
      tipo: "agent_initiative",
      titulo,
      corpo,
      metadata: { href, initiative_id: initiative?.id, kind, ml_guided: true },
    });
    if (!nErr) created += 1;
  }

  return created;
}
