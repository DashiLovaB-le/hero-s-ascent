import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Client = SupabaseClient<Database>;

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

const checkinSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sono_horas: z.number().min(0).max(24).nullable().optional(),
  sono_qualidade: z.number().int().min(1).max(5).nullable().optional(),
  energia: z.number().int().min(1).max(5).nullable().optional(),
  humor: z.number().int().min(1).max(5).nullable().optional(),
  nota: z.string().trim().max(280).nullable().optional(),
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
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from("user_checkins")
      .upsert(payload, { onConflict: "user_id,dia" })
      .select(
        "id, user_id, dia, sono_horas, sono_qualidade, energia, humor, nota, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const getTodayCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_checkins")
      .select(
        "id, user_id, dia, sono_horas, sono_qualidade, energia, humor, nota, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("dia", hojeISO())
      .maybeSingle();

    if (error && !/does not exist|user_checkins/i.test(error.message)) {
      throw new Error(error.message);
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
        "id, dia, sono_horas, sono_qualidade, energia, humor, nota, created_at",
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
    .select("dia, sono_horas, sono_qualidade, energia, humor, nota")
    .eq("user_id", userId)
    .order("dia", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
