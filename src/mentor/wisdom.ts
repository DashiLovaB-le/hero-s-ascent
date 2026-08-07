import type { WisdomCardSeed, WisdomSource } from "@/mentor/wisdom.seed";
import { WISDOM_SOURCE_LABEL } from "@/mentor/wisdom.seed";

export type WisdomCard = WisdomCardSeed & {
  id?: string;
  ativo?: boolean;
};

export type WisdomPickInput = {
  userText: string;
  personalitySlug: string | null;
  contextHints?: string[];
  limit?: number;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Score simples por tags/keywords + prioridade. Sem embeddings. */
export function pickWisdomCards(
  cards: WisdomCard[],
  input: WisdomPickInput,
): WisdomCard[] {
  const limit = input.limit ?? 5;
  const blob = normalize(
    [input.userText, ...(input.contextHints ?? [])].filter(Boolean).join("\n"),
  );
  const personality = (input.personalitySlug ?? "").toLowerCase();

  const scored = cards
    .filter((c) => c.ativo !== false)
    .filter((c) => !c.blocked_personalities.map((p) => p.toLowerCase()).includes(personality))
    .map((c) => {
      let score = c.priority;
      for (const kw of c.keywords) {
        const n = normalize(kw);
        if (n.length >= 3 && blob.includes(n)) score += 2;
      }
      for (const tag of c.tags) {
        const n = normalize(tag);
        if (blob.includes(n)) score += 1;
      }
      return { card: c, score };
    })
    .filter((x) => x.score > x.card.priority || blob.length < 12)
    .sort((a, b) => b.score - a.score);

  // Se nada bateu forte, ainda assim entregue top por prioridade (contexto geral)
  const pool =
    scored.length >= 2
      ? scored
      : cards
          .filter((c) => c.ativo !== false)
          .filter(
            (c) =>
              !c.blocked_personalities.map((p) => p.toLowerCase()).includes(personality),
          )
          .map((c) => ({ card: c, score: c.priority }))
          .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: WisdomCard[] = [];
  for (const { card } of pool) {
    if (seen.has(card.slug)) continue;
    seen.add(card.slug);
    out.push(card);
    if (out.length >= limit) break;
  }
  return out;
}

export function formatWisdomBlock(cards: WisdomCard[]): string {
  if (!cards.length) return "";
  const lines = cards.map((c, i) => {
    const src = WISDOM_SOURCE_LABEL[c.source as WisdomSource] ?? c.source;
    return [
      `${i + 1}. [${c.titulo}] (${src})`,
      `   Princípio: ${c.principio}`,
      `   Usar quando: ${c.quando_usar}`,
      `   Evitar: ${c.quando_evitar}`,
    ].join("\n");
  });

  return [
    "SABEDORIA DISPONÍVEL (opcional)",
    "Regras: use no máximo UM princípio se couber naturalmente; não force; não cite livro como autoridade absoluta; reescreva na sua voz; se nada couber, ignore o bloco.",
    ...lines,
  ].join("\n");
}

/** Hints a partir do snapshot textual já montado (trechos curtos). */
export function wisdomHintsFromContext(contextBlock: string): string[] {
  const hints: string[] = [];
  const lower = contextBlock.toLowerCase();
  if (/pendentes hoje:/.test(lower) && !/pendentes hoje: nenhum/.test(lower)) {
    hints.push("hábitos pendentes streak disciplina começar");
  }
  if (/streak: 0/.test(lower) || /último dia completo: nunca/.test(lower)) {
    hints.push("queda streak voltar culpa");
  }
  if (/risco_streak|risco_abandono/.test(lower)) {
    hints.push("desânimo abandono persistir");
  }
  if (/atributo mais fraco/.test(lower)) {
    hints.push("foco obstáculo disciplina");
  }
  if (/desafios ativos: nenhum/.test(lower)) {
    hints.push("ação obstáculo caminho");
  }
  return hints;
}
