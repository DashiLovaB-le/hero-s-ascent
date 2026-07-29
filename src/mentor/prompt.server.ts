import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MENTOR_SYSTEM_PROMPT_DEFAULT } from "@/mentor/context";

const KEY = "system_prompt";

/** Prompt efetivo do Charlie: DB se existir, senão o default do código. */
export async function getMentorSystemPrompt(): Promise<{
  prompt: string;
  source: "database" | "code";
  updatedAt: string | null;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("mentor_settings")
      .select("value, updated_at")
      .eq("key", KEY)
      .maybeSingle();
    if (error) {
      console.warn("[mentor_settings]", error.message);
      return { prompt: MENTOR_SYSTEM_PROMPT_DEFAULT, source: "code", updatedAt: null };
    }
    if (data?.value?.trim()) {
      return {
        prompt: data.value,
        source: "database",
        updatedAt: data.updated_at ?? null,
      };
    }
  } catch (e) {
    console.warn("[mentor_settings]", e);
  }
  return { prompt: MENTOR_SYSTEM_PROMPT_DEFAULT, source: "code", updatedAt: null };
}

export async function saveMentorSystemPrompt(
  prompt: string,
  updatedBy: string | null,
): Promise<void> {
  const trimmed = prompt.trim();
  if (trimmed.length < 80) {
    throw new Error("Prompt muito curto (mín. 80 caracteres).");
  }
  if (trimmed.length > 100_000) {
    throw new Error("Prompt muito longo (máx. 100k caracteres).");
  }
  const { error } = await supabaseAdmin.from("mentor_settings").upsert(
    {
      key: KEY,
      value: trimmed,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

export async function resetMentorSystemPromptToCodeDefault(
  updatedBy: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from("mentor_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  // opcional: não reinsere — próxima leitura usa o default do código
  void updatedBy;
}

export { MENTOR_SYSTEM_PROMPT_DEFAULT };
