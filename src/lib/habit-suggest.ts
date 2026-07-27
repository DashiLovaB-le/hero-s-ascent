import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion } from "@/mentor/openrouter";

const ATTR = [
  "forca",
  "disciplina",
  "sabedoria",
  "espirito",
  "testosterona",
  "prosperidade",
  "conhecimento",
  "lideranca",
] as const;

const CAT = [
  "corpo",
  "mente",
  "espirito",
  "prosperidade",
  "relacionamentos",
  "proposito",
] as const;

const habitSuggestionSchema = z.object({
  titulo: z.string().trim().min(2).max(80),
  descricao: z.string().trim().max(280).optional(),
  xp_recompensa: z.number().int().min(5).max(50).default(15),
  atributo: z.enum(ATTR),
  categoria: z.enum(CAT),
});

export type HabitSuggestion = z.infer<typeof habitSuggestionSchema>;

const FALLBACK_BY_CAT: Record<(typeof CAT)[number], HabitSuggestion[]> = {
  corpo: [
    {
      titulo: "Treinar 30 minutos",
      xp_recompensa: 20,
      atributo: "forca",
      categoria: "corpo",
      descricao: "Movimento diário, mesmo que curto.",
    },
    {
      titulo: "Dormir antes das 23h",
      xp_recompensa: 15,
      atributo: "testosterona",
      categoria: "corpo",
    },
  ],
  mente: [
    {
      titulo: "Ler 20 minutos",
      xp_recompensa: 15,
      atributo: "conhecimento",
      categoria: "mente",
    },
    {
      titulo: "Foco profundo 25 min",
      xp_recompensa: 20,
      atributo: "disciplina",
      categoria: "mente",
    },
  ],
  espirito: [
    {
      titulo: "Gratidão em 3 linhas",
      xp_recompensa: 10,
      atributo: "espirito",
      categoria: "espirito",
    },
    {
      titulo: "Silêncio / meditação 10 min",
      xp_recompensa: 15,
      atributo: "espirito",
      categoria: "espirito",
    },
  ],
  prosperidade: [
    {
      titulo: "Estudar minha área 45 min",
      xp_recompensa: 20,
      atributo: "prosperidade",
      categoria: "prosperidade",
    },
    {
      titulo: "Revisar finanças 10 min",
      xp_recompensa: 15,
      atributo: "prosperidade",
      categoria: "prosperidade",
    },
  ],
  relacionamentos: [
    {
      titulo: "Mensagem sincera a alguém importante",
      xp_recompensa: 10,
      atributo: "lideranca",
      categoria: "relacionamentos",
    },
  ],
  proposito: [
    {
      titulo: "1h no projeto pessoal",
      xp_recompensa: 25,
      atributo: "lideranca",
      categoria: "proposito",
    },
  ],
};

function fallbackHabits(
  categories: (typeof CAT)[number][],
  max = 5,
): HabitSuggestion[] {
  const out: HabitSuggestion[] = [];
  const cats = categories.length ? categories : (["corpo", "mente"] as const);
  for (const c of cats) {
    const list = FALLBACK_BY_CAT[c] ?? [];
    if (list[0]) out.push(list[0]);
    if (out.length >= max) break;
  }
  while (out.length < Math.min(3, max)) {
    out.push(FALLBACK_BY_CAT.corpo[0]);
  }
  return out.slice(0, max);
}

const rateBucket = new Map<string, number>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const last = rateBucket.get(userId) ?? 0;
  if (now - last < 90_000) {
    throw new Error("Aguarde cerca de 1–2 minutos antes de pedir novas sugestões.");
  }
  rateBucket.set(userId, now);
}

export const suggestHabitsFromGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        goals: z
          .array(
            z.object({
              categoria: z.enum(CAT),
              titulo: z.string().trim().min(2).max(80),
            }),
          )
          .max(20)
          .default([]),
        categories: z.array(z.enum(CAT)).max(6).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;
    checkRateLimit(userId);

    const cats =
      data.categories?.length
        ? data.categories
        : [...new Set(data.goals.map((g) => g.categoria))];

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", userId)
      .maybeSingle();

    const fallback = fallbackHabits(cats, 5);

    if (!process.env.OPENROUTER_API_KEY) {
      return { habits: fallback, source: "fallback" as const };
    }

    try {
      const goalsText =
        data.goals.map((g) => `- [${g.categoria}] ${g.titulo}`).join("\n") ||
        "(sem metas explícitas)";

      const result = await chatCompletion({
        messages: [
          {
            role: "system",
            content: `Você é Charlie, mentor do V-Project. Sugira hábitos diários práticos em JSON.
Responda SOMENTE um objeto JSON: { "habits": [ ... ] }
Cada hábito: titulo (pt-BR, curto), descricao (opcional), xp_recompensa (10-25), atributo (um de: ${ATTR.join(", ")}), categoria (um de: ${CAT.join(", ")}).
Máximo 5 hábitos. Prefira 1 por categoria focada. Tom masculino direto, sem fluff.`,
          },
          {
            role: "user",
            content: `Herói: ${profile?.nome ?? "Herói"}
Categorias: ${cats.join(", ") || "gerais"}
Metas:
${goalsText}`,
          },
        ],
        temperature: 0.6,
        maxTokens: 900,
        jsonMode: true,
      });

      const parsed = JSON.parse(result.content) as { habits?: unknown };
      const arr = z.array(habitSuggestionSchema).min(1).max(5).safeParse(parsed.habits);
      if (!arr.success) {
        return { habits: fallback, source: "fallback" as const };
      }
      return { habits: arr.data, source: "ai" as const };
    } catch (e) {
      console.error("[habit-suggest]", e);
      return { habits: fallback, source: "fallback" as const };
    }
  });

export const createHabitsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        habits: z.array(habitSuggestionSchema).min(1).max(8),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completo")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.onboarding_completo) {
      throw new Error("Conclua o onboarding antes de criar hábitos.");
    }

    const rows = data.habits.map((h) => ({
      user_id: userId,
      titulo: h.titulo,
      descricao: h.descricao ?? null,
      xp_recompensa: h.xp_recompensa,
      atributo: h.atributo,
      categoria: h.categoria,
      ativo: true,
    }));

    const { data: inserted, error } = await supabase
      .from("habits")
      .insert(rows)
      .select("id, titulo, descricao, xp_recompensa, atributo, categoria, ativo, created_at");

    if (error) throw new Error(error.message);
    return { habits: inserted ?? [] };
  });
