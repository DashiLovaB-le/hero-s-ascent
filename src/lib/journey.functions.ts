import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- BOOTSTRAP: garante profile + attributes ----------
export const bootstrapUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // profile
    const { data: prof } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!prof) {
      await supabase.from("profiles").insert({ id: userId, nome: "Herói" });
    }
    const { data: attr } = await supabase.from("attributes").select("user_id").eq("user_id", userId).maybeSingle();
    if (!attr) {
      await supabase.from("attributes").insert({ user_id: userId });
    }
    return { ok: true };
  });

// ---------- GET JOURNEY (dashboard data) ----------
export const getJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, attrsRes, habitsRes, todayRes, achRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("attributes").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("habits").select("*").eq("user_id", userId).eq("ativo", true).order("created_at"),
      supabase.from("habit_completions").select("habit_id").eq("user_id", userId).eq("dia", new Date().toISOString().slice(0, 10)),
      supabase
        .from("user_achievements")
        .select("achievement_id, desbloqueado_em, achievements(codigo, titulo, descricao, icone)")
        .eq("user_id", userId)
        .order("desbloqueado_em", { ascending: false })
        .limit(5),
    ]);

    return {
      profile: profileRes.data,
      attributes: attrsRes.data,
      habits: habitsRes.data ?? [],
      completedToday: (todayRes.data ?? []).map((r) => r.habit_id),
      achievements: achRes.data ?? [],
    };
  });

// ---------- COMPLETE HABIT ----------
export const completeHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ habitId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const hoje = new Date().toISOString().slice(0, 10);

    // hábito
    const { data: habit, error: hErr } = await supabase
      .from("habits").select("*").eq("id", data.habitId).eq("user_id", userId).maybeSingle();
    if (hErr || !habit) throw new Error("Hábito não encontrado");

    // já feito hoje?
    const { data: existing } = await supabase
      .from("habit_completions").select("id")
      .eq("user_id", userId).eq("habit_id", data.habitId).eq("dia", hoje).maybeSingle();
    if (existing) throw new Error("Hábito já concluído hoje");

    const xp = habit.xp_recompensa ?? 10;

    // registra
    const { error: cErr } = await supabase.from("habit_completions").insert({
      user_id: userId, habit_id: data.habitId, dia: hoje, xp_ganho: xp,
    });
    if (cErr) throw new Error(cErr.message);

    // profile: xp + streak
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!prof) throw new Error("Perfil não encontrado");

    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
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

    await supabase.from("profiles").update({
      xp_total: prof.xp_total + xp,
      streak_atual: streak,
      streak_maximo: streakMax,
      ultimo_dia_completo: hoje,
    }).eq("id", userId);

    // atributos
    const attrKey = habit.atributo;
    const { data: attrs } = await supabase.from("attributes").select("*").eq("user_id", userId).maybeSingle();
    if (attrs && attrKey && attrKey in attrs) {
      const current = (attrs as Record<string, number>)[attrKey] ?? 1;
      await supabase.from("attributes").update({ [attrKey]: current + 1 }).eq("user_id", userId);
    }

    // histórico
    await supabase.from("activity_history").insert({
      user_id: userId,
      tipo: "habit_complete",
      descricao: `Concluiu: ${habit.titulo}`,
      xp_delta: xp,
      metadata: { habit_id: habit.id, atributo: attrKey },
    });

    return { xpGanho: xp, streak, novoXpTotal: prof.xp_total + xp };
  });

// ---------- CREATE HABIT ----------
export const createHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      titulo: z.string().trim().min(2).max(80),
      descricao: z.string().trim().max(280).optional(),
      xp_recompensa: z.number().int().min(5).max(200).default(10),
      atributo: z.enum(["forca","disciplina","sabedoria","espirito","testosterona","prosperidade","conhecimento","lideranca"]),
      categoria: z.enum(["corpo","mente","espirito","prosperidade","relacionamentos","proposito"]).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("habits").insert({
      user_id: userId, ...data,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- DELETE HABIT ----------
export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
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
    const { data } = await context.supabase.from("goals").select("*").eq("user_id", context.userId).order("created_at");
    return data ?? [];
  });

export const setGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      goals: z.array(z.object({
        categoria: z.enum(["corpo","mente","espirito","prosperidade","relacionamentos","proposito"]),
        titulo: z.string().trim().min(2).max(80),
      })).max(20),
    }).parse(i),
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
  .inputValidator((i: unknown) =>
    z.object({
      nome: z.string().trim().min(2).max(60).optional(),
      bio: z.string().trim().max(280).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
