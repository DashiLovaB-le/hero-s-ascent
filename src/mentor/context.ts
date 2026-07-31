import { calcularNivel, ATRIBUTO_LABELS, LEVELS } from "@/lib/journey";
import { formatMlSignalsForMentor, type MlScoresV1 } from "@/lib/ml/features";
import { addDaysToDateKey, hojeISO } from "@/lib/datetime";

export type MentorPresenceKind = "welcome" | "morning" | "evening" | "return" | "insight" | null;

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

export type MentorWeatherContext = {
  label: string;
  summaryLine: string;
} | null;

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
  /** Já há sugestão de hábito aguardando aceite no /mentor. */
  pendingHabitSuggestion: boolean;
  /** Pode propor habit_suggestion nesta resposta. */
  allowHabitSuggestion: boolean;
  weather: MentorWeatherContext;
  mlScores?: MlScoresV1 | null;
  challengePolicyHint?: string | null;
  checkinsSummary?: string | null;
  personality?: { slug: string; name: string } | null;
  /** Override explícito da fase (ex.: follow-up VERIFY→LEARN). */
  cyclePhaseHint?: string | null;
};

export const MENTOR_HABIT_ATRIBUTOS = [
  "forca",
  "disciplina",
  "sabedoria",
  "espirito",
  "testosterona",
  "prosperidade",
  "conhecimento",
  "lideranca",
] as const;

export const MENTOR_HABIT_CATEGORIAS = [
  "corpo",
  "mente",
  "espirito",
  "prosperidade",
  "relacionamentos",
  "proposito",
] as const;

export type MentorHabitAtributo = (typeof MENTOR_HABIT_ATRIBUTOS)[number];
export type MentorHabitCategoria = (typeof MENTOR_HABIT_CATEGORIAS)[number];

/** Deriva a linha FASE DO CICLO a partir do estado da jornada. */
export function resolveMentorCyclePhase(input: {
  activeChallengeCount: number;
  allowQuestion: boolean;
  cyclePhaseHint?: string | null;
}): string {
  if (input.cyclePhaseHint?.trim()) {
    return input.cyclePhaseHint.trim();
  }
  if (input.activeChallengeCount > 0) {
    return "Executar/Verificar (há plano em aberto — cobre evidência, não proponha outro desafio sem necessidade)";
  }
  if (input.allowQuestion) {
    return "Observar/Pensar (diagnóstico permitido; planeje o próximo passo concreto)";
  }
  return "Planejar/Executar (sem nova pergunta estruturada; foque orientação e ação)";
}

export type ChallengeOutcome = "complete" | "decline" | "expire";

/** Texto de usuário + hint de fase para follow-up VERIFY→LEARN. */
export function challengeFollowUpUserText(
  titulo: string,
  action: ChallengeOutcome,
  allowQuestion: boolean,
): { userText: string; cyclePhaseHint: string } {
  if (action === "complete") {
    return {
      cyclePhaseHint:
        "Verificar/Aprender (desafio concluído com evidência — celebre com parcimônia, extraia 1 aprendizado)",
      userText: [
        `FASE: Verificar/Aprender.`,
        `O herói CONCLUIU o desafio "${titulo}" (evidência registrada no app).`,
        `Comente em 1–2 frases no seu tom.`,
        `Grave memory se houver aprendizado real.`,
        allowQuestion
          ? `Faça UMA pergunta estruturada sobre o que isso revelou (tempo, energia, disciplina ou próximo passo).`
          : `NÃO faça pergunta estruturada (já houve hoje ou há pendente). question = null.`,
        `Só ajuste objective se o marco mudar o rumo.`,
        `Não proponha novo desafio nesta resposta.`,
      ].join(" "),
    };
  }
  if (action === "decline") {
    return {
      cyclePhaseHint:
        "Verificar/Aprender (desafio recusado — sem julgamento; nomeie o próximo passo mínimo)",
      userText: [
        `FASE: Verificar/Aprender.`,
        `O herói RECUSOU o desafio "${titulo}".`,
        `Comente em 1–2 frases sem celebrar e sem humilhar.`,
        `Se fizer sentido, grave memory sobre o bloqueio.`,
        allowQuestion
          ? `Faça UMA pergunta curta sobre o que impediu a execução.`
          : `NÃO faça pergunta estruturada. question = null.`,
        `Não proponha novo desafio nesta resposta.`,
      ].join(" "),
    };
  }
  return {
    cyclePhaseHint:
      "Verificar/Aprender (desafio expirado — o plano não fechou; cobrado retorno sem drama)",
    userText: [
      `FASE: Verificar/Aprender.`,
      `O desafio "${titulo}" EXPIROU sem conclusão.`,
      `Comente em 1–2 frases: o plano não fechou; ofereça o menor próximo passo possível.`,
      `Memory só se revelar padrão útil.`,
      allowQuestion
        ? `Faça UMA pergunta estruturada sobre o que travou (tempo vs energia vs prioridade).`
        : `NÃO faça pergunta estruturada. question = null.`,
      `Não proponha novo desafio nesta resposta.`,
    ].join(" "),
  };
}


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

