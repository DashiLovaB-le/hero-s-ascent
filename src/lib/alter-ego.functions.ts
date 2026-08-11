import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion } from "@/mentor/openrouter";
import {
  ALTER_EGO_INIMIGOS,
  ALTER_EGO_VIRTUDES,
  synthesizeAlterEgoFallback,
  type AlterEgoAnswers,
  type HeroAlterEgo,
} from "@/lib/alter-ego";

type Client = SupabaseClient<Database>;

const ALTER_EGO_COLS =
  "id, user_id, nome, codigo, virtudes, inimigo, resumo, source_answers, active, created_at, updated_at";

const answersSchema = z.object({
  virtude: z.string().trim().min(2).max(40),
  inimigo: z.string().trim().min(2).max(40),
  reconhecimento: z.string().trim().min(2).max(120),
});

const upsertSchema = z.object({
  nome: z.string().trim().min(2).max(60),
  codigo: z.array(z.string().trim().min(2).max(120)).min(1).max(8),
  virtudes: z.array(z.string().trim().min(2).max(40)).min(1).max(6),
  inimigo: z.string().trim().min(2).max(40),
  resumo: z.string().trim().max(280).optional().default(""),
  source_answers: answersSchema.optional(),
});

const synthesizeSchema = z.object({
  answers: answersSchema,
  goals: z
    .array(
      z.object({
        categoria: z.string(),
        titulo: z.string().trim().min(1).max(80),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

const rateBucket = new Map<string, number>();

function checkSynthesizeRate(userId: string) {
  const now = Date.now();
  const last = rateBucket.get(userId) ?? 0;
  if (now - last < 90_000) {
    throw new Error("Aguarde cerca de 1–2 minutos antes de regenerar a identidade.");
  }
  rateBucket.set(userId, now);
}

function normalizeAnswers(raw: unknown): AlterEgoAnswers {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      virtude: typeof o.virtude === "string" ? o.virtude : "",
      inimigo: typeof o.inimigo === "string" ? o.inimigo : "",
      reconhecimento: typeof o.reconhecimento === "string" ? o.reconhecimento : "",
    };
  }
  return { virtude: "", inimigo: "", reconhecimento: "" };
}

function mapRow(row: Record<string, unknown>): HeroAlterEgo {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    nome: String(row.nome),
    codigo: Array.isArray(row.codigo) ? row.codigo.map(String) : [],
    virtudes: Array.isArray(row.virtudes) ? row.virtudes.map(String) : [],
    inimigo: String(row.inimigo ?? ""),
    resumo: String(row.resumo ?? ""),
    source_answers: normalizeAnswers(row.source_answers),
    active: Boolean(row.active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function fetchAlterEgo(supabase: Client, userId: string): Promise<HeroAlterEgo | null> {
  const { data, error } = await supabase
    .from("hero_alter_ego")
    .select(ALTER_EGO_COLS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (/does not exist|hero_alter_ego/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRow(data as unknown as Record<string, unknown>);
}

async function upsertRow(
  supabase: Client,
  userId: string,
  payload: z.infer<typeof upsertSchema> & { source_answers?: AlterEgoAnswers },
): Promise<HeroAlterEgo> {
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    nome: payload.nome.trim(),
    codigo: payload.codigo.map((c) => c.trim()).filter(Boolean).slice(0, 8),
    virtudes: payload.virtudes.map((v) => v.trim()).filter(Boolean).slice(0, 6),
    inimigo: payload.inimigo.trim(),
    resumo: (payload.resumo ?? "").trim(),
    source_answers: payload.source_answers ?? {},
    active: true,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("hero_alter_ego")
    .upsert(row, { onConflict: "user_id" })
    .select(ALTER_EGO_COLS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as unknown as Record<string, unknown>);
}

async function synthesizeWithLlm(
  answers: AlterEgoAnswers,
  goals: { categoria: string; titulo: string }[],
  heroName: string,
): Promise<z.infer<typeof upsertSchema> | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;

  const goalsText =
    goals.map((g) => `- [${g.categoria}] ${g.titulo}`).join("\n") || "(sem metas)";

  try {
    const result = await chatCompletion({
      messages: [
        {
          role: "system",
          content: `Você é Charlie, mentor do V-Project. Sintetize o Alter Ego do herói (identidade que ele quer se tornar — NÃO é você).
Responda SOMENTE JSON válido:
{
  "nome": "O Executor",
  "codigo": ["regra 1", "regra 2", "regra 3", "regra 4", "regra 5"],
  "virtudes": ["Disciplina", "Foco"],
  "inimigo": "Procrastinação",
  "resumo": "frase curta"
}
Regras:
- nome: curto, masculino, estilo "O …" (2–40 chars)
- codigo: 3 a 5 princípios em 1ª pessoa, citáveis, sem emoji
- virtudes: 1 a 3, preferindo as do herói
- inimigo: padrão a superar (uma frase curta ou palavra)
- resumo: 1 frase, sem fluff
- Tom firme, Jornada do Herói, pt-BR`,
        },
        {
          role: "user",
          content: `Herói: ${heroName}
Virtude alvo: ${answers.virtude}
Inimigo: ${answers.inimigo}
Como quer ser reconhecido: ${answers.reconhecimento}
Metas:
${goalsText}`,
        },
      ],
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 700,
      usageContext: { source: "alter-ego:synthesize" },
    });

    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const draft = upsertSchema.safeParse({
      nome: parsed.nome,
      codigo: parsed.codigo,
      virtudes: parsed.virtudes,
      inimigo: parsed.inimigo,
      resumo: typeof parsed.resumo === "string" ? parsed.resumo : "",
      source_answers: answers,
    });
    if (!draft.success) return null;
    return draft.data;
  } catch (e) {
    console.warn("[alter-ego] synthesize LLM failed", e);
    return null;
  }
}

export const getHeroAlterEgo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    return fetchAlterEgo(supabase as Client, userId);
  });

export const upsertHeroAlterEgo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    return upsertRow(supabase as Client, userId, data);
  });

export const synthesizeHeroAlterEgo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => synthesizeSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    checkSynthesizeRate(userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", userId)
      .maybeSingle();

    const llm = await synthesizeWithLlm(
      data.answers,
      data.goals,
      profile?.nome ?? "Herói",
    );
    const fallback = synthesizeAlterEgoFallback(data.answers);
    const payload = llm
      ? { ...llm, source_answers: data.answers }
      : {
          nome: fallback.nome,
          codigo: fallback.codigo,
          virtudes: fallback.virtudes,
          inimigo: fallback.inimigo,
          resumo: fallback.resumo,
          source_answers: data.answers,
        };

    const saved = await upsertRow(supabase as Client, userId, payload);
    return {
      alterEgo: saved,
      source: llm ? ("ai" as const) : ("fallback" as const),
    };
  });

export const regenerateHeroAlterEgo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        answers: answersSchema.optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    checkSynthesizeRate(userId);

    const existing = await fetchAlterEgo(supabase as Client, userId);
    const answers: AlterEgoAnswers =
      data.answers ??
      (existing?.source_answers?.virtude
        ? existing.source_answers
        : {
            virtude: existing?.virtudes?.[0] || ALTER_EGO_VIRTUDES[0],
            inimigo: existing?.inimigo || ALTER_EGO_INIMIGOS[0],
            reconhecimento: existing?.resumo || "homem que cumpre o que promete",
          });

    const { data: goals } = await supabase
      .from("goals")
      .select("categoria, titulo")
      .eq("user_id", userId)
      .in("status", ["ativa", "pausada"])
      .limit(12);

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", userId)
      .maybeSingle();

    const llm = await synthesizeWithLlm(
      answers,
      (goals ?? []).map((g) => ({
        categoria: String(g.categoria),
        titulo: String(g.titulo),
      })),
      profile?.nome ?? "Herói",
    );
    const fallback = synthesizeAlterEgoFallback(answers);
    const payload = llm
      ? { ...llm, source_answers: answers }
      : {
          nome: fallback.nome,
          codigo: fallback.codigo,
          virtudes: fallback.virtudes,
          inimigo: fallback.inimigo,
          resumo: fallback.resumo,
          source_answers: answers,
        };

    const saved = await upsertRow(supabase as Client, userId, payload);
    return {
      alterEgo: saved,
      source: llm ? ("ai" as const) : ("fallback" as const),
    };
  });

export const listHeroIdentityProofs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { listRecentIdentityProofs, getIdentityProofStats } = await import(
      "@/lib/identity-proofs"
    );
    const [proofs, stats] = await Promise.all([
      listRecentIdentityProofs(supabase as Client, userId, 30),
      getIdentityProofStats(supabase as Client, userId),
    ]);
    return { proofs, stats };
  });
