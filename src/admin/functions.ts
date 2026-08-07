import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertIsAdmin, countAdmins, isUserAdmin, DASHI_ROLE } from "@/admin/auth";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabasePublicEnv } from "@/integrations/supabase/env";
import { WALLPAPERS } from "@/lib/wallpapers";
import { recomputeUserMl } from "@/lib/ml/recompute";
import { runProductNotificationJobs } from "@/notifications/jobs";
import { runCfAndAgentJobs } from "@/lib/ml/agent-jobs";
import { hojeISO, addDaysToDateKey, calendarDateInTz } from "@/lib/datetime";

async function withAdmin(userId: string) {
  await assertIsAdmin(userId);
}

export type AdminUserRow = {
  userId: string;
  displayName: string;
  onboardingDone: boolean;
  wallpaperId: string | null;
  createdAt: string;
  updatedAt: string;
  xpTotal: number;
  chapter: number;
  streakCurrent: number;
  streakMax: number;
  riscoAbandono: number | null;
  riscoStreak: number | null;
  mlModel: string | null;
  roles: string[];
  telegramLinked: boolean;
  telegramOptIn: boolean;
};

export const adminAmIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isUserAdmin(context.userId);
    const admins = await countAdmins();
    return { admin, adminsTotal: admins, userId: context.userId };
  });

