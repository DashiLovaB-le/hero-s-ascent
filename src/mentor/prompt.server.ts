/**
 * Prompt efetivo do Charlie por personalidade (DB + seed do código).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { MENTOR_SYSTEM_PROMPT_DEFAULT } from "@/mentor/context";
import {
  CHARLIE_PERSONALITY_SEEDS,
  DEFAULT_CHARLIE_PERSONALITY,
  type CharliePersonalitySeed,
} from "@/mentor/personalities.seed";

export type CharliePersonalityRow = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
  sort_order: number;
  updated_at: string | null;
  updated_by: string | null;
};

export type MentorPromptMeta = {
  prompt: string;
  source: "database" | "code";
  slug: string;
  name: string;
  tagline: string;
  updatedAt: string | null;
};

function seedBySlug(slug: string): CharliePersonalitySeed {
  return (
    CHARLIE_PERSONALITY_SEEDS.find((s) => s.slug === slug) ??
    CHARLIE_PERSONALITY_SEEDS.find((s) => s.slug === DEFAULT_CHARLIE_PERSONALITY)!
  );
}

function seedToMeta(seed: CharliePersonalitySeed): MentorPromptMeta {
  return {
    prompt: seed.system_prompt,
    source: "code",
    slug: seed.slug,
    name: seed.name,
    tagline: seed.tagline,
    updatedAt: null,
  };
}

function isPlaceholderPrompt(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  return t.length < 80 || t.startsWith("PLACEHOLDER");
}

/** Garante que o catálogo exista. Não sobrescreve prompts já editados. */
export async function ensureCharliePersonalitySeeds(opts?: {
  forceOverwrite?: boolean;
}): Promise<{ upserted: number }> {
  const force = Boolean(opts?.forceOverwrite);
  const now = new Date().toISOString();

  if (force) {
    const rows = CHARLIE_PERSONALITY_SEEDS.map((s) => ({
      slug: s.slug,
      name: s.name,
      tagline: s.tagline,
      description: s.description,
      system_prompt: s.system_prompt,
      is_active: s.is_active,
      sort_order: s.sort_order,
      updated_at: now,
    }));
    const { error } = await supabaseAdmin.from("mentor_personalities").upsert(rows, {
      onConflict: "slug",
    });
    if (error) throw new Error(error.message);
    return { upserted: rows.length };
  }

  const { data: existing, error: listErr } = await supabaseAdmin
    .from("mentor_personalities")
    .select("slug, system_prompt");
  if (listErr) throw new Error(listErr.message);

  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.system_prompt as string]));
  const toUpsert = CHARLIE_PERSONALITY_SEEDS.filter(
    (s) => !bySlug.has(s.slug) || isPlaceholderPrompt(bySlug.get(s.slug)),
  ).map((s) => ({
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    system_prompt: s.system_prompt,
    is_active: s.is_active,
    sort_order: s.sort_order,
    updated_at: now,
  }));

  if (!toUpsert.length) return { upserted: 0 };

  const { error } = await supabaseAdmin.from("mentor_personalities").upsert(toUpsert, {
    onConflict: "slug",
  });
  if (error) throw new Error(error.message);
  return { upserted: toUpsert.length };
}

export async function listCharliePersonalities(opts?: {
  includeInactive?: boolean;
}): Promise<CharliePersonalityRow[]> {
  try {
    await ensureCharliePersonalitySeeds();
  } catch (e) {
    console.warn("[mentor_personalities] ensure", e);
  }

  let q = supabaseAdmin
    .from("mentor_personalities")
    .select(
      "slug, name, tagline, description, system_prompt, is_active, sort_order, updated_at, updated_by",
    )
    .order("sort_order", { ascending: true });
  if (!opts?.includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) {
    console.warn("[mentor_personalities] list", error.message);
    return CHARLIE_PERSONALITY_SEEDS.filter((s) => opts?.includeInactive || s.is_active).map(
      (s) => ({
        ...s,
        updated_at: null,
        updated_by: null,
      }),
    );
  }
  if (!data?.length) {
    return CHARLIE_PERSONALITY_SEEDS.filter((s) => opts?.includeInactive || s.is_active).map(
      (s) => ({
        ...s,
        updated_at: null,
        updated_by: null,
      }),
    );
  }
  return data as CharliePersonalityRow[];
}

export async function getPersonalityBySlug(slug: string): Promise<MentorPromptMeta> {
  const normalized = (slug || DEFAULT_CHARLIE_PERSONALITY).trim() || DEFAULT_CHARLIE_PERSONALITY;
  try {
    await ensureCharliePersonalitySeeds();
    const { data, error } = await supabaseAdmin
      .from("mentor_personalities")
      .select("slug, name, tagline, system_prompt, updated_at, is_active")
      .eq("slug", normalized)
      .maybeSingle();
    if (!error && data?.system_prompt?.trim() && data.system_prompt.trim().length >= 80) {
      return {
        prompt: data.system_prompt,
        source: "database",
        slug: data.slug,
        name: data.name,
        tagline: data.tagline,
        updatedAt: data.updated_at ?? null,
      };
    }
  } catch (e) {
    console.warn("[mentor_personalities] get", e);
  }
  return seedToMeta(seedBySlug(normalized));
}

