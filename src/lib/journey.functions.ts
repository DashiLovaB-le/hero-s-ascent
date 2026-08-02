import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodeLocationQuery } from "@/lib/weather";
import {
  DEFAULT_WALLPAPER_ID,
  getWallpaperById,
  isWallpaperUnlocked,
} from "@/lib/wallpapers";
import { evaluateProgress } from "@/lib/progress-engine";
import {
  bumpMissionsOnHabitComplete,
  ensureChapterMissions,
  grantMissionRewards,
} from "@/lib/missions-core";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadLevelsFromDb, loadWallpapersFromDb } from "@/lib/catalog.server";
import { hojeISO, ontemISO } from "@/lib/datetime";

type Client = SupabaseClient<Database>;

async function requireOnboardingComplete(
  supabase: Client,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.onboarding_completo) {
    throw new Error("Conclua o onboarding antes de continuar.");
  }
}

const ATTR_KEYS = [
  "forca",
  "disciplina",
  "sabedoria",
  "espirito",
  "testosterona",
  "prosperidade",
  "conhecimento",
  "lideranca",
] as const;

const PROFILE_COLS =
  "id, nome, avatar_url, bio, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, frase_motivacional, onboarding_completo";
const ATTR_COLS =
  "user_id, forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca";
const HABIT_COLS = "id, titulo, descricao, xp_recompensa, atributo, categoria, ativo, created_at, exercise_type_id, goal_id";

// ---------- GET JOURNEY (bootstrap embutido + selects enxutos) ----------
export const getJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hoje = hojeISO();

    let [profileRes, attrsRes, habitsRes, todayRes, achRes] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
      supabase.from("attributes").select(ATTR_COLS).eq("user_id", userId).maybeSingle(),
      supabase.from("habits").select(HABIT_COLS).eq("user_id", userId).eq("ativo", true).order("created_at"),
      supabase.from("habit_completions").select("habit_id").eq("user_id", userId).eq("dia", hoje),
      supabase
        .from("user_achievements")
        .select("achievement_id, desbloqueado_em, achievements(codigo, titulo, descricao, icone)")
        .eq("user_id", userId)
        .order("desbloqueado_em", { ascending: false })
        .limit(5),
    ]);

    for (const [label, res] of [
      ["profiles", profileRes],
      ["attributes", attrsRes],
      ["habits", habitsRes],
      ["habit_completions", todayRes],
      ["user_achievements", achRes],
    ] as const) {
      if (res.error) throw new Error(`Falha ao carregar ${label}: ${res.error.message}`);
    }

    // Bootstrap só se faltar — tenta JWT do usuário; admin só como fallback.
    if (!profileRes.data || !attrsRes.data) {
      const upsertProfile = () =>
        supabase.from("profiles").upsert({ id: userId, nome: "Herói" }, { onConflict: "id", ignoreDuplicates: true });
      const upsertAttrs = () =>
        supabase.from("attributes").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

      let [pUp, aUp] = await Promise.all([
        !profileRes.data ? upsertProfile() : Promise.resolve({ error: null }),
        !attrsRes.data ? upsertAttrs() : Promise.resolve({ error: null }),
      ]);

      if (pUp.error || aUp.error) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          [pUp, aUp] = await Promise.all([
            !profileRes.data && pUp.error
              ? supabaseAdmin
                  .from("profiles")
                  .upsert({ id: userId, nome: "Herói" }, { onConflict: "id", ignoreDuplicates: true })
              : Promise.resolve(pUp),
            !attrsRes.data && aUp.error
              ? supabaseAdmin
                  .from("attributes")
                  .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
              : Promise.resolve(aUp),
          ]);
        } catch (adminErr) {
          const detail =
            adminErr instanceof Error
              ? adminErr.message
              : pUp.error?.message || aUp.error?.message || "bootstrap falhou";
          throw new Error(`Falha ao criar perfil/atributos: ${detail}`);
        }
      }

      if (pUp.error) throw new Error(`Falha ao criar perfil: ${pUp.error.message}`);
      if (aUp.error) throw new Error(`Falha ao criar atributos: ${aUp.error.message}`);

      const [p2, a2] = await Promise.all([
        !profileRes.data
          ? supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle()
          : Promise.resolve(profileRes),
        !attrsRes.data
          ? supabase.from("attributes").select(ATTR_COLS).eq("user_id", userId).maybeSingle()
          : Promise.resolve(attrsRes),
      ]);
      if (p2.error) throw new Error(`Falha ao recarregar perfil: ${p2.error.message}`);
      if (a2.error) throw new Error(`Falha ao recarregar atributos: ${a2.error.message}`);
      profileRes = p2;
      attrsRes = a2;
    }

    if (!profileRes.data || !attrsRes.data) {
      throw new Error("Não foi possível inicializar seu perfil de herói. Tente sair e entrar de novo.");
    }

    const [levels, wallpapers] = await Promise.all([
      loadLevelsFromDb(),
      loadWallpapersFromDb(),
    ]);

    return {
      profile: profileRes.data,
      attributes: attrsRes.data,
      habits: habitsRes.data ?? [],
      completedToday: (todayRes.data ?? []).map((r) => r.habit_id),
      achievements: achRes.data ?? [],
      levels,
      wallpapers,
    };
  });

