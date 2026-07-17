import { calcularNivel, ATRIBUTO_LABELS } from "@/lib/journey";

export type MentorPresenceKind = "welcome" | "morning" | "evening" | "return" | null;

type AttrRow = {
  forca: number;
  disciplina: number;
  sabedoria: number;
  espirito: number;
  testosterona: number;
  prosperidade: number;
  conhecimento: number;
  lideranca: number;
};

type HabitRow = { id: string; titulo: string; atributo: string };
type GoalRow = { titulo: string; categoria: string };
type CompletionRow = { habit_id: string; dia: string };
type MemoryRow = { content: string; importance: number };
type ChallengeRow = { titulo: string; status: string; descricao: string };

export type MentorContextInput = {
  nome: string;
  xp_total: number;
  streak_atual: number;
  streak_maximo: number;
  capitulo_atual: number;
  ultimo_dia_completo: string | null;
  created_at: string;
  attributes: AttrRow;
  habits: HabitRow[];
  goals: GoalRow[];
  completionsLast21: CompletionRow[];
  completedTodayIds: string[];
  memories: MemoryRow[];
  activeChallenges: ChallengeRow[];
  daysSinceLastVisit: number | null;
};

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Detecta padrões simples de falha nos últimos 21 dias. */
export function detectSkipPatterns(habits: HabitRow[], completions: CompletionRow[]): string[] {
  if (!habits.length) return [];

  const completionsPerDay = new Map<string, number>();
  for (const c of completions) {
    completionsPerDay.set(c.dia, (completionsPerDay.get(c.dia) ?? 0) + 1);
  }

  const weekdayMisses = new Map<number, number>();
  const today = new Date();
  for (let i = 1; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if ((completionsPerDay.get(iso) ?? 0) === 0) {
      const wd = d.getDay();
      weekdayMisses.set(wd, (weekdayMisses.get(wd) ?? 0) + 1);
    }
  }

  const out: string[] = [];
  for (const [wd, count] of weekdayMisses) {
    if (count >= 2) {
      out.push(`Costuma zerar os hábitos em ${WEEKDAY[wd]} (${count}x nas últimas 3 semanas)`);
    }
  }

  for (const h of habits) {
    const doneDays = new Set(completions.filter((c) => c.habit_id === h.id).map((c) => c.dia)).size;
    if (doneDays <= 3 && completions.length >= 5) {
      out.push(`Hábito negligenciado: "${h.titulo}" (${doneDays} dias em 21)`);
    }
  }

  return out.slice(0, 6);
}

export function buildMentorContextBlock(input: MentorContextInput): string {
  const level = calcularNivel(input.xp_total);
  const attrs = Object.entries(input.attributes)
    .filter(([k]) => k in ATRIBUTO_LABELS)
    .map(([k, v]) => ({ label: ATRIBUTO_LABELS[k], value: v as number }))
    .sort((a, b) => b.value - a.value);

  const strongest = attrs[0] ? `${attrs[0].label}: ${attrs[0].value}` : "—";
  const weakest = attrs.length
    ? `${attrs[attrs.length - 1].label}: ${attrs[attrs.length - 1].value}`
    : "—";

  const feitosHoje = input.habits
    .filter((h) => input.completedTodayIds.includes(h.id))
    .map((h) => h.titulo);
  const pendentesHoje = input.habits
    .filter((h) => !input.completedTodayIds.includes(h.id))
    .map((h) => h.titulo);
  const patterns = detectSkipPatterns(input.habits, input.completionsLast21);

  const daysOnJourney = Math.max(
    1,
    Math.floor((Date.now() - new Date(input.created_at).getTime()) / (1000 * 60 * 60 * 24)),
  );

  const evolutionStage =
    level.atual.nivel <= 3 ? "iniciante" : level.atual.nivel <= 7 ? "intermediario" : "avancado";

  return [
    `Nome do herói: ${input.nome}`,
    `Dias na jornada: ${daysOnJourney}`,
    `Nível: ${level.atual.nivel} — ${level.atual.titulo} (XP ${input.xp_total})`,
    `Capítulo atual: ${input.capitulo_atual}`,
    `Streak: ${input.streak_atual} (máx ${input.streak_maximo})`,
    `Último dia completo: ${input.ultimo_dia_completo ?? "nunca"}`,
    `Estágio do Mentor (tom): ${evolutionStage}`,
    `Atributo mais forte: ${strongest}`,
    `Atributo mais fraco: ${weakest}`,
    `Atributos: ${attrs.map((a) => `${a.label}: ${a.value}`).join(", ")}`,
    `Metas ativas: ${
      input.goals.length
        ? input.goals.map((g) => `[${g.categoria}] ${g.titulo}`).join("; ")
        : "nenhuma"
    }`,
    `Hábitos ativos: ${input.habits.length ? input.habits.map((h) => h.titulo).join("; ") : "nenhum"}`,
    `Concluídos hoje (${feitosHoje.length}/${input.habits.length}): ${feitosHoje.join("; ") || "nenhum"}`,
    `Pendentes hoje: ${pendentesHoje.join("; ") || "nenhum"}`,
    `Padrões observados: ${patterns.length ? patterns.join(" | ") : "ainda poucos dados"}`,
    `Memórias importantes: ${
      input.memories.length
        ? input.memories.map((m) => `(${m.importance}/5) ${m.content}`).join(" | ")
        : "ainda nenhuma"
    }`,
    `Desafios ativos: ${
      input.activeChallenges.length
        ? input.activeChallenges.map((c) => `${c.titulo}: ${c.descricao}`).join(" | ")
        : "nenhum"
    }`,
    input.daysSinceLastVisit != null
      ? `Dias desde a última visita estimada: ${input.daysSinceLastVisit}`
      : "Visita recente ou primeira sessão",
  ].join("\n");
}

