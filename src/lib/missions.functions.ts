import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MISSION_COLS,
  ensureChapterMissions,
  grantMissionRewards,
  type MissionRow,
} from "@/lib/missions-core";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Client = SupabaseClient<Database>;

export { ensureChapterMissions } from "@/lib/missions-core";

export const listMissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("capitulo_atual, onboarding_completo")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.onboarding_completo) {
      return { missions: [] as MissionRow[], capitulo: 1 };
    }

    const capitulo = profile.capitulo_atual ?? 1;
    try {
      await ensureChapterMissions(supabase as Client, userId, capitulo);
    } catch (e) {
      console.error("[missions] ensure", e);
    }

    const { data, error } = await supabase
      .from("missions")
      .select(MISSION_COLS)
      .eq("user_id", userId)
      .in("status", ["ativa", "concluida"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      if (/missions|relation|schema cache/i.test(error.message)) {
        console.warn("[missions] tabela indisponível:", error.message);
        return { missions: [] as MissionRow[], capitulo };
      }
      throw new Error(error.message);
    }
    return { missions: (data ?? []) as MissionRow[], capitulo };
  });

export const completeMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: mission, error } = await supabase
      .from("missions")
      .select(MISSION_COLS)
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !mission) throw new Error("Missão não encontrada");
    const m = mission as MissionRow;
    if (m.status !== "ativa") throw new Error("Missão não está ativa");
    if (m.progresso_atual < m.progresso_alvo) {
      throw new Error("Complete o progresso da missão antes de resgatar.");
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("xp_total, streak_atual, streak_maximo, capitulo_atual")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Perfil não encontrado");

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("missions")
      .update({
        status: "concluida",
        completed_at: new Date().toISOString(),
        progresso_atual: m.progresso_alvo,
      })
      .eq("id", m.id)
      .eq("user_id", userId)
      .eq("status", "ativa")
      .select(MISSION_COLS)
      .maybeSingle();

    if (uErr || !updated) throw new Error(uErr?.message ?? "Falha ao concluir missão");

    const before = {
      xp_total: profile.xp_total,
      streak_atual: profile.streak_atual,
      streak_maximo: profile.streak_maximo,
      capitulo_atual: profile.capitulo_atual ?? 1,
    };

    const grant = await grantMissionRewards(supabase as Client, userId, [
      { mission: updated as MissionRow, xp: m.xp_recompensa },
    ], before);

    return {
      mission: updated as MissionRow,
      xpGanho: m.xp_recompensa,
      ...grant,
    };
  });