/** @deprecated bootstrap embutido em getJourney — mantido por compat */
export const bootstrapUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: true as const }));

// ---------- COMPLETE HABIT (3 RTTs em vez de ~8) ----------
export const completeHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ habitId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);
    const hoje = hojeISO();

    const [habitRes, existingRes, profRes, attrsRes, priorCountRes] = await Promise.all([
      supabase.from("habits").select(HABIT_COLS).eq("id", data.habitId).eq("user_id", userId).maybeSingle(),
      supabase
        .from("habit_completions")
        .select("id")
        .eq("user_id", userId)
        .eq("habit_id", data.habitId)
        .eq("dia", hoje)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, onboarding_completo")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("attributes").select(ATTR_COLS).eq("user_id", userId).maybeSingle(),
      supabase
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const habit = habitRes.data;
    if (habitRes.error || !habit) throw new Error("Hábito não encontrado");
    if ((habit as { exercise_type_id?: string | null }).exercise_type_id) {
      throw new Error("Este hábito é validado por sessão. Abra Exercícios e inicie uma sessão.");
    }
    if (existingRes.data) throw new Error("Hábito já concluído hoje");

    const prof = profRes.data;
    if (!prof) throw new Error("Perfil não encontrado");

    const xp = habit.xp_recompensa ?? 10;
    const ontemStr = ontemISO();

    let streak = prof.streak_atual;
    if (prof.ultimo_dia_completo === hoje) {
      // mantém
    } else if (prof.ultimo_dia_completo === ontemStr) {
      streak += 1;
    } else {
      streak = 1;
    }
    const streakMax = Math.max(prof.streak_maximo, streak);
    const novoXpTotal = prof.xp_total + xp;
    const attrKey = habit.atributo;

    const { error: cErr } = await supabaseAdmin.from("habit_completions").insert({
      user_id: userId,
      habit_id: data.habitId,
      dia: hoje,
      xp_ganho: xp,
    });
    if (cErr) throw new Error(cErr.message);

    const attrPatch: Record<string, number> = {};
    let novoAttrValor: number | undefined;
    if (attrsRes.data && attrKey && (ATTR_KEYS as readonly string[]).includes(attrKey)) {
      const current = ((attrsRes.data as unknown) as Record<string, number>)[attrKey] ?? 1;
      novoAttrValor = current + 1;
      attrPatch[attrKey] = novoAttrValor;
    }

    const beforeProgress = {
      xp_total: prof.xp_total,
      streak_atual: prof.streak_atual,
      streak_maximo: prof.streak_maximo,
      capitulo_atual: prof.capitulo_atual ?? 1,
    };
    const firstHabitEver = (priorCountRes.count ?? 0) === 0;

    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({
          xp_total: novoXpTotal,
          streak_atual: streak,
          streak_maximo: streakMax,
          ultimo_dia_completo: hoje,
        })
        .eq("id", userId),
      Object.keys(attrPatch).length
        ? supabaseAdmin.from("attributes").update(attrPatch as never).eq("user_id", userId)
        : Promise.resolve(),
      supabaseAdmin.from("activity_history").insert({
        user_id: userId,
        tipo: "habit_complete",
        descricao: `Concluiu: ${habit.titulo}`,
        xp_delta: xp,
        metadata: { habit_id: habit.id, atributo: attrKey },
      }),
    ]);

    const afterHabit = {
      xp_total: novoXpTotal,
      streak_atual: streak,
      streak_maximo: streakMax,
      capitulo_atual: beforeProgress.capitulo_atual,
    };

    const progress = await evaluateProgress(
      supabase as Client,
      userId,
      beforeProgress,
      afterHabit,
      { firstHabitEver },
    );

    let finalXp = progress.xp_total;
    let finalCapitulo = progress.capitulo_atual;
    let unlocked = progress.unlockedAchievements;
    let chapterChanged = progress.chapterChanged;
    let missionXp = 0;

    try {
      const grants = await bumpMissionsOnHabitComplete(
        supabase as Client,
        userId,
        data.habitId,
      );
      if (grants.length) {
        const missionBefore = {
          xp_total: finalXp,
          streak_atual: streak,
          streak_maximo: streakMax,
          capitulo_atual: finalCapitulo,
        };
        const missionResult = await grantMissionRewards(
          supabase as Client,
          userId,
          grants,
          missionBefore,
        );
        finalXp = missionResult.xp_total;
        finalCapitulo = missionResult.capitulo_atual;
        missionXp = missionResult.missionXp;
        unlocked = [...unlocked, ...missionResult.unlockedAchievements];
        chapterChanged = missionResult.chapterChanged ?? chapterChanged;
      }
    } catch (e) {
      console.error("[missions] bump after habit", e);
    }

    // ML Fase 1: recompute leve (não bloqueia a resposta do hábito)
    void import("@/lib/ml/recompute")
      .then(({ recomputeUserMl }) => recomputeUserMl(supabase as Client, userId, hoje))
      .catch((e) => console.error("[ml] recompute after habit", e));

    return {
      xpGanho: xp + progress.xpBonusTotal + missionXp,
      streak,
      streakMaximo: streakMax,
      novoXpTotal: finalXp,
      capitulo_atual: finalCapitulo,
      atributo: attrKey,
      novoAttrValor,
      habitId: data.habitId,
      unlockedAchievements: unlocked,
      chapterChanged,
      missionXp,
    };
  });

