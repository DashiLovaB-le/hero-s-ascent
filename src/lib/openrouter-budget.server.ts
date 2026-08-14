import { supabaseAdmin } from "@/integrations/supabase/client.server";

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function killSwitchOn(): boolean {
  const v = (process.env.OPENROUTER_KILL_SWITCH ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function utcDayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

type UsageRow = {
  global_tokens?: number;
  global_cost?: number;
  user_tokens?: number;
};

/**
 * Bloqueia chamadas OpenRouter se kill switch ou teto diário (user/global) estourou.
 * Defaults conservadores; override via env.
 */
export async function assertOpenRouterBudget(userId?: string | null): Promise<void> {
  if (killSwitchOn()) {
    throw new Error("O Mentor está pausado no momento. Tente mais tarde.");
  }

  const userCap = envInt("OPENROUTER_DAILY_USER_TOKENS", 250_000);
  const globalCap = envInt("OPENROUTER_DAILY_GLOBAL_TOKENS", 5_000_000);
  const costCap = Number(process.env.OPENROUTER_DAILY_COST_USD);
  const costLimit = Number.isFinite(costCap) && costCap > 0 ? costCap : 25;

  const { data, error } = await supabaseAdmin.rpc("openrouter_daily_usage", {
    p_since: utcDayStartIso(),
    p_user_id: userId ?? null,
  });

  if (error) {
    if (/openrouter_daily_usage|ai_usage_events|schema cache|does not exist/i.test(error.message)) {
      return;
    }
    console.error("[openrouter-budget]", error.message);
    return;
  }

  const usage = (data ?? {}) as UsageRow;
  const globalTokens = Number(usage.global_tokens) || 0;
  const globalCost = Number(usage.global_cost) || 0;
  const userTokens = Number(usage.user_tokens) || 0;

  if (globalTokens >= globalCap || globalCost >= costLimit) {
    throw new Error("O Mentor atingiu o limite diário. Tente amanhã.");
  }
  if (userId && userTokens >= userCap) {
    throw new Error("Você usou o Mentor o bastante por hoje. Volte amanhã.");
  }
}
