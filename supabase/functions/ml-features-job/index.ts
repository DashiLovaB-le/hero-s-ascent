/**
 * Edge Function: ml-features-job (ML Fase 1)
 *
 * Agenda: `0 3 * * *` (03:00 UTC).
 * Header: `x-cron-secret: <CRON_SECRET>` (mesmo secret do notification-jobs).
 * Body JSON opcional: `{ "limit": 500 }` — máx. usuários por execução.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { computeUserFeatures, scoreUserHeuristicV1 } from "./compute.ts";

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

    let limit = 500;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.limit === "number" && body.limit > 0) {
          limit = Math.min(2000, Math.floor(body.limit));
        }
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

    const asOfDate = new Date().toISOString().slice(0, 10);
    const from21 = addDays(asOfDate, -20);

    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, xp_total, streak_atual, streak_maximo, ultimo_dia_completo")
      .eq("onboarding_completo", true)
      .limit(limit);

    if (pErr) throw new Error(pErr.message);

    let ok = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const prof of profiles ?? []) {
      try {
        await recomputeOne(admin, prof, asOfDate, from21);
        ok += 1;
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${prof.id}: ${msg}`);
        console.error("[ml-features-job]", prof.id, msg);
      }
    }

    return json({
      ok: true,
      asOfDate,
      processed: ok,
      failed,
      total: (profiles ?? []).length,
      errors: errors.slice(0, 10),
    });
  } catch (e) {
    console.error("[ml-features-job]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function recomputeOne(
  admin: ReturnType<typeof createClient>,
  prof: {
    id: string;
    xp_total: number;
    streak_atual: number;
    streak_maximo: number;
    ultimo_dia_completo: string | null;
  },
  asOfDate: string,
  from21: string,
) {
  const [habitsRes, compsRes, chalRes] = await Promise.all([
    admin.from("habits").select("id").eq("user_id", prof.id).eq("ativo", true),
    admin
      .from("habit_completions")
      .select("habit_id, dia, xp_ganho")
      .eq("user_id", prof.id)
      .gte("dia", from21)
      .lte("dia", asOfDate),
    admin
      .from("mentor_challenges")
      .select("status, completed_at, ends_at, created_at")
      .eq("user_id", prof.id),
  ]);

  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (compsRes.error) throw new Error(compsRes.error.message);

  const features = computeUserFeatures({
    asOfDate,
    habitCountAtivo: habitsRes.data?.length ?? 0,
    completions: compsRes.data ?? [],
    challenges: chalRes.error ? [] : (chalRes.data ?? []),
    streak_atual: prof.streak_atual,
    streak_maximo: prof.streak_maximo,
    xp_total: prof.xp_total,
    ultimo_dia_completo: prof.ultimo_dia_completo,
  });
  const scores = scoreUserHeuristicV1(features, { asOfDate });
  const nowIso = new Date().toISOString();

  const { error: fErr } = await admin.from("user_features").upsert(
    {
      user_id: prof.id,
      computed_at: nowIso,
      features_version: features.features_version,
      dias_ativos_7: features.dias_ativos_7,
      dias_ativos_21: features.dias_ativos_21,
      dias_sem_habito: features.dias_sem_habito,
      media_habitos_dia_7: features.media_habitos_dia_7,
      media_habitos_dia_21: features.media_habitos_dia_21,
      taxa_conclusao_7: features.taxa_conclusao_7,
      taxa_conclusao_21: features.taxa_conclusao_21,
      weekday_rates: features.weekday_rates,
      streak_atual: features.streak_atual,
      streak_maximo: features.streak_maximo,
      xp_total: features.xp_total,
      nivel: features.nivel,
      desafios_ativos: features.desafios_ativos,
      desafios_concluidos_21: features.desafios_concluidos_21,
      desafios_expirados_21: features.desafios_expirados_21,
      ultimo_dia_completo: features.ultimo_dia_completo,
      dias_desde_ultima_atividade: features.dias_desde_ultima_atividade,
      media_xp_dia_21: features.media_xp_dia_21,
    },
    { onConflict: "user_id" },
  );
  if (fErr) throw new Error(fErr.message);

  const { error: sErr } = await admin.from("user_ml_scores").upsert(
    {
      user_id: prof.id,
      computed_at: nowIso,
      model_version: scores.model_version,
      risco_streak: scores.risco_streak,
      risco_abandono: scores.risco_abandono,
      projecao_dias_proximo_nivel: scores.projecao_dias_proximo_nivel,
      weekday_weakest: scores.weekday_weakest,
      explicacao: scores.explicacao,
    },
    { onConflict: "user_id" },
  );
  if (sErr) throw new Error(sErr.message);
}
