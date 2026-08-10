import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { weekBoundsMondayUtcIso } from "@/lib/datetime";
import { PUSHUP_SLUG } from "@/lib/exercise-xp";

export type ExerciseRankingEntry = {
  rank: number;
  userId: string;
  nome: string;
  reps: number;
  formaPct: number | null;
  isMe: boolean;
};

export type ExerciseRankingMe = {
  rank: number | null;
  reps: number;
  formaPct: number | null;
  optedIn: boolean;
  inTop: boolean;
};

type AggRow = {
  userId: string;
  reps: number;
  formaWeighted: number;
  firstEndedAt: string;
};

function displayName(nome: string | null | undefined): string {
  const t = (nome ?? "").trim();
  return t || "Herói";
}

function formaFromAgg(row: AggRow): number | null {
  if (row.reps <= 0) return null;
  return Math.round((row.formaWeighted / row.reps) * 10) / 10;
}

function compareAgg(a: AggRow, b: AggRow): number {
  if (b.reps !== a.reps) return b.reps - a.reps;
  const fa = a.reps > 0 ? a.formaWeighted / a.reps : 0;
  const fb = b.reps > 0 ? b.formaWeighted / b.reps : 0;
  if (fb !== fa) return fb - fa;
  return a.firstEndedAt.localeCompare(b.firstEndedAt);
}

/** Ranking semanal (segunda–domingo, America/Sao_Paulo) de reps válidas. */
export const getExerciseRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        slug: z.string().trim().min(1).max(40).default(PUSHUP_SLUG),
        limit: z.number().int().min(5).max(50).default(20),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const slug = data.slug || PUSHUP_SLUG;
    const limit = data.limit ?? 20;
    const { userId } = context;

    const { data: exType, error: typeErr } = await supabaseAdmin
      .from("exercise_types")
      .select("id, slug, nome")
      .eq("slug", slug)
      .eq("ativo", true)
      .maybeSingle();
    if (typeErr) throw new Error(typeErr.message);
    if (!exType) throw new Error("Exercício não encontrado.");

    const week = weekBoundsMondayUtcIso();

    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from("exercise_sessions")
      .select("id, user_id, ended_at")
      .eq("exercise_type_id", exType.id)
      .eq("status", "completed")
      .gte("ended_at", week.startIso)
      .lt("ended_at", week.endExclusiveIso);
    if (sessErr) throw new Error(sessErr.message);

    const sessionRows = sessions ?? [];
    const sessionIds = sessionRows.map((s) => s.id);

    const metricsBySession = new Map<
      string,
      { reps_validas: number; forma_pct: number | null }
    >();
    if (sessionIds.length) {
      // Paginar se muitos ids (limite prático do .in)
      const chunkSize = 200;
      for (let i = 0; i < sessionIds.length; i += chunkSize) {
        const chunk = sessionIds.slice(i, i + chunkSize);
        const { data: metrics, error: mErr } = await supabaseAdmin
          .from("exercise_session_metrics")
          .select("session_id, reps_validas, forma_pct")
          .in("session_id", chunk)
          .gt("reps_validas", 0);
        if (mErr) throw new Error(mErr.message);
        for (const m of metrics ?? []) {
          metricsBySession.set(m.session_id, {
            reps_validas: m.reps_validas,
            forma_pct: m.forma_pct == null ? null : Number(m.forma_pct),
          });
        }
      }
    }

    const aggByUser = new Map<string, AggRow>();
    for (const s of sessionRows) {
      const m = metricsBySession.get(s.id);
      if (!m || m.reps_validas < 1) continue;
      const ended = s.ended_at ?? week.startIso;
      const prev = aggByUser.get(s.user_id);
      const forma = m.forma_pct ?? 0;
      if (!prev) {
        aggByUser.set(s.user_id, {
          userId: s.user_id,
          reps: m.reps_validas,
          formaWeighted: m.reps_validas * forma,
          firstEndedAt: ended,
        });
      } else {
        prev.reps += m.reps_validas;
        prev.formaWeighted += m.reps_validas * forma;
        if (ended < prev.firstEndedAt) prev.firstEndedAt = ended;
      }
    }

    const candidateIds = [...aggByUser.keys()];
    const optedInIds = new Set<string>();
    const names = new Map<string, string>();

    if (candidateIds.length) {
      const chunkSize = 200;
      for (let i = 0; i < candidateIds.length; i += chunkSize) {
        const chunk = candidateIds.slice(i, i + chunkSize);
        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, nome, ranking_opt_in")
          .in("id", chunk);
        if (pErr) {
          if (/ranking_opt_in/i.test(pErr.message)) {
            throw new Error(
              "Migration ranking_opt_in pendente. Aplique a migration no Supabase.",
            );
          }
          throw new Error(pErr.message);
        }
        for (const p of profiles ?? []) {
          names.set(p.id, displayName(p.nome));
          if (p.ranking_opt_in !== false) optedInIds.add(p.id);
        }
      }
    }

    const { data: meProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome, ranking_opt_in")
      .eq("id", userId)
      .maybeSingle();
    const meOptedIn = meProfile?.ranking_opt_in !== false;
    if (meProfile) names.set(userId, displayName(meProfile.nome));

    const ranked = [...aggByUser.values()]
      .filter((r) => optedInIds.has(r.userId))
      .sort(compareAgg);

    const topRaw = ranked.slice(0, limit);
    const top: ExerciseRankingEntry[] = topRaw.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      nome: names.get(r.userId) ?? "Herói",
      reps: r.reps,
      formaPct: formaFromAgg(r),
      isMe: r.userId === userId,
    }));

    const meAgg = aggByUser.get(userId);
    let me: ExerciseRankingMe = {
      rank: null,
      reps: meAgg?.reps ?? 0,
      formaPct: meAgg ? formaFromAgg(meAgg) : null,
      optedIn: meOptedIn,
      inTop: false,
    };

    if (meOptedIn && meAgg && meAgg.reps > 0) {
      const idx = ranked.findIndex((r) => r.userId === userId);
      me = {
        ...me,
        rank: idx >= 0 ? idx + 1 : null,
        inTop: idx >= 0 && idx < limit,
      };
    }

    // Vizinhos (±2) quando fora do top
    let neighbors: ExerciseRankingEntry[] = [];
    if (me.rank != null && !me.inTop) {
      const idx = me.rank - 1;
      const from = Math.max(0, idx - 2);
      const to = Math.min(ranked.length, idx + 3);
      neighbors = ranked.slice(from, to).map((r, i) => ({
        rank: from + i + 1,
        userId: r.userId,
        nome: names.get(r.userId) ?? "Herói",
        reps: r.reps,
        formaPct: formaFromAgg(r),
        isMe: r.userId === userId,
      }));
    }

    return {
      exercise: { slug: exType.slug, nome: exType.nome },
      weekStart: week.weekStartKey,
      weekEnd: week.weekEndKey,
      top,
      me,
      neighbors,
      participants: ranked.length,
    };
  });

export const getRankingOptIn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("ranking_opt_in")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) {
      if (/ranking_opt_in/i.test(error.message)) {
        return { optedIn: true };
      }
      throw new Error(error.message);
    }
    return { optedIn: data?.ranking_opt_in !== false };
  });

export const updateRankingOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ optedIn: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ranking_opt_in: data.optedIn, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) {
      if (/ranking_opt_in/i.test(error.message)) {
        throw new Error("Migration ranking_opt_in pendente no banco.");
      }
      throw new Error(error.message);
    }
    return { optedIn: data.optedIn };
  });
