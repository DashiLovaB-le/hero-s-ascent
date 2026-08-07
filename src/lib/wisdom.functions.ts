import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertIsAdmin } from "@/admin/auth";
import { CHARLIE_WISDOM_SEED, type WisdomCardSeed } from "@/mentor/wisdom.seed";
import { formatWisdomBlock, pickWisdomCards, wisdomHintsFromContext } from "@/mentor/wisdom";

export type WisdomCardRow = {
  id: string;
  slug: string;
  source: string;
  titulo: string;
  principio: string;
  quando_usar: string;
  quando_evitar: string;
  tags: string[];
  keywords: string[];
  blocked_personalities: string[];
  priority: number;
  ativo: boolean;
  updated_at: string;
};

async function loadActiveCards(): Promise<WisdomCardSeed[]> {
  const { data, error } = await supabaseAdmin
    .from("charlie_wisdom_cards")
    .select(
      "slug, source, titulo, principio, quando_usar, quando_evitar, tags, keywords, blocked_personalities, priority, ativo",
    )
    .eq("ativo", true)
    .order("priority", { ascending: false })
    .limit(200);

  if (error) {
    // fallback seed se tabela ainda não existir
    if (/charlie_wisdom|schema cache|does not exist/i.test(error.message)) {
      return CHARLIE_WISDOM_SEED;
    }
    throw new Error(error.message);
  }

  if (!data?.length) return CHARLIE_WISDOM_SEED;

  return data.map((r) => ({
    slug: r.slug as string,
    source: r.source as WisdomCardSeed["source"],
    titulo: r.titulo as string,
    principio: r.principio as string,
    quando_usar: (r.quando_usar as string) ?? "",
    quando_evitar: (r.quando_evitar as string) ?? "",
    tags: (r.tags as string[]) ?? [],
    keywords: (r.keywords as string[]) ?? [],
    blocked_personalities: (r.blocked_personalities as string[]) ?? [],
    priority: (r.priority as number) ?? 0,
    ativo: Boolean(r.ativo),
  }));
}

/** Usado por callMentor — top fichas para o turno. */
export async function resolveWisdomBlock(opts: {
  userText: string;
  personalitySlug: string | null;
  contextBlock: string;
}): Promise<string> {
  const cards = await loadActiveCards();
  const picked = pickWisdomCards(cards, {
    userText: opts.userText,
    personalitySlug: opts.personalitySlug,
    contextHints: wisdomHintsFromContext(opts.contextBlock),
    limit: 5,
  });
  return formatWisdomBlock(picked);
}

export async function ensureWisdomCardSeeds(opts?: {
  forceOverwrite?: boolean;
}): Promise<{ upserted: number }> {
  const force = Boolean(opts?.forceOverwrite);
  let upserted = 0;

  for (const card of CHARLIE_WISDOM_SEED) {
    if (!force) {
      const { data: existing } = await supabaseAdmin
        .from("charlie_wisdom_cards")
        .select("slug")
        .eq("slug", card.slug)
        .maybeSingle();
      if (existing) continue;
    }

    const { error } = await supabaseAdmin.from("charlie_wisdom_cards").upsert(
      {
        slug: card.slug,
        source: card.source,
        titulo: card.titulo,
        principio: card.principio,
        quando_usar: card.quando_usar,
        quando_evitar: card.quando_evitar,
        tags: card.tags,
        keywords: card.keywords,
        blocked_personalities: card.blocked_personalities,
        priority: card.priority,
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(error.message);
    upserted += 1;
  }

  return { upserted };
}

export const adminListWisdomCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ cards: WisdomCardRow[]; seedCount: number }> => {
    await assertIsAdmin(context.userId);
    await ensureWisdomCardSeeds();

    const { data, error } = await supabaseAdmin
      .from("charlie_wisdom_cards")
      .select("*")
      .order("source", { ascending: true })
      .order("priority", { ascending: false });

    if (error) throw new Error(error.message);

    return {
      cards: (data ?? []) as WisdomCardRow[],
      seedCount: CHARLIE_WISDOM_SEED.length,
    };
  });

export const adminSeedWisdomCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ forceOverwrite: z.boolean().optional() }).optional().parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const result = await ensureWisdomCardSeeds({
      forceOverwrite: Boolean(data?.forceOverwrite),
    });
    return { ok: true as const, ...result };
  });

export const adminUpsertWisdomCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().trim().min(2).max(80),
        source: z.enum([
          "habitos_atomicos",
          "poder_do_habito",
          "coragem_imperfeito",
          "meditacoes",
          "obstaculo_caminho",
        ]),
        titulo: z.string().trim().min(1).max(120),
        principio: z.string().trim().min(1).max(800),
        quando_usar: z.string().trim().max(400).optional(),
        quando_evitar: z.string().trim().max(400).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
        keywords: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        blocked_personalities: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
        priority: z.number().int().min(0).max(100).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const row = {
      ...(data.id ? { id: data.id } : {}),
      slug: data.slug,
      source: data.source,
      titulo: data.titulo,
      principio: data.principio,
      quando_usar: data.quando_usar ?? "",
      quando_evitar: data.quando_evitar ?? "",
      tags: data.tags ?? [],
      keywords: data.keywords ?? [],
      blocked_personalities: data.blocked_personalities ?? [],
      priority: data.priority ?? 0,
      ativo: data.ativo ?? true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("charlie_wisdom_cards")
      .upsert(row, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminToggleWisdomCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("charlie_wisdom_cards")
      .update({ ativo: data.ativo, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminPreviewWisdomPick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        message: z.string().trim().min(1).max(2000),
        personalitySlug: z.string().trim().max(40).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const cards = await loadActiveCards();
    const picked = pickWisdomCards(cards, {
      userText: data.message,
      personalitySlug: data.personalitySlug ?? "classico",
      limit: 5,
    });
    return {
      picked: picked.map((c) => ({
        slug: c.slug,
        titulo: c.titulo,
        source: c.source,
        principio: c.principio,
      })),
      block: formatWisdomBlock(picked),
    };
  });
