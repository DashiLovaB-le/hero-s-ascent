import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ConsumeResult = { ok: boolean; reason?: string; count?: number };

export async function consumeUserRateLimit(input: {
  userId: string;
  action: string;
  minIntervalMs: number;
  dailyMax: number;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("consume_user_rate_limit", {
    p_user_id: input.userId,
    p_action: input.action,
    p_min_interval_ms: input.minIntervalMs,
    p_daily_max: input.dailyMax,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    throw new Error("Não foi possível validar o limite de uso. Tente de novo.");
  }
  const result = (data ?? {}) as ConsumeResult;
  if (result.ok) return;
  if (result.reason === "interval") {
    throw new Error("Aguarde cerca de 1–2 minutos antes de pedir novas sugestões.");
  }
  if (result.reason === "daily") {
    throw new Error("Limite diário de sugestões atingido. Tente amanhã.");
  }
  throw new Error("Limite de uso atingido.");
}
