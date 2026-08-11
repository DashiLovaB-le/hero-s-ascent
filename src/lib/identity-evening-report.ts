/**
 * Relatório de identidade (fechamento do dia) — texto puro, testável.
 * Usado pelo job de notificações (Telegram / Discord / in-app).
 */

export type IdentityEveningReportInput = {
  firstName?: string | null;
  alterEgoNome?: string | null;
  codigoLine?: string | null;
  habitsDone: number;
  habitsTotal: number;
  proofsWeek: number;
  identidadeHoje?: "sim" | "parcial" | "nao" | string | null;
  /** 0–100 se disponível */
  aderenciaPct?: number | null;
};

export type IdentityEveningReport = {
  titulo: string;
  corpo: string;
};

function identidadeLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "sim") return "sim — agiu como quem quer se tornar";
  if (s === "parcial") return "parcialmente";
  if (s === "nao" || s === "não") return "não — e um dia fraco não destrói a identidade";
  return v.trim();
}

/**
 * Monta título + corpo curtos (cabem em Telegram/Discord DM).
 */
export function buildIdentityEveningReport(
  input: IdentityEveningReportInput,
): IdentityEveningReport {
  const done = Math.max(0, input.habitsDone);
  const total = Math.max(0, input.habitsTotal);
  const pending = Math.max(0, total - done);
  const name = input.firstName?.trim() || null;
  const ego = input.alterEgoNome?.trim() || null;
  const code = input.codigoLine?.trim() || null;

  const titulo = ego ? `Fechamento · ${ego}` : "Relatório de identidade";

  const lines: string[] = [];
  if (name) lines.push(`${name}.`);

  if (total > 0) {
    if (pending === 0) {
      lines.push(`Compromissos de hoje: ${done}/${total} — dia fechado.`);
    } else {
      lines.push(`Compromissos de hoje: ${done}/${total} (${pending} em aberto).`);
    }
  } else {
    lines.push("Sem hábitos ativos registrados hoje.");
  }

  lines.push(
    input.proofsWeek === 1
      ? "1 prova de identidade nesta semana."
      : `${Math.max(0, input.proofsWeek)} provas de identidade nesta semana.`,
  );

  const idToday = identidadeLabel(input.identidadeHoje);
  if (idToday) {
    lines.push(`Check-in de identidade: ${idToday}.`);
  }

  if (
    typeof input.aderenciaPct === "number" &&
    Number.isFinite(input.aderenciaPct) &&
    ego
  ) {
    lines.push(`Aderência recente: ${Math.round(input.aderenciaPct)}%.`);
  }

  if (code) {
    lines.push(`Código: "${code}"`);
  }

  lines.push(
    pending > 0
      ? "Ainda dá tempo de um ato alinhado. Um dia fraco não apaga quem você decidiu ser."
      : "Feche o dia em paz. Amanhã o código continua.",
  );

  return {
    titulo,
    corpo: lines.join(" ").replace(/\s+/g, " ").trim(),
  };
}
