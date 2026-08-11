import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabasePublicEnv } from "@/integrations/supabase/env";
import { addDaysToDateKey, eachDateKeyInclusive, hojeISO } from "@/lib/datetime";
import { loadLevelsFromDb, loadWallpapersFromDb } from "@/lib/catalog.server";
import type { Database } from "@/integrations/supabase/types";

const PROFILE_COLS =
  "id, nome, avatar_url, bio, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, frase_motivacional, onboarding_completo, created_at, location_label, location_lat, location_lon, location_timezone";
const ATTR_COLS =
  "user_id, forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca";
const PROFILE_COLS_LEGACY =
  "id, nome, avatar_url, bio, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, frase_motivacional, onboarding_completo, created_at";
const CHALLENGE_COLS =
  "id, titulo, descricao, duracao_dias, xp_recompensa, titulo_recompensa, status, starts_at, ends_at, completed_at, created_at";

function daysAgoISO(n: number) {
  return addDaysToDateKey(hojeISO(), -n);
}

function enumerateDays(fromIso: string, toIso: string) {
  return eachDateKeyInclusive(fromIso, toIso);
}

function bestActiveStreak(activeDays: Set<string>, days: string[]) {
  let best = 0;
  let run = 0;
  for (const dia of days) {
    if (activeDays.has(dia)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

function asError(label: string, err: { message?: string } | null | undefined): Error {
  return new Error(`Falha ao carregar ${label}: ${err?.message ?? "erro desconhecido"}`);
}

function userHasPasswordIdentity(identities: { provider: string }[] | undefined): boolean {
  return (identities ?? []).some((i) => i.provider === "email");
}

async function verifyCurrentPassword(email: string, password: string) {
  const { url, publishableKey } = getSupabasePublicEnv();
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Senha atual incorreta.");
}

async function loadAccountAuth(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Não foi possível carregar a conta.");
  }
  return {
    email: data.user.email?.trim().toLowerCase() ?? null,
    hasPassword: userHasPasswordIdentity(data.user.identities),
  };
}

/** Panorama agregado do herói para /profile */
export const getProfilePanorama = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hoje = hojeISO();
    const from21 = daysAgoISO(20);

    const [profileRes0, attrsRes, habitsRes, goalsRes, compsRes, achRes, chalRes] =
      await Promise.all([
        supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
        supabase.from("attributes").select(ATTR_COLS).eq("user_id", userId).maybeSingle(),
        supabase.from("habits").select("id").eq("user_id", userId).eq("ativo", true),
        supabase
          .from("goals")
          .select("id, titulo, categoria, ativo, status, created_at")
          .eq("user_id", userId)
          .in("status", ["ativa", "pausada"])
          .order("created_at", { ascending: false }),
        supabase
          .from("habit_completions")
          .select("habit_id, dia")
          .eq("user_id", userId)
          .gte("dia", from21)
          .lte("dia", hoje),
        supabase
          .from("user_achievements")
          .select("achievement_id, desbloqueado_em, achievements(codigo, titulo, descricao, icone)")
          .eq("user_id", userId)
          .order("desbloqueado_em", { ascending: false })
          .limit(12),
        supabase
          .from("mentor_challenges")
          .select(CHALLENGE_COLS)
          .eq("user_id", userId)
          .eq("status", "concluido")
          .order("completed_at", { ascending: false })
          .limit(12),
      ]);

    let profileRes = profileRes0;
    if (profileRes.error && /location_/i.test(profileRes.error.message)) {
      profileRes = await supabase
        .from("profiles")
        .select(PROFILE_COLS_LEGACY)
        .eq("id", userId)
        .maybeSingle();
    }

    // Essenciais — se falhar, página não abre
    if (profileRes.error) throw asError("profiles", profileRes.error);
    if (attrsRes.error) throw asError("attributes", attrsRes.error);
    if (habitsRes.error) throw asError("habits", habitsRes.error);
    if (goalsRes.error) throw asError("goals", goalsRes.error);
    if (compsRes.error) throw asError("habit_completions", compsRes.error);

    // Opcionais — conquistas/desafios do Charlie não podem derrubar o perfil
    const achievements = achRes.error ? [] : (achRes.data ?? []);
    const completedChallenges = chalRes.error ? [] : (chalRes.data ?? []);
    if (achRes.error) console.warn("[profile] achievements:", achRes.error.message);
    if (chalRes.error) console.warn("[profile] mentor_challenges:", chalRes.error.message);

    if (!profileRes.data || !attrsRes.data) {
      throw new Error("Perfil incompleto. Abra a Jornada antes.");
    }

    const habitCount = habitsRes.data?.length ?? 0;
    const completions = compsRes.data ?? [];
    const days = enumerateDays(from21, hoje);

    const byDay = new Map<string, number>();
    for (const c of completions) {
      byDay.set(c.dia, (byDay.get(c.dia) ?? 0) + 1);
    }

    const rhythmDays = days.map((dia) => {
      const count = byDay.get(dia) ?? 0;
      const d = new Date(`${dia}T12:00:00`);
      return {
        dia,
        count,
        weekday: d.getDay(),
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      };
    });

    const activeDaySet = new Set(rhythmDays.filter((d) => d.count > 0).map((d) => d.dia));
    const totalCompletions = completions.length;
    const possible = Math.max(1, habitCount * days.length);
    const completionRate = Math.min(100, Math.round((totalCompletions / possible) * 100));

    const createdAt = profileRes.data.created_at ?? new Date().toISOString();
    const daysOnJourney = Math.max(
      1,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    const [levels, wallpapers, account, chessProgressRes] = await Promise.all([
      loadLevelsFromDb(),
      loadWallpapersFromDb(),
      loadAccountAuth(userId),
      supabaseAdmin
        .from("charlie_chess_progress")
        .select("level, wins_at_level, wins_total, losses_total, draws_total")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const chessProgress =
      !chessProgressRes.error && chessProgressRes.data
        ? {
            level: Number(chessProgressRes.data.level) || 1,
            wins_at_level: Number(chessProgressRes.data.wins_at_level) || 0,
            wins_total: Number(chessProgressRes.data.wins_total) || 0,
            losses_total: Number(chessProgressRes.data.losses_total) || 0,
            draws_total: Number(chessProgressRes.data.draws_total) || 0,
          }
        : { level: 1, wins_at_level: 0, wins_total: 0, losses_total: 0, draws_total: 0 };

    return {
      profile: profileRes.data,
      attributes: attrsRes.data,
      goals: goalsRes.data ?? [],
      achievements,
      completedChallenges,
      daysOnJourney,
      levels,
      wallpapers,
      account,
      chessProgress,
      rhythm: {
        days: rhythmDays,
        periodDays: days.length,
        habitCount,
        totalCompletions,
        activeDays: activeDaySet.size,
        completionRate,
        bestStreakInPeriod: bestActiveStreak(activeDaySet, days),
      },
    };
  });

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const newPasswordSchema = z.string().min(6, "Nova senha: mínimo 6 caracteres").max(72);

/**
 * Atualiza e-mail e/ou senha no Auth do Supabase (auth.users).
 * Exige senha atual quando a conta já tem login por e-mail/senha.
 */
export const updateAccountAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        email: z.string().trim().max(255).optional(),
        current_password: z.string().max(72).optional(),
        new_password: z.string().max(72).optional(),
        confirm_password: z.string().max(72).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const account = await loadAccountAuth(userId);
    if (!account.email) {
      throw new Error("Conta sem e-mail. Entre de novo e tente outra vez.");
    }

    const nextEmailRaw = data.email?.trim() ?? "";
    let nextEmail = account.email;
    if (nextEmailRaw) {
      const parsedEmail = emailSchema.safeParse(nextEmailRaw);
      if (!parsedEmail.success) {
        throw new Error(parsedEmail.error.issues[0]?.message ?? "E-mail inválido.");
      }
      nextEmail = parsedEmail.data.toLowerCase();
    }
    const wantsEmail = nextEmail !== account.email;

    const newPassword = data.new_password?.trim() ?? "";
    const confirmPassword = data.confirm_password?.trim() ?? "";
    const wantsPassword = newPassword.length > 0;

    if (!wantsEmail && !wantsPassword) {
      return {
        ok: true as const,
        email: account.email,
        emailChanged: false,
        passwordChanged: false,
      };
    }

    if (wantsPassword) {
      const parsedPw = newPasswordSchema.safeParse(newPassword);
      if (!parsedPw.success) {
        throw new Error(parsedPw.error.issues[0]?.message ?? "Nova senha inválida.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("A confirmação da nova senha não confere.");
      }
    }

    if (account.hasPassword) {
      const current = data.current_password ?? "";
      if (!current) {
        throw new Error("Informe a senha atual para alterar e-mail ou senha.");
      }
      await verifyCurrentPassword(account.email, current);
    }

    const patch: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (wantsEmail) {
      patch.email = nextEmail;
      patch.email_confirm = true;
    }
    if (wantsPassword) {
      patch.password = newPassword;
    }

    const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(userId, patch);
    if (error) {
      const msg = error.message ?? "Falha ao atualizar a conta.";
      if (/already.*(registered|been)|exists|duplicate/i.test(msg)) {
        throw new Error("Este e-mail já está em uso.");
      }
      throw new Error(msg);
    }

    return {
      ok: true as const,
      email: updated.user?.email?.trim().toLowerCase() ?? nextEmail,
      emailChanged: wantsEmail,
      passwordChanged: wantsPassword,
    };
  });
