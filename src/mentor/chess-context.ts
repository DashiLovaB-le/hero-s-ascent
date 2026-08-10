/** Resumo enxuto de xadrez para o contexto do Charlie (sem FEN/PGN/Elo). */

export type ChessGameRow = {
  status: string;
  result_reason: string | null;
  updated_at: string;
  created_at?: string;
};

export type ChessMentorSummary = {
  /** Uma linha pronta para o prompt; null = omitir bloco. */
  line: string | null;
};

const LOOKBACK_DAYS = 30;
const STREAK_LEN = 5;

function resultLabel(status: string, reason: string | null): string {
  if (status === "won") return "V";
  if (status === "lost") return "D";
  if (status === "draw") {
    if (reason === "abandoned") return "A"; // abandonou
    return "E";
  }
  return "?";
}

function resultWord(status: string, reason: string | null): string {
  if (status === "won") return "vitória";
  if (status === "lost") return "derrota";
  if (status === "draw" && reason === "abandoned") return "abandonada";
  if (status === "draw") return "empate";
  return status;
}

function dayPartLabel(iso: string, timezone?: string | null): string {
  try {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone?.trim() || undefined,
    });
    const hour = Number(fmt.format(new Date(iso)));
    if (!Number.isFinite(hour)) return "";
    if (hour < 5) return "madrugada";
    if (hour < 12) return "manhã";
    if (hour < 18) return "tarde";
    return "noite";
  } catch {
    return "";
  }
}

function daysAgoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days}d`;
}

/**
 * Agrega partidas concluídas/abandonadas (won|lost|draw) dos últimos 30 dias.
 * Ignora active/paused. Retorna null se não houver histórico relevante.
 */
export function summarizeChessForMentor(
  rows: ChessGameRow[],
  opts?: { timezone?: string | null },
): ChessMentorSummary {
  const cutoff = Date.now() - LOOKBACK_DAYS * 86_400_000;
  const finished = rows
    .filter((r) => r.status === "won" || r.status === "lost" || r.status === "draw")
    .filter((r) => {
      const t = new Date(r.updated_at).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  if (!finished.length) return { line: null };

  const last = finished[0]!;
  const last7Cut = Date.now() - 7 * 86_400_000;
  const last7 = finished.filter((r) => new Date(r.updated_at).getTime() >= last7Cut);

  const countBy = (list: ChessGameRow[]) => {
    let v = 0;
    let d = 0;
    let e = 0;
    let a = 0;
    for (const r of list) {
      if (r.status === "won") v += 1;
      else if (r.status === "lost") d += 1;
      else if (r.status === "draw" && r.result_reason === "abandoned") a += 1;
      else if (r.status === "draw") e += 1;
    }
    return { v, d, e, a, n: list.length };
  };

  const c7 = countBy(last7);
  const c30 = countBy(finished);
  const seq = finished
    .slice(0, STREAK_LEN)
    .map((r) => resultLabel(r.status, r.result_reason))
    .join("-");

  const abandonedRate = c30.n > 0 ? c30.a / c30.n : 0;
  const ritual =
    abandonedRate >= 0.5
      ? "muitos abandonos"
      : c7.n >= 2
        ? "ritual regular"
        : c30.n >= 1
          ? "ritual ocasional"
          : "pouco uso";

  const when = dayPartLabel(last.updated_at, opts?.timezone);
  const ago = daysAgoLabel(last.updated_at);
  const lastBit = `última = ${resultWord(last.status, last.result_reason)} (${ago}${when ? ` · ${when}` : ""})`;
  const weekBit =
    c7.n > 0
      ? `7d = ${c7.v}V ${c7.d}D${c7.e ? ` ${c7.e}E` : ""}${c7.a ? ` ${c7.a}A` : ""}`
      : "7d = nenhuma";
  const monthBit = `30d = ${c30.n} partida${c30.n === 1 ? "" : "s"}`;

  const line = `Xadrez (ritual, não virar coach de abertura): ${lastBit}; ${weekBit}; ${monthBit}; sequência recente ${seq}; ${ritual}. Use só para tom (paciência, presença); não invente lances nem Elo.`;

  return { line };
}