/** Se não há nenhum `dashi`, o primeiro login com email = DASHI_BOOTSTRAP_EMAIL (ou ADMIN_BOOTSTRAP_EMAIL) vira dashi. */
export const adminClaimBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admins = await countAdmins();
    if (admins > 0) {
      throw new Error("Bootstrap indisponível: já existem usuários com role dashi.");
    }
    const expected = (
      process.env.DASHI_BOOTSTRAP_EMAIL ??
      process.env.ADMIN_BOOTSTRAP_EMAIL ??
      ""
    )
      .trim()
      .toLowerCase();
    if (!expected) {
      throw new Error("Defina DASHI_BOOTSTRAP_EMAIL no servidor.");
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userData.user?.email) {
      throw new Error(userErr?.message ?? "Usuário sem email.");
    }
    if (userData.user.email.toLowerCase() !== expected) {
      throw new Error("Email não autorizado para bootstrap.");
    }
    const { error } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: DASHI_ROLE },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminCockpit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const today = hojeISO();

    const [
      profiles,
      habitsDone,
      notifUnread,
      highRisk,
      initiatives,
      telegramLinks,
      checkinsToday,
      shadowScores,
      modelRuns,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .eq("dia", today),
      supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("lido_em", null),
      supabaseAdmin
        .from("user_ml_scores")
        .select("user_id", { count: "exact", head: true })
        .gte("risco_abandono", 0.55),
      supabaseAdmin
        .from("agent_initiatives")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("telegram_chat_id", "is", null),
      supabaseAdmin
        .from("user_checkins")
        .select("id", { count: "exact", head: true })
        .eq("dia", today),
      supabaseAdmin.from("user_ml_scores_shadow").select("user_id", { count: "exact", head: true }),
      supabaseAdmin
        .from("ml_model_runs")
        .select("id, model_version, auc_streak, auc_abandono, promoted, trained_at, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      users: profiles.count ?? 0,
      habitsToday: habitsDone.count ?? 0,
      notifUnread: notifUnread.count ?? 0,
      highRisk: highRisk.count ?? 0,
      initiativesPending: initiatives.count ?? 0,
      telegramLinked: telegramLinks.count ?? 0,
      checkinsToday: checkinsToday.count ?? 0,
      shadowScores: shadowScores.count ?? 0,
      recentModelRuns: modelRuns.data ?? [],
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const limit = data.limit ?? 80;
    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id, nome, onboarding_completo, wallpaper_id, created_at, updated_at, xp_total, capitulo_atual, streak_atual, streak_maximo, telegram_chat_id, telegram_opt_in",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (data.q?.trim()) {
      query = query.ilike("nome", `%${data.q.trim()}%`);
    }

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return { users: [] as AdminUserRow[] };

    const [scores, roles] = await Promise.all([
      supabaseAdmin
        .from("user_ml_scores")
        .select("user_id, risco_abandono, risco_streak, model_version")
        .in("user_id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    const scoreMap = new Map((scores.data ?? []).map((r) => [r.user_id, r]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role);
      roleMap.set(r.user_id, list);
    }

    const users: AdminUserRow[] = (profiles ?? []).map((p) => {
      const score = scoreMap.get(p.id);
      return {
        userId: p.id,
        displayName: p.nome,
        onboardingDone: p.onboarding_completo,
        wallpaperId: p.wallpaper_id ?? null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        xpTotal: p.xp_total,
        chapter: p.capitulo_atual,
        streakCurrent: p.streak_atual,
        streakMax: p.streak_maximo,
        riscoAbandono: score?.risco_abandono ?? null,
        riscoStreak: score?.risco_streak ?? null,
        mlModel: score?.model_version ?? null,
        roles: roleMap.get(p.id) ?? ["user"],
        telegramLinked: Boolean(p.telegram_chat_id),
        telegramOptIn: Boolean(p.telegram_opt_in),
      };
    });

    return { users };
  });

const HEROES_GROWTH_RANGES = ["7d", "30d", "90d", "all"] as const;
export type HeroesGrowthRange = (typeof HEROES_GROWTH_RANGES)[number];

/** Série diária de cadastros (novos + acumulado) para o gráfico em /dashitecnology/users. */
export const adminHeroesGrowth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        range: z.enum(HEROES_GROWTH_RANGES).default("30d"),
        onboardedOnly: z.boolean().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);

    let query = supabaseAdmin.from("profiles").select("created_at, onboarding_completo");
    if (data.onboardedOnly) {
      query = query.eq("onboarding_completo", true);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const today = hojeISO();
    const byDay = new Map<string, number>();
    let earliest: string | null = null;

    for (const row of rows ?? []) {
      if (!row.created_at) continue;
      const day = calendarDateInTz(new Date(row.created_at));
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      if (!earliest || day < earliest) earliest = day;
    }

    const totalHeroes = rows?.length ?? 0;
    if (totalHeroes === 0 || !earliest) {
      return {
        range: data.range,
        onboardedOnly: Boolean(data.onboardedOnly),
        totalHeroes: 0,
        newInPeriod: 0,
        from: today,
        to: today,
        points: [] as { date: string; label: string; novos: number; acumulado: number }[],
      };
    }

    const lookback =
      data.range === "7d" ? 6 : data.range === "30d" ? 29 : data.range === "90d" ? 89 : null;

    const axisFrom =
      lookback == null ? earliest : addDaysToDateKey(today, -lookback);
    const days: string[] = [];
    {
      let cur = axisFrom;
      while (cur <= today) {
        days.push(cur);
        cur = addDaysToDateKey(cur, 1);
        if (days.length > 3000) break;
      }
    }

    let baseline = 0;
    for (const [day, n] of byDay) {
      if (day < axisFrom) baseline += n;
    }

    let running = baseline;
    const points = days.map((date) => {
      const novos = byDay.get(date) ?? 0;
      running += novos;
      const [, m, d] = date.split("-");
      return {
        date,
        label: `${d}/${m}`,
        novos,
        acumulado: running,
      };
    });

    const newInPeriod = points.reduce((sum, p) => sum + p.novos, 0);

    return {
      range: data.range,
      onboardedOnly: Boolean(data.onboardedOnly),
      totalHeroes,
      newInPeriod,
      from: axisFrom,
      to: today,
      points,
    };
  });

