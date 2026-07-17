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
};

type OpenRouterResult = {
  content: string;
  model: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export async function chatCompletion(opts: OpenRouterOptions): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY ausente. Configure a chave no .env do servidor.");
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const siteUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://v-project.app";

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.75,
    max_tokens: opts.maxTokens ?? 900,
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
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("O Mentor ficou em silêncio. Tente novamente.");
  }

  return { content, model: data.model ?? model };
}
