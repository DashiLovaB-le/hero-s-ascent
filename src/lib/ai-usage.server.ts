import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiUsageInput = {
  userId?: string | null;
  source: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  finishReason?: string | null;
  metadata?: Record<string, unknown>;
};

async function rateForModel(model: string): Promise<{ input: number; output: number }> {
  const { data } = await supabaseAdmin
    .from("ai_cost_rates")
    .select("model, input_usd_per_1m, output_usd_per_1m")
    .in("model", [model, "default"]);
  const exact = data?.find((r) => r.model === model);
  const fallback = data?.find((r) => r.model === "default");
  const row = exact ?? fallback;
  return {
    input: Number(row?.input_usd_per_1m) || 3,
    output: Number(row?.output_usd_per_1m) || 15,
  };
}

export function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  inputPer1m: number,
  outputPer1m: number,
): number {
  return (promptTokens / 1_000_000) * inputPer1m + (completionTokens / 1_000_000) * outputPer1m;
}

/** Persiste evento de uso (nunca lança — não quebra o mentor). */
export async function logAiUsage(input: AiUsageInput): Promise<void> {
  try {
    const prompt = Math.max(0, Math.floor(input.promptTokens));
    const completion = Math.max(0, Math.floor(input.completionTokens));
    const rates = await rateForModel(input.model);
    const cost = estimateCostUsd(prompt, completion, rates.input, rates.output);
    const { error } = await supabaseAdmin.from("ai_usage_events").insert({
      user_id: input.userId ?? null,
      source: input.source,
      model: input.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      estimated_cost_usd: cost,
      finish_reason: input.finishReason ?? null,
      metadata: (input.metadata ?? {}) as never,
    });
    if (error) console.error("[ai_usage]", error.message);
  } catch (e) {
    console.error("[ai_usage]", e);
  }
}
