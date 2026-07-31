/**
 * Modelo OpenRouter ativo — preferência no control room (mentor_settings),
 * fallback: OPENROUTER_MODEL → default.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const OPENROUTER_MODEL_SETTING_KEY = "openrouter_model";
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

const CACHE_TTL_MS = 30_000;

let cached: { model: string; at: number } | null = null;

export function clearOpenRouterModelCache() {
  cached = null;
}

export function envOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

/** Lê modelo ativo (cache curto). */
export async function resolveOpenRouterModel(): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.model;

  try {
    const { data, error } = await supabaseAdmin
      .from("mentor_settings")
      .select("value")
      .eq("key", OPENROUTER_MODEL_SETTING_KEY)
      .maybeSingle();

    if (!error && data?.value?.trim()) {
      const model = data.value.trim();
      cached = { model, at: now };
      return model;
    }
  } catch (e) {
    console.error("[openrouter-model] read", e);
  }

  const model = envOpenRouterModel();
  cached = { model, at: now };
  return model;
}

export async function getStoredOpenRouterModel(): Promise<{
  model: string;
  source: "db" | "env" | "default";
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("mentor_settings")
      .select("value")
      .eq("key", OPENROUTER_MODEL_SETTING_KEY)
      .maybeSingle();

    if (!error && data?.value?.trim()) {
      return { model: data.value.trim(), source: "db" };
    }
  } catch (e) {
    console.error("[openrouter-model] getStored", e);
  }

  const fromEnv = process.env.OPENROUTER_MODEL?.trim();
  if (fromEnv) return { model: fromEnv, source: "env" };
  return { model: DEFAULT_OPENROUTER_MODEL, source: "default" };
}

export async function setOpenRouterModel(model: string, updatedBy?: string | null) {
  const value = model.trim();
  if (!value) throw new Error("Informe o id do modelo OpenRouter.");
  if (value.length > 120) throw new Error("Id do modelo muito longo.");

  const { error } = await supabaseAdmin.from("mentor_settings").upsert(
    {
      key: OPENROUTER_MODEL_SETTING_KEY,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  clearOpenRouterModelCache();
  return { model: value };
}