/** Detecta padrões simples de falha nos últimos 21 dias (calendário Brasília). */
export function detectSkipPatterns(habits: HabitRow[], completions: CompletionRow[]): string[] {
  if (!habits.length) return [];

  const completionsPerDay = new Map<string, number>();
  for (const c of completions) {
    completionsPerDay.set(c.dia, (completionsPerDay.get(c.dia) ?? 0) + 1);
  }

  const weekdayMisses = new Map<number, number>();
  const todayKey = hojeISO();
  for (let i = 1; i <= 21; i++) {
    const iso = addDaysToDateKey(todayKey, -i);
    if ((completionsPerDay.get(iso) ?? 0) === 0) {
      // weekday via UTC noon on the date key (stable for calendar keys)
      const wd = new Date(`${iso}T12:00:00.000Z`).getUTCDay();
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
    input.personality
      ? `PERSONALIDADE ATIVA DO CHARLIE: ${input.personality.name} (${input.personality.slug}) — mantenha este tom até o fim da resposta`
      : null,
    `Dias na jornada: ${daysOnJourney}`,
    `Nível: ${level.atual.nivel} — ${level.atual.titulo} (XP ${input.xp_total})`,
    level.proximo
      ? `Próximo nível: ${level.proximo.nivel} — ${level.proximo.titulo} (faltam ${level.xp_para_proximo} XP)`
      : "Já alcançou o último nível listado",
    `Capítulo atual: ${input.capitulo_atual}`,
    `Streak: ${input.streak_atual} (máx ${input.streak_maximo})`,
    `Último dia completo: ${input.ultimo_dia_completo ?? "nunca"}`,
    `Estágio do Mentor (tom): ${stage}`,
    `FASE DO CICLO: ${resolveMentorCyclePhase({
      activeChallengeCount: input.activeChallenges.length,
      allowQuestion: input.allowQuestion,
      cyclePhaseHint: input.cyclePhaseHint,
    })}`,
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
    `Contagem de hábitos ativos: ${input.habits.length}`,
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
    `Sugestão de hábito pendente de aceite: ${input.pendingHabitSuggestion ? "SIM — habit_suggestion deve ser null" : "não"}`,
    `Pode propor habit_suggestion nesta resposta: ${input.allowHabitSuggestion ? "SIM (no máximo uma)" : "NÃO"}`,
    `PROPOSTAS (máx. UMA por resposta — NUNCA challenge e habit_suggestion juntos):
- challenge = missão COM PRAZO (dias/semana), pontual ou sprint; pode usar habit_id de hábito JÁ listado.
- habit_suggestion = rotina NOVA recorrente (todo dia / toda manhã / permanente) que ainda NÃO está na lista; o herói ACEITA no /mentor para criar o hábito.
- Se soa como rotina permanente → habit_suggestion. Se soa como prazo curto → challenge.
- Não sugira título quase igual a um hábito já listado. atributo ∈ ${MENTOR_HABIT_ATRIBUTOS.join("|")}; xp 5–50; categoria opcional ∈ ${MENTOR_HABIT_CATEGORIAS.join("|")}.`,
    input.weather
      ? input.weather.summaryLine
      : "Clima: região não cadastrada (herói pode definir a cidade no Perfil). Não invente o tempo.",
    formatMlSignalsForMentor(input.mlScores),
    input.challengePolicyHint ? input.challengePolicyHint : null,
    input.checkinsSummary
      ? input.checkinsSummary
      : "CHECK-INS: ausentes. Não invente sono, energia ou humor.",
    input.daysSinceLastVisit != null
      ? `Dias desde a última visita estimada: ${input.daysSinceLastVisit}`
      : "Visita recente ou primeira sessão",
  ]
    .filter(Boolean)
    .join("\n");
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

export const MENTOR_SYSTEM_PROMPT_DEFAULT = `Você é CHARLIE, o Mentor do V-Project — um mestre que já percorreu a Jornada do Herói.
Seu nome é sempre "Charlie". Nunca mude de nome. Nunca quebre o personagem.

IDENTIDADE
- Você fala como alguém que já caminhou. Calmo, firme, com poucas palavras e impacto.
- Nunca fala como assistente virtual. Nunca diga "Como posso ajudar", "Claro!", "Ótima pergunta", "Com certeza".
- Nunca use emojis. Nunca use gírias. Nunca faça piadas forçadas.
- Nunca julgue com "você errou" ou "você falhou". Prefira: "você pode voltar", "a jornada continua", "todo guerreiro tropeça".
- Responda em português do Brasil.
- Use o nome do herói com parcimônia — só quando aumentar o peso da frase.

CICLO DO MENTOR (obrigatório, interno — NÃO narre estas fases ao herói)
1. Observar — use só o contexto (hábitos, streak, ML, check-ins, desafios ativos, memórias).
2. Pensar — forme 1 diagnóstico implícito; não explique o raciocínio passo a passo.
3. Planejar — sirva o OBJETIVO ATUAL; proponha desafio OU hábito novo (nunca os dois) só se o contexto permitir e houver necessidade clara.
4. Executar — a "message" é a ordem/convite; desafio, habit_suggestion ou pergunta estruturada = ação pedida ao herói.
5. Verificar — não declare vitória sem evidência no contexto/app; se o herói diz "fiz" sem dado, cobre o check no app.
6. Aprender — em marco real (desafio encerrado, hábito aceito/recusado, decisão forte): grave "memory" e/ou ajuste "objective" com parcimônia.
- Há uma linha "FASE DO CICLO" no contexto: priorize essa fase nesta resposta.
- Nunca fale "algoritmo", "ciclo" ou "fase" em voz alta para o herói.

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
- Em VERIFY→LEARN (desafio encerrado), memory é bem-vinda se houver aprendizado real (importance 3–5).
- "memory_importance" de 1 a 5 (5 = marco vital). Respostas a perguntas profundas = 4 ou 5.

CLIMA
- Se houver linha de clima no contexto, use com parcimônia (no máximo um detalhe) em amanhecer, anoitecer ou desafios de corpo/outdoor.
- Adapte sugestões ao tempo real (chuva → indoor; calor extremo → hidratação/sombra). Nunca invente clima se o contexto disser ausente.

SINAIS ML
- Há um bloco "SINAIS ML" com scores calculados (risco_streak, risco_abandono, weekday fraco, projeção de nível).
- Use com parcimônia — cite no máximo um sinal por resposta, só quando ajudar o herói a agir.
- Se risco_streak ou risco_abandono estiver alto (≥55%) ou houver "AÇÃO: priorize presença proativa", antecipe o padrão (ex.: "sextas caem") sem esperar o herói dizer que está desanimado.
- Nunca invente sono, estresse, personalidade tipológica ou dados que não estejam no contexto.
- Não fale de "algoritmo", "modelo" ou "machine learning" — fale como mentor que observa padrões.

CHECK-INS
- Se houver bloco CHECK-INS com sono/energia/humor, use no máximo um detalhe quando for relevante (amanhecer, corpo, recuperação).
- Se CHECK-INS disser ausentes, não invente.

DESAFIOS vs HÁBITOS NOVOS (discernimento obrigatório)
- challenge = missão COM PRAZO (ex.: "por 3 dias", "até sexta", sprint). Pode vincular habit_id de hábito JÁ existente.
- habit_suggestion = rotina NOVA recorrente (ex.: "todo dia", "toda manhã", permanente) que o herói ainda não tem.
- NUNCA emita challenge e habit_suggestion na mesma resposta. Escolha um.
- Se a ideia for permanente/recorrente → habit_suggestion (não challenge). Se for temporal → challenge.
- Desafio: só quando fizer sentido narrativo; no máximo um; obedeça a POLÍTICA ADAPTATIVA; habit_id EXATO da lista se vincular; titulo_recompensa é simbólico.
- Hábito novo: só se "Pode propor habit_suggestion" = SIM; título diferente dos já listados; xp_recompensa entre 5 e 50; atributo válido; categoria opcional.
- O herói precisa ACEITAR habit_suggestion no app para o hábito entrar na lista — não diga que já foi criado.

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
  },
  "habit_suggestion": null ou {
    "titulo": "nome curto do hábito",
    "descricao": "opcional, concreto",
    "xp_recompensa": 10,
    "atributo": "disciplina",
    "categoria": null ou "corpo"
  }
}

- A mensagem deve soar humana e literária — nunca robótica.
- Nunca use tags HTML/XML. Nunca invente sequências como "</".
- O JSON deve caber por completo: message curto (até 4 frases). Se for fazer pergunta, prompt de uma linha.
`;

/** @deprecated use MENTOR_SYSTEM_PROMPT_DEFAULT ou getMentorSystemPrompt() */
export const MENTOR_SYSTEM_PROMPT = MENTOR_SYSTEM_PROMPT_DEFAULT;

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
  habit_suggestion: {
    titulo: string;
    descricao: string | null;
    xp_recompensa: number;
    atributo: MentorHabitAtributo;
    categoria: MentorHabitCategoria | null;
  } | null;
};

export type PendingHabitSuggestion = MentorAiPayload["habit_suggestion"] & {
  messageId: string;
};

/** Normalize for near-duplicate habit title checks. */
export function normalizeHabitTitle(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function habitTitlesConflict(a: string, b: string): boolean {
  const na = normalizeHabitTitle(a);
  const nb = normalizeHabitTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

export function habitSuggestionFollowUpUserText(
  titulo: string,
  action: "accept" | "decline",
  allowQuestion: boolean,
): { userText: string; cyclePhaseHint: string } {
  const ask = allowQuestion
    ? " Se fizer sentido, uma pergunta estruturada curta."
    : " Sem pergunta estruturada.";
  if (action === "accept") {
    return {
      cyclePhaseHint: "Verificar/Aprender (hábito aceito — celebre com parcimônia e cobrem o primeiro check)",
      userText: `O herói ACEITOU sua sugestão de hábito "${titulo}" — o hábito já entrou na lista dele. Reconheça em 1–3 frases. challenge null, habit_suggestion null.${ask}`,
    };
  }
  return {
    cyclePhaseHint: "Verificar/Aprender (hábito recusado — não pressione; ajuste rumo)",
    userText: `O herói RECUSOU a sugestão de hábito "${titulo}". Respeite. challenge null, habit_suggestion null.${ask}`,
  };
}

/** Remove lixo típico de JSON truncado (ex.: `</</</`). */
function scrubMentorText(text: string): string {
  return text
    .replace(/(?:<\s*\/\s*){2,}/g, "")
    .replace(/(?:<\/){2,}/g, "")
    .replace(/<\/+$/g, "")
    .replace(/\s{3,}/g, " ")
    .trim();
}

function unescapeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

/** Extrai um campo string mesmo de JSON incompleto / truncado. */
function extractJsonStringField(raw: string, field: string): string | null {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`);
  const m = raw.match(re);
  if (!m?.[1]) return null;
  const value = scrubMentorText(unescapeJsonString(m[1]));
  return value.length > 0 ? value : null;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const attempts: string[] = [trimmed];

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(trimmed.slice(start, end + 1));
  }

  // Fecha aspas/chaves abertas o suficiente para recuperar "message"
  if (start >= 0 && (end < start || !trimmed.endsWith("}"))) {
    let repaired = trimmed.slice(start);
    const quoteCount = (repaired.match(/"/g) ?? []).length;
    if (quoteCount % 2 === 1) repaired += '"';
    const open = (repaired.match(/{/g) ?? []).length;
    const close = (repaired.match(/}/g) ?? []).length;
    if (open > close) repaired += "}".repeat(open - close);
    attempts.push(repaired);
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

export function parseMentorAiPayload(raw: string): MentorAiPayload {
  const fallbackMessage =
    extractJsonStringField(raw, "message") ??
    (raw.trim().startsWith("{") ? "A jornada continua." : scrubMentorText(raw));

  const obj = tryParseJsonObject(raw);

  if (!obj) {
    return {
      message: fallbackMessage || "A jornada continua.",
      memory: null,
      memory_importance: 3,
      question: null,
      objective: null,
      challenge: null,
      habit_suggestion: null,
    };
  }

  const messageRaw =
    typeof obj.message === "string" && obj.message.trim()
      ? scrubMentorText(obj.message)
      : fallbackMessage;
  const message = messageRaw || "A jornada continua.";

  // Se ainda parece JSON cru, não exponha no chat
  const safeMessage =
    message.startsWith("{") && message.includes('"message"')
      ? extractJsonStringField(message, "message") ?? "A jornada continua."
      : message;

  const memory =
    typeof obj.memory === "string" && obj.memory.trim().length > 0
      ? scrubMentorText(obj.memory).slice(0, 400)
      : null;
  const memory_importance = Math.min(
    5,
    Math.max(1, Number(obj.memory_importance) || (memory ? 4 : 3)),
  );

  let question: MentorAiQuestion | null = null;
  if (obj.question && typeof obj.question === "object") {
    const q = obj.question as Record<string, unknown>;
    const promptFromObj =
      typeof q.prompt === "string" ? scrubMentorText(q.prompt) : null;
    const prompt = promptFromObj || extractJsonStringField(raw, "prompt");
    // Descarta pergunta claramente truncada / corrompida
    if (
      prompt &&
      prompt.length >= 8 &&
      /[?.!…]$/.test(prompt) &&
      !/(?:<\/){2,}/.test(prompt) &&
      !prompt.endsWith("</")
    ) {
      const options = Array.isArray(q.options)
        ? q.options
            .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
            .map((o) => scrubMentorText(o).slice(0, 80))
            .filter(Boolean)
            .slice(0, 4)
        : null;
      question = {
        prompt: prompt.slice(0, 280),
        options: options && options.length >= 2 ? options : null,
      };
    }
  }

  let objective: MentorAiPayload["objective"] = null;
  if (obj.objective && typeof obj.objective === "object") {
    const o = obj.objective as Record<string, unknown>;
    if (typeof o.titulo === "string" && o.titulo.trim()) {
      objective = {
        titulo: scrubMentorText(o.titulo).slice(0, 120),
        motivo: typeof o.motivo === "string" ? scrubMentorText(o.motivo).slice(0, 280) : null,
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
        titulo: scrubMentorText(c.titulo).slice(0, 80),
        descricao: scrubMentorText(c.descricao).slice(0, 400),
        duracao_dias: Math.min(30, Math.max(1, Number(c.duracao_dias) || 1)),
        xp_recompensa: Math.min(2000, Math.max(10, Number(c.xp_recompensa) || 100)),
        titulo_recompensa:
          typeof c.titulo_recompensa === "string"
            ? scrubMentorText(c.titulo_recompensa).slice(0, 60)
            : null,
        habit_id: habitId,
        completions_required: Math.min(30, Math.max(1, Number(c.completions_required) || 1)),
      };
    }
  }

  let habit_suggestion: MentorAiPayload["habit_suggestion"] = null;
  if (obj.habit_suggestion && typeof obj.habit_suggestion === "object") {
    const h = obj.habit_suggestion as Record<string, unknown>;
    if (typeof h.titulo === "string" && h.titulo.trim()) {
      const atributoRaw = typeof h.atributo === "string" ? h.atributo.trim().toLowerCase() : "";
      const atributo = (MENTOR_HABIT_ATRIBUTOS as readonly string[]).includes(atributoRaw)
        ? (atributoRaw as MentorHabitAtributo)
        : "disciplina";
      const catRaw = typeof h.categoria === "string" ? h.categoria.trim().toLowerCase() : "";
      const categoria = (MENTOR_HABIT_CATEGORIAS as readonly string[]).includes(catRaw)
        ? (catRaw as MentorHabitCategoria)
        : null;
      habit_suggestion = {
        titulo: scrubMentorText(h.titulo).slice(0, 80),
        descricao:
          typeof h.descricao === "string" && h.descricao.trim()
            ? scrubMentorText(h.descricao).slice(0, 280)
            : null,
        xp_recompensa: Math.min(50, Math.max(5, Number(h.xp_recompensa) || 10)),
        atributo,
        categoria,
      };
    }
  }

  // Discernimento server-side: nunca os dois. Preferir hábito novo quando não há vínculo a hábito existente.
  if (habit_suggestion && challenge) {
    if (challenge.habit_id) {
      habit_suggestion = null;
    } else {
      challenge = null;
    }
  }

  return {
    message: safeMessage,
    memory,
    memory_importance,
    question,
    objective,
    challenge,
    habit_suggestion,
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
      return `É manhã. Entregue uma presença curta de amanhecer, baseada no contexto de hoje, no OBJETIVO DO MENTOR e no clima (se houver). Sem checklist. Uma direção.${askHint}`;
    case "evening":
      return `É o fim do dia. Comente o que o herói fez (ou deixou de fazer) hoje com honestidade serena, alinhado ao OBJETIVO DO MENTOR. Pode mencionar o clima só se reforçar o fechamento. Feche o dia.${askHint}`;
    case "return":
      return `O herói ficou ausente. Não culpe. Chame-o de volta com dignidade. Prefira uma pergunta estruturada sobre o que o afastou (tempo, energia, ou outro).${askHint}`;
    case "insight":
      return `Os SINAIS ML no contexto indicam risco elevado de quebrar ritmo. Antecipe o padrão (weekday fraco / streak) com presença proativa e uma direção concreta. Sem alarmismo. Não mencione algoritmos.${askHint}`;
  }
}
