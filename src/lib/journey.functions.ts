import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_WALLPAPER_ID,
  getWallpaperById,
  isWallpaperUnlocked,
} from "@/lib/wallpapers";

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
const HABIT_COLS = "id, titulo, descricao, xp_recompensa, atributo, categoria, ativo, created_at";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

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

    // Bootstrap só se faltar — service role evita falha silenciosa por RLS sem INSERT
    if (!profileRes.data || !attrsRes.data) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [pUp, aUp] = await Promise.all([
        !profileRes.data
          ? supabaseAdmin.from("profiles").upsert({ id: userId, nome: "Herói" }, { onConflict: "id", ignoreDuplicates: true })
          : Promise.resolve({ error: null }),
        !attrsRes.data
          ? supabaseAdmin.from("attributes").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
          : Promise.resolve({ error: null }),
      ]);

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

    return {
      profile: profileRes.data,
      attributes: attrsRes.data,
      habits: habitsRes.data ?? [],
      completedToday: (todayRes.data ?? []).map((r) => r.habit_id),
      achievements: achRes.data ?? [],
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
    const hoje = hojeISO();

    const [habitRes, existingRes, profRes, attrsRes] = await Promise.all([
      supabase.from("habits").select(HABIT_COLS).eq("id", data.habitId).eq("user_id", userId).maybeSingle(),
      supabase
        .from("habit_completions")
        .select("id")
        .eq("user_id", userId)
        .eq("habit_id", data.habitId)
        .eq("dia", hoje)
        .maybeSingle(),
      supabase.from("profiles").select("xp_total, streak_atual, streak_maximo, ultimo_dia_completo").eq("id", userId).maybeSingle(),
      supabase.from("attributes").select(ATTR_COLS).eq("user_id", userId).maybeSingle(),
    ]);

    const habit = habitRes.data;
    if (habitRes.error || !habit) throw new Error("Hábito não encontrado");
    if (existingRes.data) throw new Error("Hábito já concluído hoje");

    const prof = profRes.data;
    if (!prof) throw new Error("Perfil não encontrado");

    const xp = habit.xp_recompensa ?? 10;
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);

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

    const { error: cErr } = await supabase.from("habit_completions").insert({
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

    await Promise.all([
      supabase
        .from("profiles")
        .update({
          xp_total: novoXpTotal,
          streak_atual: streak,
          streak_maximo: streakMax,
          ultimo_dia_completo: hoje,
        })
        .eq("id", userId),
      Object.keys(attrPatch).length
        ? supabase.from("attributes").update(attrPatch as never).eq("user_id", userId)
        : Promise.resolve(),
      supabase.from("activity_history").insert({
        user_id: userId,
        tipo: "habit_complete",
        descricao: `Concluiu: ${habit.titulo}`,
        xp_delta: xp,
        metadata: { habit_id: habit.id, atributo: attrKey },
      }),
    ]);

    return {
      xpGanho: xp,
      streak,
      streakMaximo: streakMax,
      novoXpTotal,
      atributo: attrKey,
      novoAttrValor,
      habitId: data.habitId,
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
        xp_recompensa: z.number().int().min(5).max(200).default(10),
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
        xp_recompensa: z.number().int().min(5).max(200),
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
    const { error } = await supabase.from("habits").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- GOALS ----------
export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("goals")
      .select("id, categoria, titulo, descricao, ativo, created_at")
      .eq("user_id", context.userId)
      .eq("ativo", true)
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
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("goals")
      .insert({ ...data, user_id: context.userId })
      .select("id, categoria, titulo, descricao, ativo, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
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
    await supabase.from("profiles").update({ onboarding_completo: true }).eq("id", userId);
    return { ok: true };
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
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    if (data.wallpaper_id != null) {
      const def = getWallpaperById(data.wallpaper_id);
      if (def.id !== data.wallpaper_id && data.wallpaper_id !== DEFAULT_WALLPAPER_ID) {
        throw new Error("Fundo de tela inválido.");
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("xp_total, streak_maximo, capitulo_atual")
        .eq("id", userId)
        .maybeSingle();
      if (pErr || !profile) throw new Error(pErr?.message ?? "Perfil não encontrado.");

      if (
        !isWallpaperUnlocked(def, {
          xp_total: profile.xp_total,
          streak_maximo: profile.streak_maximo,
          capitulo_atual: profile.capitulo_atual,
        })
      ) {
        throw new Error("Este fundo ainda está bloqueado. Continue sua jornada.");
      }
    }

    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
