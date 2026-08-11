/**
 * Alter Ego do Herói — lógica pura (contexto Charlie + fallbacks).
 * Personalidade do Charlie ≠ esta identidade.
 */

export type AlterEgoAnswers = {
  virtude: string;
  inimigo: string;
  reconhecimento: string;
};

export type HeroAlterEgo = {
  id: string;
  user_id: string;
  nome: string;
  codigo: string[];
  virtudes: string[];
  inimigo: string;
  resumo: string;
  source_answers: AlterEgoAnswers;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AlterEgoContext = {
  nome: string;
  codigo: string[];
  virtudes: string[];
  inimigo: string;
  resumo?: string | null;
};

export const ALTER_EGO_VIRTUDES = [
  "Disciplina",
  "Coragem",
  "Foco",
  "Consistência",
  "Autocontrole",
  "Liderança",
  "Resiliência",
] as const;

export const ALTER_EGO_INIMIGOS = [
  "Procrastinação",
  "Falta de disciplina",
  "Distrações",
  "Falta de energia",
  "Medo",
  "Desorganização",
  "Desistência",
] as const;

const NOME_BY_VIRTUDE: Record<string, string> = {
  Disciplina: "O Disciplinado",
  Coragem: "O Destemido",
  Foco: "O Focado",
  Consistência: "O Consistente",
  Autocontrole: "O Guardião",
  Liderança: "O Líder",
  Resiliência: "O Inabalável",
};

function titleCaseNome(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "O Executor";
  if (/^o\s+/i.test(t)) {
    return t.replace(/^o\s+/i, "O ");
  }
  return `O ${t}`;
}

/** Fallback determinístico quando a LLM falha. */
export function synthesizeAlterEgoFallback(answers: AlterEgoAnswers): Omit<
  AlterEgoContext,
  "resumo"
> & { resumo: string } {
  const virtude = answers.virtude.trim() || "Disciplina";
  const inimigo = answers.inimigo.trim() || "Procrastinação";
  const reconhecimento = answers.reconhecimento.trim();

  const nome = NOME_BY_VIRTUDE[virtude] ?? titleCaseNome(virtude);

  const codigo = [
    "Eu faço o que prometi.",
    "Eu não preciso estar motivado para agir.",
    `Eu não negocio com ${inimigo.toLowerCase()}.`,
    "Um dia ruim não determina minha jornada.",
    "Se eu cair, volto amanhã.",
  ].slice(0, 5);

  const virtudes = [virtude];
  if (reconhecimento) {
    const extra = reconhecimento.split(/[,/]| e /i)[0]?.trim();
    if (extra && extra.toLowerCase() !== virtude.toLowerCase() && extra.length <= 40) {
      virtudes.push(extra.slice(0, 40));
    }
  }

  const resumo = reconhecimento
    ? `Homem reconhecido por: ${reconhecimento}. Vence ${inimigo.toLowerCase()} com ${virtude.toLowerCase()}.`
    : `Prioriza ${virtude.toLowerCase()} e supera ${inimigo.toLowerCase()}.`;

  return { nome, codigo, virtudes, inimigo, resumo };
}

export function formatAlterEgoBlock(alterEgo: AlterEgoContext | null | undefined): string {
  if (!alterEgo?.nome?.trim()) {
    return "IDENTIDADE DO HERÓI: ainda não definida. Não invente um alter ego. Se fizer sentido, incentive o herói a criar a identidade em /identity.";
  }

  const codigoLines =
    alterEgo.codigo?.length > 0
      ? alterEgo.codigo.map((c, i) => `  ${String(i + 1).padStart(2, "0")}. ${c}`).join("\n")
      : "  (sem código)";

  const virtudes =
    alterEgo.virtudes?.length > 0 ? alterEgo.virtudes.join(", ") : "—";

  const lines = [
    "IDENTIDADE DO HERÓI",
    `Alter Ego: ${alterEgo.nome.trim()}`,
    "Código:",
    codigoLines,
    `Virtudes: ${virtudes}`,
    `Inimigo principal: ${alterEgo.inimigo?.trim() || "—"}`,
  ];

  if (alterEgo.resumo?.trim()) {
    lines.push(`Resumo: ${alterEgo.resumo.trim()}`);
  }

  lines.push(
    "Use esta identidade com parcimônia: em fricção (procrastinação, skip, 'deixo pra amanhã'), cite o código. Você é Charlie — guardião da identidade, nunca o alter ego.",
  );

  return lines.join("\n");
}

export function firstCodigoLine(alterEgo: Pick<AlterEgoContext, "codigo"> | null | undefined): string | null {
  const line = alterEgo?.codigo?.[0]?.trim();
  return line || null;
}