// ---------- CREATE HABIT ----------
export const createHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        titulo: z.string().trim().min(2).max(80),
        descricao: z.string().trim().max(280).optional(),
        xp_recompensa: z.number().int().min(5).max(50).default(10),
        atributo: z.enum([
          "forca",
          "disciplina",
          "sabedoria",
          "espirito",
          "testosterona",
          "prosperidade",
          "conhecimento",
          "lideranca",
        ]),
        categoria: z
          .enum(["corpo", "mente", "espirito", "prosperidade", "relacionamentos", "proposito"])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);
    const { data: row, error } = await supabase
      .from("habits")
      .insert({ user_id: userId, ...data })
      .select(HABIT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- UPDATE HABIT ----------
export const updateHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().trim().min(2).max(80),
        descricao: z.string().trim().max(280).optional(),
        xp_recompensa: z.number().int().min(5).max(50),
        atributo: z.enum([
          "forca",
          "disciplina",
          "sabedoria",
          "espirito",
          "testosterona",
          "prosperidade",
          "conhecimento",
          "lideranca",
        ]),
        categoria: z
          .enum(["corpo", "mente", "espirito", "prosperidade", "relacionamentos", "proposito"])
          .optional()
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);
    const { id, ...fields } = data;
    const { data: row, error } = await supabase
      .from("habits")
      .update(fields)
      .eq("id", id)
      .eq("user_id", userId)
      .select(HABIT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- DELETE HABIT ----------
export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOnboardingComplete(supabase as Client, userId);
    const { error } = await supabase.from("habits").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- GOALS ----------
export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOnboardingComplete(context.supabase as Client, context.userId);
    const { data } = await context.supabase
      .from("goals")
      .select(
        "id, categoria, titulo, descricao, motivo, prazo, status, is_norte, ativo, xp_recompensa, completed_at, created_at",
      )
      .eq("user_id", context.userId)
      .in("status", ["ativa", "pausada"])
      .order("is_norte", { ascending: false })
      .order("created_at");
    return data ?? [];
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        categoria: z.enum([
          "corpo",
          "mente",
          "espirito",
          "prosperidade",
          "relacionamentos",
          "proposito",
        ]),
        titulo: z.string().trim().min(2).max(80),
        motivo: z.string().trim().max(200).optional().nullable(),
        prazo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
        is_norte: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireOnboardingComplete(context.supabase as Client, context.userId);
    const { data: row, error } = await context.supabase
      .from("goals")
      .insert({
        user_id: context.userId,
        categoria: data.categoria,
        titulo: data.titulo,
        motivo: data.motivo?.trim() || null,
        prazo: data.prazo || null,
        is_norte: data.is_norte ?? false,
        status: "ativa",
        ativo: true,
      })
      .select(
        "id, categoria, titulo, descricao, motivo, prazo, status, is_norte, ativo, xp_recompensa, completed_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await requireOnboardingComplete(context.supabase as Client, context.userId);
    const { error } = await context.supabase
      .from("goals")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        goals: z
          .array(
            z.object({
              categoria: z.enum([
                "corpo",
                "mente",
                "espirito",
                "prosperidade",
                "relacionamentos",
                "proposito",
              ]),
              titulo: z.string().trim().min(2).max(80),
            }),
          )
          .max(20),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("goals").delete().eq("user_id", userId);
    if (data.goals.length) {
      await supabase.from("goals").insert(data.goals.map((g) => ({ ...g, user_id: userId })));
    }
    await supabaseAdmin
      .from("profiles")
      .update({ onboarding_completo: true })
      .eq("id", userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("capitulo_atual")
      .eq("id", userId)
      .maybeSingle();
    try {
      await ensureChapterMissions(
        supabase as Client,
        userId,
        profile?.capitulo_atual ?? 1,
      );
    } catch (e) {
      console.error("[missions] seed onboarding", e);
    }

    return { ok: true };
  });

// ---------- ACTIVITY HISTORY ----------
export const listActivityHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).optional().default(15),
        cursor: z.string().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const pageSize = data.limit;
    let q = supabase
      .from("activity_history")
      .select("id, tipo, descricao, xp_delta, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(pageSize + 1);

    if (data.cursor) {
      q = q.lt("created_at", data.cursor);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const raw = rows ?? [];
    const hasMore = raw.length > pageSize;
    const items = hasMore ? raw.slice(0, pageSize) : raw;
    const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

    return { items, hasMore, nextCursor: nextCursor ?? null };
  });