/** Prompt efetivo para um usuário (lê profiles.charlie_personality). */
export async function getMentorSystemPromptForUser(userId: string): Promise<MentorPromptMeta> {
  let slug = DEFAULT_CHARLIE_PERSONALITY;
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("charlie_personality")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data?.charlie_personality) {
      slug = data.charlie_personality;
    }
  } catch (e) {
    console.warn("[mentor_personalities] profile", e);
  }
  return getPersonalityBySlug(slug);
}

/** @deprecated use getMentorSystemPromptForUser — mantém Clássico / legado. */
export async function getMentorSystemPrompt(): Promise<MentorPromptMeta> {
  // Preferências legadas em mentor_settings sobrescrevem só o classico se ainda existirem
  try {
    const { data } = await supabaseAdmin
      .from("mentor_settings")
      .select("value, updated_at")
      .eq("key", "system_prompt")
      .maybeSingle();
    if (data?.value?.trim() && data.value.trim().length >= 80) {
      const classico = await getPersonalityBySlug(DEFAULT_CHARLIE_PERSONALITY);
      // Se o classico no catálogo ainda for seed/placeholder, usa legacy
      if (classico.source === "code" || classico.prompt.startsWith("PLACEHOLDER")) {
        return {
          prompt: data.value,
          source: "database",
          slug: DEFAULT_CHARLIE_PERSONALITY,
          name: "Charlie Clássico",
          tagline: "Equilibrado. Faz perguntas. Incentiva sem pressionar.",
          updatedAt: data.updated_at ?? null,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return getPersonalityBySlug(DEFAULT_CHARLIE_PERSONALITY);
}

export async function savePersonalityPrompt(
  slug: string,
  patch: {
    system_prompt?: string;
    name?: string;
    tagline?: string;
    description?: string;
    is_active?: boolean;
    sort_order?: number;
  },
  updatedBy: string | null,
): Promise<void> {
  const update: Database["public"]["Tables"]["mentor_personalities"]["Update"] = {
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  if (patch.system_prompt != null) {
    const trimmed = patch.system_prompt.trim();
    if (trimmed.length < 80) throw new Error("Prompt muito curto (mín. 80 caracteres).");
    if (trimmed.length > 100_000) throw new Error("Prompt muito longo (máx. 100k caracteres).");
    update.system_prompt = trimmed;
  }
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.tagline != null) update.tagline = patch.tagline.trim();
  if (patch.description != null) update.description = patch.description.trim();
  if (patch.is_active != null) update.is_active = patch.is_active;
  if (patch.sort_order != null) update.sort_order = patch.sort_order;

  const { error } = await supabaseAdmin
    .from("mentor_personalities")
    .update(update)
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

export async function resetPersonalityToSeed(
  slug: string,
  updatedBy: string | null,
): Promise<void> {
  const seed = CHARLIE_PERSONALITY_SEEDS.find((s) => s.slug === slug);
  if (!seed) throw new Error(`Personalidade desconhecida: ${slug}`);
  const { error } = await supabaseAdmin.from("mentor_personalities").upsert(
    {
      slug: seed.slug,
      name: seed.name,
      tagline: seed.tagline,
      description: seed.description,
      system_prompt: seed.system_prompt,
      is_active: seed.is_active,
      sort_order: seed.sort_order,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "slug" },
  );
  if (error) throw new Error(error.message);
}

/** Compat: salva no classico (+ espelha mentor_settings legado). */
export async function saveMentorSystemPrompt(
  prompt: string,
  updatedBy: string | null,
): Promise<void> {
  await ensureCharliePersonalitySeeds();
  await savePersonalityPrompt(DEFAULT_CHARLIE_PERSONALITY, { system_prompt: prompt }, updatedBy);
  await supabaseAdmin.from("mentor_settings").upsert(
    {
      key: "system_prompt",
      value: prompt.trim(),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" },
  );
}

export async function resetMentorSystemPromptToCodeDefault(
  updatedBy: string | null,
): Promise<void> {
  await resetPersonalityToSeed(DEFAULT_CHARLIE_PERSONALITY, updatedBy);
  await supabaseAdmin.from("mentor_settings").delete().eq("key", "system_prompt");
}

export { MENTOR_SYSTEM_PROMPT_DEFAULT, DEFAULT_CHARLIE_PERSONALITY };