export const adminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const uid = data.userId;

    async function safe<T>(
      label: string,
      run: () => PromiseLike<{ data: T; error: { message: string } | null }>,
      fallback: T,
    ): Promise<T> {
      try {
        const res = await run();
        if (res.error) {
          console.warn(`[adminUserDetail] ${label}:`, res.error.message);
          return fallback;
        }
        return (res.data ?? fallback) as T;
      } catch (e) {
        console.warn(`[adminUserDetail] ${label} threw:`, e);
        return fallback;
      }
    }

    const [
      profile,
      attrs,
      habits,
      goals,
      scores,
      features,
      shadow,
      initiatives,
      checkins,
      roles,
      notifs,
      challenges,
    ] = await Promise.all([
      safe(
        "profile",
        () => supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
        null,
      ),
      safe(
        "attributes",
        () => supabaseAdmin.from("attributes").select("*").eq("user_id", uid).maybeSingle(),
        null,
      ),
      safe(
        "habits",
        () =>
          supabaseAdmin
            .from("habits")
            .select("id, titulo, atributo, ativo, created_at, xp_recompensa")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(50),
        [],
      ),
      safe(
        "goals",
        () =>
          supabaseAdmin
            .from("goals")
            .select("id, titulo, categoria, ativo, created_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(50),
        [],
      ),
      safe(
        "ml_scores",
        () => supabaseAdmin.from("user_ml_scores").select("*").eq("user_id", uid).maybeSingle(),
        null,
      ),
      safe(
        "features",
        () => supabaseAdmin.from("user_features").select("*").eq("user_id", uid).maybeSingle(),
        null,
      ),
      safe(
        "shadow",
        () =>
          supabaseAdmin
            .from("user_ml_scores_shadow")
            .select("*")
            .eq("user_id", uid)
            .order("computed_at", { ascending: false })
            .limit(5),
        [],
      ),
      safe(
        "initiatives",
        () =>
          supabaseAdmin
            .from("agent_initiatives")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(20),
        [],
      ),
      safe(
        "checkins",
        () =>
          supabaseAdmin
            .from("user_checkins")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(20),
        [],
      ),
      safe(
        "roles",
        () => supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
        [],
      ),
      safe(
        "notifications",
        () =>
          supabaseAdmin
            .from("notifications")
            .select("id, tipo, titulo, corpo, lido_em, created_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(30),
        [],
      ),
      safe(
        "challenges",
        () =>
          supabaseAdmin
            .from("mentor_challenges")
            .select("id, titulo, status, xp_recompensa, created_at, completed_at, ends_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(20),
        [],
      ),
    ]);

    return {
      profile,
      attributes: attrs,
      habits: habits ?? [],
      goals: goals ?? [],
      mlScore: scores,
      features,
      shadowScores: shadow ?? [],
      initiatives: initiatives ?? [],
      checkins: checkins ?? [],
      roles: (roles ?? []).map((r: { role: string }) => r.role),
      recentNotifications: notifs ?? [],
      challenges: challenges ?? [],
      profileError: profile ? null : "Perfil não encontrado.",
    };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["dashi", "user"]),
        action: z.enum(["grant", "revoke"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    if (data.role === "dashi" && data.action === "revoke" && data.userId === context.userId) {
      throw new Error("Não pode remover o próprio role dashi.");
    }
    if (data.action === "grant") {
      const { error } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.userId, role: data.role },
        { onConflict: "user_id,role" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const adminAdjustXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        delta: z.number().int().min(-100000).max(100000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { data: prog, error } = await supabaseAdmin
      .from("profiles")
      .select("xp_total")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prog) throw new Error("Perfil não encontrado.");
    const next = Math.max(0, prog.xp_total + data.delta);
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ xp_total: next })
      .eq("id", data.userId);
    if (upErr) throw new Error(upErr.message);
    return { xpTotal: next };
  });

/**
 * Apaga o histórico do herói (chat, conclusões, missões, ML, notificações,
 * sessões de exercício validado, metas…)
 * Mantém conta, perfil (nome/bio/wallpaper), hábitos cadastrados e roles.
 * Zera XP / streak / capítulo.
 */
export const adminClearUserHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        confirm: z.literal("LIMPAR"),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const uid = data.userId;

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome")
      .eq("id", uid)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Perfil não encontrado.");

    async function del(table: string) {
      const { error, count } = await supabaseAdmin
        .from(table as "mentor_messages")
        .delete({ count: "exact" })
        .eq("user_id", uid);
      if (error) {
        // Tabelas opcionais / migration ausente — não bloqueia
        if (/does not exist|schema cache/i.test(error.message)) {
          return { table, deleted: 0, skipped: true as const };
        }
        throw new Error(`${table}: ${error.message}`);
      }
      return { table, deleted: count ?? 0, skipped: false as const };
    }

    const tables = [
      "mentor_messages",
      "mentor_memories",
      "mentor_challenges",
      "mentor_objectives",
      "habit_completions",
      // Métricas (exercise_session_metrics) caem por ON DELETE CASCADE
      "exercise_sessions",
      // habits.goal_id → NULL via ON DELETE SET NULL
      "goals",
      "activity_history",
      "user_checkins",
      "notifications",
      "missions",
      "user_achievements",
      "agent_initiatives",
      "user_features",
      "user_ml_scores",
      "user_ml_scores_shadow",
      "user_cf_recommendations",
      "ai_usage_events",
      "telegram_link_codes",
    ] as const;

    const results: Array<{ table: string; deleted: number; skipped: boolean }> = [];
    for (const table of tables) {
      results.push(await del(table));
    }

    const { error: resetErr } = await supabaseAdmin
      .from("profiles")
      .update({
        xp_total: 0,
        streak_atual: 0,
        streak_maximo: 0,
        ultimo_dia_completo: null,
        capitulo_atual: 1,
      })
      .eq("id", uid);
    if (resetErr) throw new Error(resetErr.message);

    const ATTR_RESET = {
      forca: 1,
      disciplina: 1,
      sabedoria: 1,
      espirito: 1,
      testosterona: 1,
      prosperidade: 1,
      conhecimento: 1,
      lideranca: 1,
    } as const;

    const { error: attrErr } = await supabaseAdmin
      .from("attributes")
      .upsert(
        { user_id: uid, ...ATTR_RESET },
        { onConflict: "user_id" },
      );
    if (attrErr) throw new Error(`attributes: ${attrErr.message}`);

    await supabaseAdmin.from("activity_history").insert({
      user_id: uid,
      tipo: "admin_clear_history",
      descricao: `Histórico limpo por admin (${context.userId.slice(0, 8)}…)`,
      xp_delta: 0,
      metadata: { admin_id: context.userId, results, attributesReset: true },
    });

    return {
      ok: true as const,
      userId: uid,
      nome: profile.nome,
      results,
      attributesReset: true as const,
      totalDeleted: results.reduce((s, r) => s + r.deleted, 0),
    };
  });

