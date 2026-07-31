/**
 * OpenRouter chat completions — server-only.
 * Key: OPENROUTER_API_KEY (nunca expor ao client).
 */

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterOptions = {
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Para telemetria de custo */
  usageContext?: {
    userId?: string | null;
    source?: string;
    metadata?: Record<string, unknown>;
  };
};

export type OpenRouterResult = {
  content: string;
  model: string;
  finishReason: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function chatCompletion(opts: OpenRouterOptions): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY ausente. Configure a chave no .env do servidor.");
  }

  const { resolveOpenRouterModel } = await import("@/lib/openrouter-model.server");
  const model = await resolveOpenRouterModel();
  const siteUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://v-project.app";

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.75,
    max_tokens: opts.maxTokens ?? 1200,
  };

  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "V-Project Mentor",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[OpenRouter]", res.status, errText.slice(0, 500));
    if (res.status === 401 || res.status === 403) {
      throw new Error("Falha de autenticação com a OpenRouter. Verifique a chave.");
    }
    if (res.status === 429) {
      throw new Error("O Mentor está sobrecarregado. Tente novamente em instantes.");
    }
    throw new Error("O Mentor não respondeu. Tente novamente.");
  }

  const data = (await res.json()) as {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    choices?: Array<{
      message?: { content?: string | null };
      finish_reason?: string | null;
    }>;
  };

  const choice = data.choices?.[0];
  const content = choice?.message?.content?.trim();
  if (!content) {
    throw new Error("O Mentor ficou em silêncio. Tente novamente.");
  }

  const promptTokens = Number(data.usage?.prompt_tokens) || 0;
  const completionTokens = Number(data.usage?.completion_tokens) || 0;
  const totalTokens = Number(data.usage?.total_tokens) || promptTokens + completionTokens;
  const resolvedModel = data.model ?? model;
  const finishReason = choice?.finish_reason ?? null;

  if (opts.usageContext) {
    const { logAiUsage } = await import("@/lib/ai-usage.server");
    void logAiUsage({
      userId: opts.usageContext.userId,
      source: opts.usageContext.source ?? "mentor",
      model: resolvedModel,
      promptTokens,
      completionTokens,
      finishReason,
      metadata: opts.usageContext.metadata,
    });
  }

  return {
    content,
    model: resolvedModel,
    finishReason,
    usage: { promptTokens, completionTokens, totalTokens },
  };
}