// ---------- UPDATE PROFILE ----------
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(60).optional(),
        bio: z.string().trim().max(280).optional(),
        wallpaper_id: z.string().trim().min(1).max(40).optional(),
        /** Cidade/região: string geocodifica; "" limpa a localização. */
        location_query: z.string().max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    if (data.wallpaper_id != null) {
      const catalog = await loadWallpapersFromDb();
      const levels = await loadLevelsFromDb();
      const def =
        catalog.find((w) => w.id === data.wallpaper_id) ??
        (data.wallpaper_id === DEFAULT_WALLPAPER_ID
          ? catalog[0]
          : getWallpaperById(data.wallpaper_id));
      if (!def || (def.id !== data.wallpaper_id && data.wallpaper_id !== DEFAULT_WALLPAPER_ID)) {
        throw new Error("Fundo de tela inválido.");
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("xp_total, streak_maximo, capitulo_atual")
        .eq("id", userId)
        .maybeSingle();
      if (pErr || !profile) throw new Error(pErr?.message ?? "Perfil não encontrado.");

      if (
        !isWallpaperUnlocked(
          def,
          {
            xp_total: profile.xp_total,
            streak_maximo: profile.streak_maximo,
            capitulo_atual: profile.capitulo_atual,
          },
          levels,
        )
      ) {
        throw new Error("Este fundo ainda está bloqueado. Continue sua jornada.");
      }
    }

    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (data.nome != null) patch.nome = data.nome;
    if (data.bio != null) patch.bio = data.bio;
    if (data.wallpaper_id != null) patch.wallpaper_id = data.wallpaper_id;

    if (data.location_query != null) {
      const q = data.location_query.trim();
      if (!q) {
        patch.location_label = null;
        patch.location_lat = null;
        patch.location_lon = null;
        patch.location_timezone = null;
      } else {
        const geo = await geocodeLocationQuery(q);
        patch.location_label = geo.label;
        patch.location_lat = geo.lat;
        patch.location_lon = geo.lon;
        patch.location_timezone = geo.timezone;
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new Error("Nada para atualizar.");
    }

    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      if (/location_/i.test(error.message)) {
        throw new Error(
          "Colunas de localização ainda não existem no banco. Rode a migration 20260727140000_profile_location_weather.sql.",
        );
      }
      throw new Error(error.message);
    }

    return {
      ok: true as const,
      location_label:
        typeof patch.location_label === "string"
          ? patch.location_label
          : patch.location_label === null
            ? null
            : undefined,
    };
  });