export const adminListHabits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("habits")
      .select("id, user_id, titulo, atributo, ativo, created_at, xp_recompensa")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const today = hojeISO();
    const { count: completionsToday } = await supabaseAdmin
      .from("habit_completions")
      .select("id", { count: "exact", head: true })
      .eq("dia", today);

    const byAttr: Record<string, number> = {};
    let active = 0;
    for (const h of data ?? []) {
      if (h.ativo) active += 1;
      byAttr[h.atributo] = (byAttr[h.atributo] ?? 0) + 1;
    }

    return {
      habits: data ?? [],
      stats: { total: data?.length ?? 0, active, completionsToday: completionsToday ?? 0, byAttr },
    };
  });

export const adminListGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("goals")
      .select("id, user_id, titulo, ativo, categoria, created_at, descricao")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    let active = 0;
    const byCat: Record<string, number> = {};
    for (const g of data ?? []) {
      if (g.ativo) active += 1;
      byCat[g.categoria] = (byCat[g.categoria] ?? 0) + 1;
    }
    return { goals: data ?? [], active, byCat };
  });

export const adminGamification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data: progress, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, xp_total, capitulo_atual, streak_atual, streak_maximo, wallpaper_id")
      .order("xp_total", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const wallpaperUsage: Record<string, number> = {};
    for (const p of progress ?? []) {
      const id = p.wallpaper_id ?? "none";
      wallpaperUsage[id] = (wallpaperUsage[id] ?? 0) + 1;
    }

    return {
      leaderboard: (progress ?? []).map((p) => ({
        userId: p.id,
        displayName: p.nome,
        xpTotal: p.xp_total,
        chapter: p.capitulo_atual,
        streakCurrent: p.streak_atual,
        streakMax: p.streak_maximo,
        wallpaperId: p.wallpaper_id,
      })),
      wallpaperCatalog: WALLPAPERS.map((w) => ({
        id: w.id,
        titulo: w.titulo,
        unlock: w.unlock,
        usage: wallpaperUsage[w.id] ?? 0,
      })),
    };
  });

export const adminCharlieOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: challenges, error } = await supabaseAdmin
      .from("mentor_challenges")
      .select("id, user_id, titulo, status, xp_recompensa, created_at, completed_at, ends_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const byStatus: Record<string, number> = {};
    for (const c of challenges ?? []) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    }

    const { count: messagesWeek } = await supabaseAdmin
      .from("mentor_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    const {
      listCharliePersonalities,
      ensureCharliePersonalitySeeds,
    } = await import("@/mentor/prompt.server");
    await ensureCharliePersonalitySeeds();
    const personalities = await listCharliePersonalities({ includeInactive: true });

    const { data: usageRows } = await supabaseAdmin
      .from("profiles")
      .select("charlie_personality");
    const usageBySlug: Record<string, number> = {};
    for (const row of usageRows ?? []) {
      const slug = (row as { charlie_personality?: string }).charlie_personality ?? "classico";
      usageBySlug[slug] = (usageBySlug[slug] ?? 0) + 1;
    }

    return {
      challenges: challenges ?? [],
      byStatus,
      messagesWeek: messagesWeek ?? 0,
      personalities: personalities.map((p) => ({
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        system_prompt: p.system_prompt,
        is_active: p.is_active,
        sort_order: p.sort_order,
        updated_at: p.updated_at,
        usage: usageBySlug[p.slug] ?? 0,
      })),
    };
  });