export function detectPresenceKind(opts: {
  messageCount: number;
  lastAssistantKind: string | null;
  lastAssistantAt: string | null;
  hour: number;
  daysSinceLastVisit: number | null;
  hadMorningToday?: boolean;
  hadEveningToday?: boolean;
  hadAssistantToday?: boolean;
}): MentorPresenceKind {
  if (opts.messageCount === 0) return "welcome";

  if (opts.daysSinceLastVisit != null && opts.daysSinceLastVisit >= 3) {
    const alreadyRecentReturn =
      opts.lastAssistantKind === "return" &&
      opts.lastAssistantAt &&
      Date.now() - new Date(opts.lastAssistantAt).getTime() < 1000 * 60 * 60 * 18;
    if (!alreadyRecentReturn) return "return";
  }

  if (opts.hour >= 5 && opts.hour < 11) {
    if (opts.hadMorningToday || opts.hadAssistantToday) return null;
    return "morning";
  }

  if (opts.hour >= 20 || opts.hour < 2) {
    if (opts.hadEveningToday) return null;
    return "evening";
  }

  return null;
}

export const MENTOR_SYSTEM_PROMPT = `Você é CHARLIE, o Mentor do V-Project — um mestre que já percorreu a Jornada do Herói.
Seu nome é sempre "Charlie". Nunca mude de nome. Nunca quebre o personagem.

IDENTIDADE
- Você fala como alguém que já caminhou. Calmo, firme, com poucas palavras e impacto.
- Nunca fala como assistente virtual. Nunca diga "Como posso ajudar", "Claro!", "Ótima pergunta", "Com certeza".
- Nunca use emojis. Nunca use gírias. Nunca faça piadas forçadas.
- Nunca julgue com "você errou" ou "você falhou". Prefira: "você pode voltar", "a jornada continua", "todo guerreiro tropeça".
- Responda em português do Brasil.
- Use o nome do herói com parcimônia — só quando aumentar o peso da frase.

ESTÁGIO DO TOM (campo "Estágio do Mentor")
- iniciante: mais presente, orienta fundamentos e pequenos passos.
- intermediario: aponta padrões, faz perguntas que forçam reflexão.
- avancado: quase não dá ordens; lembra quem o herói decidiu se tornar.

CONHECIMENTO
- Use SEMPRE o contexto da jornada (hábitos, metas, streaks, atributos, memórias, padrões).
- Se houver meta dominante (corpo, espírito, prosperidade…), incline as metáforas para esse foco.
- Se houver memória antiga relevante, conecte o presente ao passado.
- Se notar padrões (ex.: quartas sem treino), diga com precisão e sem acusação.

DESAFIOS
- Só proponha desafio quando fizer sentido narrativo (padrão, estagnação, ou pedido implícito).
- No máximo um desafio por resposta. Não force.

FORMATO DE RESPOSTA (obrigatório — JSON válido, sem markdown fora do JSON)
{
  "message": "texto falado ao herói (2 a 6 frases curtas, com quebras de linha se necessário)",
  "memory": null ou "uma frase curta para lembrar no futuro (só se o herói revelou algo importante sobre motivação, medo ou propósito)",
  "challenge": null ou {
    "titulo": "nome curto",
    "descricao": "o que fazer, concreto",
    "duracao_dias": 1,
    "xp_recompensa": 150,
    "titulo_recompensa": "opcional, ex: O Desperto"
  }
}

A mensagem deve soar humana e literária — nunca robótica.`;

export type MentorAiPayload = {
  message: string;
  memory: string | null;
  challenge: {
    titulo: string;
    descricao: string;
    duracao_dias: number;
    xp_recompensa: number;
    titulo_recompensa?: string | null;
  } | null;
};

export function parseMentorAiPayload(raw: string): MentorAiPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } else {
      return { message: raw.trim(), memory: null, challenge: null };
    }
  }

  const obj = parsed as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message.trim() : raw.trim();
  const memory =
    typeof obj.memory === "string" && obj.memory.trim().length > 0 ? obj.memory.trim() : null;

  let challenge: MentorAiPayload["challenge"] = null;
  if (obj.challenge && typeof obj.challenge === "object") {
    const c = obj.challenge as Record<string, unknown>;
    if (typeof c.titulo === "string" && typeof c.descricao === "string") {
      challenge = {
        titulo: c.titulo.trim().slice(0, 80),
        descricao: c.descricao.trim().slice(0, 400),
        duracao_dias: Math.min(30, Math.max(1, Number(c.duracao_dias) || 1)),
        xp_recompensa: Math.min(2000, Math.max(10, Number(c.xp_recompensa) || 100)),
        titulo_recompensa:
          typeof c.titulo_recompensa === "string" ? c.titulo_recompensa.trim().slice(0, 60) : null,
      };
    }
  }

  return { message: message || "A jornada continua.", memory, challenge };
}

export function presenceUserPrompt(kind: Exclude<MentorPresenceKind, null>): string {
  switch (kind) {
    case "welcome":
      return "O herói acabou de encontrar você pela primeira vez. Cumprimente-o como Charlie. Seja breve. Convide-o a falar o que busca nesta jornada — sem soar como formulário.";
    case "morning":
      return "É manhã. Entregue uma presença curta de amanhecer, baseada no contexto de hoje. Sem checklist. Uma direção.";
    case "evening":
      return "É o fim do dia. Comente o que o herói fez (ou deixou de fazer) hoje com honestidade serena. Feche o dia.";
    case "return":
      return "O herói ficou ausente. Não culpe. Chame-o de volta com dignidade, usando o contexto dos dias sem visita.";
  }
}
