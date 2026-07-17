import { calcularNivel, ATRIBUTO_LABELS, LEVELS } from "@/lib/journey";

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
type ObjectiveRow = { titulo: string; motivo: string | null } | null;

export type EvolutionStage = "iniciante" | "intermediario" | "avancado";

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
  objective: ObjectiveRow;
  pendingQuestionToday: boolean;
  allowQuestion: boolean;
};

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function evolutionStageFromXp(xp: number): EvolutionStage {
  const level = calcularNivel(xp).atual.nivel;
  if (level <= 3) return "iniciante";
  if (level <= 7) return "intermediario";
  return "avancado";
}

export function defaultObjectiveForHero(nome: string, xp: number): { titulo: string; motivo: string } {
  const progress = calcularNivel(xp);
  const next = progress.proximo ?? LEVELS[LEVELS.length - 1];
  return {
    titulo: `Levar ${nome} até ${next.titulo}`,
    motivo: `Próximo marco da jornada: nível ${next.nivel} (${next.titulo}).`,
  };
}

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
  const stage = evolutionStageFromXp(input.xp_total);
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

  const habitsWithIds = input.habits
    .map((h) => `${h.titulo} [id=${h.id}]`)
    .join("; ");

  return [
    `Nome do herói: ${input.nome}`,
    `Dias na jornada: ${daysOnJourney}`,
    `Nível: ${level.atual.nivel} — ${level.atual.titulo} (XP ${input.xp_total})`,
    level.proximo
      ? `Próximo nível: ${level.proximo.nivel} — ${level.proximo.titulo} (faltam ${level.xp_para_proximo} XP)`
      : "Já alcançou o último nível listado",
    `Capítulo atual: ${input.capitulo_atual}`,
    `Streak: ${input.streak_atual} (máx ${input.streak_maximo})`,
    `Último dia completo: ${input.ultimo_dia_completo ?? "nunca"}`,
    `Estágio do Mentor (tom): ${stage}`,
    `OBJETIVO ATUAL DO MENTOR: ${
      input.objective
        ? `${input.objective.titulo}${input.objective.motivo ? ` — ${input.objective.motivo}` : ""}`
        : "ainda não definido (sugira um objetivo alinhado ao próximo marco)"
    }`,
    `Pode fazer pergunta estruturada nesta resposta: ${input.allowQuestion ? "SIM (no máximo uma)" : "NÃO (já houve pergunta hoje ou há pergunta pendente)"}`,
    `Atributo mais forte: ${strongest}`,
    `Atributo mais fraco: ${weakest}`,
    `Atributos: ${attrs.map((a) => `${a.label}: ${a.value}`).join(", ")}`,
    `Metas ativas: ${
      input.goals.length
        ? input.goals.map((g) => `[${g.categoria}] ${g.titulo}`).join("; ")
        : "nenhuma"
    }`,
    `Hábitos ativos (use id se vincular desafio): ${habitsWithIds || "nenhum"}`,
    `Concluídos hoje (${feitosHoje.length}/${input.habits.length}): ${feitosHoje.join("; ") || "nenhum"}`,
    `Pendentes hoje: ${pendentesHoje.join("; ") || "nenhum"}`,
    `Padrões observados: ${patterns.length ? patterns.join(" | ") : "ainda poucos dados"}`,
    `Memórias importantes (já ordenadas): ${
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

OBJETIVO DO MENTOR
- Há um "OBJETIVO ATUAL DO MENTOR" no contexto. Toda resposta deve servir a esse objetivo.
- Se o objetivo ainda não existir, sugira um via "objective" no JSON (título curto + motivo).
- Não mude de objetivo a cada mensagem. Só proponha novo objetivo quando o herói mudou de nível, de capítulo ou pediu outro rumo.

ESTÁGIO DO TOM (campo "Estágio do Mentor") — obedeça com rigor
- iniciante: explica mais, celebra pequenas vitórias, ensina o próximo passo concreto. Pode ser um pouco mais longo (até 6 frases).
- intermediario: direto, cobra consistência, faz perguntas que forçam reflexão. Prefira 3–5 frases.
- avancado: fala menos, provoca, assume que o herói já sabe o caminho. Prefira 2–4 frases. Quase não dá ordens.

PERGUNTAS ESTRUTURADAS
- Quando "Pode fazer pergunta estruturada" = SIM, e houver gatilho (hábito pendente importante, retorno após ausência, estagnação, após falar de desafio), faça UMA pergunta.
- Prefira perguntas de diagnóstico: tempo vs energia; qual hábito trava; o que faria diferente ontem.
- Se options fizer sentido, ofereça 2–4 opções curtas. Caso contrário, options = null.
- Quando "Pode fazer pergunta estruturada" = NÃO, question deve ser null.

MEMÓRIAS
- Só grave memory quando o herói revelar motivação, medo, propósito ou uma decisão importante.
- "memory_importance" de 1 a 5 (5 = marco vital). Respostas a perguntas profundas = 4 ou 5.

DESAFIOS
- Só proponha desafio quando fizer sentido narrativo (padrão, estagnação, ou pedido implícito).
- No máximo um desafio por resposta. Não force.
- Se vincular a um hábito, use habit_id EXATO da lista e completions_required (quantas vezes concluir no período).
- titulo_recompensa é simbólico (título honorífico), nunca invente mecânica inexistente.

FORMATO DE RESPOSTA (obrigatório — JSON válido, sem markdown fora do JSON)
{
  "message": "texto falado ao herói",
  "memory": null ou "frase curta para lembrar",
  "memory_importance": 1,
  "question": null ou {
    "prompt": "pergunta clara",
    "options": null ou ["opção A", "opção B"]
  },
  "objective": null ou {
    "titulo": "objetivo curto do mentor",
    "motivo": "por que agora"
  },
  "challenge": null ou {
    "titulo": "nome curto",
    "descricao": "o que fazer, concreto",
    "duracao_dias": 1,
    "xp_recompensa": 150,
    "titulo_recompensa": "opcional",
    "habit_id": null ou "uuid-do-habito",
    "completions_required": 1
  }
}

A mensagem deve soar humana e literária — nunca robótica.`;

export type MentorAiQuestion = {
  prompt: string;
  options: string[] | null;
};

export type MentorAiPayload = {
  message: string;
  memory: string | null;
  memory_importance: number;
  question: MentorAiQuestion | null;
  objective: { titulo: string; motivo: string | null } | null;
  challenge: {
    titulo: string;
    descricao: string;
    duracao_dias: number;
    xp_recompensa: number;
    titulo_recompensa?: string | null;
    habit_id?: string | null;
    completions_required?: number;
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
      return {
        message: raw.trim(),
        memory: null,
        memory_importance: 3,
        question: null,
        objective: null,
        challenge: null,
      };
    }
  }

  const obj = parsed as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message.trim() : raw.trim();
  const memory =
    typeof obj.memory === "string" && obj.memory.trim().length > 0 ? obj.memory.trim() : null;
  const memory_importance = Math.min(
    5,
    Math.max(1, Number(obj.memory_importance) || (memory ? 4 : 3)),
  );

  let question: MentorAiQuestion | null = null;
  if (obj.question && typeof obj.question === "object") {
    const q = obj.question as Record<string, unknown>;
    if (typeof q.prompt === "string" && q.prompt.trim()) {
      const options = Array.isArray(q.options)
        ? q.options
            .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
            .map((o) => o.trim().slice(0, 80))
            .slice(0, 4)
        : null;
      question = {
        prompt: q.prompt.trim().slice(0, 280),
        options: options && options.length >= 2 ? options : null,
      };
    }
  }

  let objective: MentorAiPayload["objective"] = null;
  if (obj.objective && typeof obj.objective === "object") {
    const o = obj.objective as Record<string, unknown>;
    if (typeof o.titulo === "string" && o.titulo.trim()) {
      objective = {
        titulo: o.titulo.trim().slice(0, 120),
        motivo: typeof o.motivo === "string" ? o.motivo.trim().slice(0, 280) : null,
      };
    }
  }

  let challenge: MentorAiPayload["challenge"] = null;
  if (obj.challenge && typeof obj.challenge === "object") {
    const c = obj.challenge as Record<string, unknown>;
    if (typeof c.titulo === "string" && typeof c.descricao === "string") {
      const habitId =
        typeof c.habit_id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          c.habit_id,
        )
          ? c.habit_id
          : null;
      challenge = {
        titulo: c.titulo.trim().slice(0, 80),
        descricao: c.descricao.trim().slice(0, 400),
        duracao_dias: Math.min(30, Math.max(1, Number(c.duracao_dias) || 1)),
        xp_recompensa: Math.min(2000, Math.max(10, Number(c.xp_recompensa) || 100)),
        titulo_recompensa:
          typeof c.titulo_recompensa === "string" ? c.titulo_recompensa.trim().slice(0, 60) : null,
        habit_id: habitId,
        completions_required: Math.min(30, Math.max(1, Number(c.completions_required) || 1)),
      };
    }
  }

  return {
    message: message || "A jornada continua.",
    memory,
    memory_importance,
    question,
    objective,
    challenge,
  };
}

export function presenceUserPrompt(
  kind: Exclude<MentorPresenceKind, null>,
  extras?: { allowQuestion: boolean },
): string {
  const askHint = extras?.allowQuestion
    ? " Se fizer sentido, faça UMA pergunta estruturada no JSON."
    : " Não faça pergunta estruturada nesta resposta.";

  switch (kind) {
    case "welcome":
      return `O herói acabou de encontrar você pela primeira vez. Cumprimente-o como Charlie. Seja breve. Convide-o a falar o que busca nesta jornada — sem soar como formulário.${askHint}`;
    case "morning":
      return `É manhã. Entregue uma presença curta de amanhecer, baseada no contexto de hoje e no OBJETIVO DO MENTOR. Sem checklist. Uma direção.${askHint}`;
    case "evening":
      return `É o fim do dia. Comente o que o herói fez (ou deixou de fazer) hoje com honestidade serena, alinhado ao OBJETIVO DO MENTOR. Feche o dia.${askHint}`;
    case "return":
      return `O herói ficou ausente. Não culpe. Chame-o de volta com dignidade. Prefira uma pergunta estruturada sobre o que o afastou (tempo, energia, ou outro).${askHint}`;
  }
}