export const adminSaveCharliePersonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        slug: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(80).optional(),
        tagline: z.string().trim().max(200).optional(),
        description: z.string().trim().max(500).optional(),
        system_prompt: z.string().min(80).max(100_000).optional(),
        is_active: z.boolean().optional(),
        sort_order: z.number().int().min(0).max(9999).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { savePersonalityPrompt } = await import("@/mentor/prompt.server");
    const { slug, ...patch } = data;
    await savePersonalityPrompt(slug, patch, context.userId);
    return { ok: true as const };
  });

export const adminResetCharliePersonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ slug: z.string().trim().min(2).max(40) }).parse(i))
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { resetPersonalityToSeed } = await import("@/mentor/prompt.server");
    await resetPersonalityToSeed(data.slug, context.userId);
    return { ok: true as const };
  });

export const adminSeedCharliePersonalities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ forceOverwrite: z.boolean().optional() }).optional().parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { ensureCharliePersonalitySeeds } = await import("@/mentor/prompt.server");
    const result = await ensureCharliePersonalitySeeds({
      forceOverwrite: Boolean(data?.forceOverwrite),
    });
    return { ok: true as const, ...result };
  });

/** @deprecated — use adminSaveCharliePersonality no slug classico */
export const adminGetCharliePrompt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { getPersonalityBySlug } = await import("@/mentor/prompt.server");
    const { MENTOR_SYSTEM_PROMPT_DEFAULT } = await import("@/mentor/context");
    const meta = await getPersonalityBySlug("classico");
    return {
      ...meta,
      codeDefault: MENTOR_SYSTEM_PROMPT_DEFAULT,
    };
  });

/** @deprecated */
export const adminSaveCharliePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ prompt: z.string().min(80).max(100_000) }).parse(i))
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { saveMentorSystemPrompt } = await import("@/mentor/prompt.server");
    await saveMentorSystemPrompt(data.prompt, context.userId);
    return { ok: true as const };
  });

/** @deprecated */
export const adminResetCharliePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { resetMentorSystemPromptToCodeDefault } = await import("@/mentor/prompt.server");
    await resetMentorSystemPromptToCodeDefault(context.userId);
    return { ok: true as const };
  });

export const adminMlOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const [scores, shadow, runs, features] = await Promise.all([
      supabaseAdmin
        .from("user_ml_scores")
        .select(
          "user_id, risco_abandono, risco_streak, projecao_dias_proximo_nivel, model_version, computed_at",
        )
        .order("risco_abandono", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("user_ml_scores_shadow")
        .select("user_id, risco_abandono, risco_streak, model_version, computed_at")
        .order("computed_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("ml_model_runs").select("*").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("user_features").select("user_id", { count: "exact", head: true }),
    ]);

    return {
      scores: scores.data ?? [],
      shadow: shadow.data ?? [],
      modelRuns: runs.data ?? [],
      featuresCount: features.count ?? 0,
      scoreError: scores.error?.message ?? null,
      shadowError: shadow.error?.message ?? null,
    };
  });

export const adminAgentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("agent_initiatives")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const row of data ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    }

    const { data: cf } = await supabaseAdmin
      .from("user_cf_recommendations")
      .select("user_id, peer_count, suggestions, computed_at, model_version")
      .order("computed_at", { ascending: false })
      .limit(50);

    return { initiatives: data ?? [], byStatus, byKind, cfRecs: cf ?? [] };
  });

export const adminCancelInitiative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("agent_initiatives")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminNotificationsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id, user_id, tipo, titulo, corpo, lido_em, created_at")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);

    const byTipo: Record<string, number> = {};
    let unread = 0;
    for (const n of data ?? []) {
      byTipo[n.tipo] = (byTipo[n.tipo] ?? 0) + 1;
      if (!n.lido_em) unread += 1;
    }

    return { notifications: data ?? [], byTipo, unread };
  });

export const adminTelegramOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, telegram_chat_id, telegram_opt_in, telegram_linked_at")
      .not("telegram_chat_id", "is", null)
      .order("telegram_linked_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const optIn = (data ?? []).filter((r) => r.telegram_opt_in).length;
    return { links: data ?? [], linked: data?.length ?? 0, optIn };
  });

