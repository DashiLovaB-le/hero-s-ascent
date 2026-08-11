import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hojeISO, zonedDayBoundsUtcIso } from "@/lib/datetime";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Client = SupabaseClient<Database>;

const checkinSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sono_horas: z.number().min(0).max(24).nullable().optional(),
  sono_qualidade: z.number().int().min(1).max(5).nullable().optional(),
  energia: z.number().int().min(1).max(5).nullable().optional(),
  humor: z.number().int().min(1).max(5).nullable().optional(),
  nota: z.string().trim().max(280).nullable().optional(),
  /** Reflexão de identidade — sem XP. */
  identidade_hoje: z.enum(["sim", "parcial", "nao"]).nullable().optional(),
});

export const upsertTodayCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => checkinSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const dia = data.dia ?? hojeISO();
    const payload = {
      user_id: userId,
      dia,
      sono_horas: data.sono_horas ?? null,
      sono_qualidade: data.sono_qualidade ?? null,
      energia: data.energia ?? null,
      humor: data.humor ?? null,
      nota: data.nota?.trim() || null,
      identidade_hoje: data.identidade_hoje ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from("user_checkins")
      .upsert(payload, { onConflict: "user_id,dia" })
      .select(
        "id, user_id, dia, sono_horas, sono_qualidade, energia, humor, nota, identidade_hoje, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);

    // Padrão: 3 dias "nao" → memória para o Charlie (sem XP)
    if (data.identidade_hoje === "nao") {
      try {
        await maybeRememberIdentityDrift(supabase as Client, userId);
      } catch (e) {
        console.warn("[checkin] identity memory", e);
      }
    }

    return row;
  });

async function maybeRememberIdentityDrift(supabase: Client, userId: string) {
  const { data: rows } = await supabase
    .from("user_checkins")
    .select("dia, identidade_hoje")
    .eq("user_id", userId)
    .order("dia", { ascending: false })
    .limit(3);

  const last3 = rows ?? [];
  if (last3.length < 3) return;
  if (!last3.every((r) => r.identidade_hoje === "nao")) return;

  const { data: recentMem } = await supabaseAdmin
    .from("mentor_memories")
    .select("id, content, created_at")
    .eq("user_id", userId)
    .ilike("content", "%identidade%")
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(1);

  if (recentMem?.length) return;

  await supabaseAdmin.from("mentor_memories").insert({
    user_id: userId,
    content:
      "Marcou 3 dias seguidos que não agiu como o homem que quer se tornar. Não é fim — é padrão a confrontar com o código.",
    importance: 4,
  });
}

export const getTodayCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const dia = hojeISO();
    const { start: dayStart } = zonedDayBoundsUtcIso(dia);

    const { data, error } = await supabase
      .from("user_checkins")
      .select(
        "id, user_id, dia, sono_horas, sono_qualidade, energia, humor, nota, identidade_hoje, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("dia", dia)
      .maybeSingle();

    if (error && !/does not exist|user_checkins/i.test(error.message)) {
      throw new Error(error.message);
    }

    // Bleed legado: check-in gravado com dia UTC (noite BRT do dia anterior).
    // Se created_at é antes do início do dia civil em Brasília, não conta como “hoje”.
    if (data?.created_at && new Date(data.created_at).getTime() < new Date(dayStart).getTime()) {
      return null;
    }

    return data ?? null;
  });

export const listRecentCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(30).default(7) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_checkins")
      .select(
        "id, dia, sono_horas, sono_qualidade, energia, humor, nota, identidade_hoje, created_at",
      )
      .eq("user_id", userId)
      .order("dia", { ascending: false })
      .limit(data.limit);

    if (error && /does not exist|user_checkins/i.test(error.message)) return [];
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const resolveAgentInitiative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["accepted", "dismissed"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("agent_initiatives")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export async function loadCheckinsForMentor(supabase: Client, userId: string, limit = 7) {
  const { data, error } = await supabase
    .from("user_checkins")
    .select("dia, sono_horas, sono_qualidade, energia, humor, nota, identidade_hoje")
    .eq("user_id", userId)
    .order("dia", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