export const adminUnlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        telegram_chat_id: null,
        telegram_opt_in: false,
        telegram_linked_at: null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminCheckinsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("user_checkins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const withHumor = (data ?? []).filter((r) => r.humor != null);
    const avgHumor =
      withHumor.length > 0
        ? withHumor.reduce((s, r) => s + (r.humor ?? 0), 0) / withHumor.length
        : null;
    const withEnergia = (data ?? []).filter((r) => r.energia != null);
    const avgEnergia =
      withEnergia.length > 0
        ? withEnergia.reduce((s, r) => s + (r.energia ?? 0), 0) / withEnergia.length
        : null;

    return { checkins: data ?? [], avgHumor, avgEnergia, count: data?.length ?? 0 };
  });

export const adminContentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    return {
      wallpapers: WALLPAPERS.map((w) => ({
        id: w.id,
        titulo: w.titulo,
        descricao: w.descricao,
        file: w.file,
        unlock: w.unlock,
      })),
      note: "Templates Charlie e copy de notificação vivem no código (mentor + notifications).",
    };
  });

export const adminSystemOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const { projectRef, url } = getSupabasePublicEnv();
    return {
      projectRef,
      supabaseUrl: url,
      envFlags: {
        hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasCronSecret: Boolean(process.env.CRON_SECRET),
        hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        hasOpenAi: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
        hasBootstrapEmail: Boolean(
          process.env.DASHI_BOOTSTRAP_EMAIL || process.env.ADMIN_BOOTSTRAP_EMAIL,
        ),
      },
      edgeFunctions: [
        "telegram-webhook",
        "notification-jobs",
        "ml-features-job",
        "agent-initiatives-job",
      ],
    };
  });

export const adminAnalyticsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withAdmin(context.userId);
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const since7Day = since7.slice(0, 10);

    const [
      usersTotal,
      onboarded,
      habits7,
      notif7,
      checkins7,
      highRisk,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("onboarding_completo", true),
      supabaseAdmin
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .gte("dia", since7Day),
      supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7),
      supabaseAdmin
        .from("user_checkins")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7),
      supabaseAdmin
        .from("user_ml_scores")
        .select("user_id", { count: "exact", head: true })
        .gte("risco_abandono", 0.55),
    ]);

    return {
      usersTotal: usersTotal.count ?? 0,
      onboarded: onboarded.count ?? 0,
      habitCompletions7d: habits7.count ?? 0,
      notifications7d: notif7.count ?? 0,
      checkins7d: checkins7.count ?? 0,
      highChurnRisk: highRisk.count ?? 0,
    };
  });

export const adminTriggerJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        job: z.enum(["notification-jobs", "ml-features-job", "agent-initiatives-job"]),
        force: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const force = Boolean(data.force);

    if (data.job === "notification-jobs") {
      const result = await runProductNotificationJobs({ force });
      return { ok: true as const, job: data.job, result };
    }

    if (data.job === "agent-initiatives-job") {
      const result = await runCfAndAgentJobs(supabaseAdmin, { force });
      return { ok: true as const, job: data.job, result };
    }

    // ml-features-job: recompute para até 200 usuários mais recentes
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("onboarding_completo", true)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    let ok = 0;
    let fail = 0;
    for (const p of profiles ?? []) {
      try {
        await recomputeUserMl(supabaseAdmin, p.id);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    return { ok: true as const, job: data.job, result: { recomputed: ok, failed: fail } };
  });

export const adminRecomputeUserMl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const result = await recomputeUserMl(supabaseAdmin, data.userId);
    return {
      ok: true as const,
      riscoAbandono: result.scores.risco_abandono,
      riscoStreak: result.scores.risco_streak,
    };
  });

/** Dispara edge function remota (alternativa aos jobs locais). */
export const adminTriggerEdgeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        job: z.enum(["notification-jobs", "ml-features-job", "agent-initiatives-job"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withAdmin(context.userId);
    const { url } = getSupabasePublicEnv();
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error("CRON_SECRET não configurado no servidor.");

    const endpoint = `${url}/functions/v1/${data.job}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-cron-secret": secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "dashitecnology", triggeredBy: context.userId }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Edge ${data.job} falhou (${res.status}): ${text.slice(0, 400)}`);
    }

    return { ok: true as const, status: res.status, body: text };
  });
