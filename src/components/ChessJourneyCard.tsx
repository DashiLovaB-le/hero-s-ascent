import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { CHESS_WINS_TO_ADVANCE } from "@/mentor/chess-progress";

type Props = {
  chess?: {
    level: number;
    wins_at_level: number;
    wins_total: number;
    losses_total: number;
    draws_total: number;
  } | null;
};

export function ChessJourneyCard({ chess }: Props) {
  if (!chess) return null;

  const progressLabel =
    chess.level >= 10
      ? "Nível máximo"
      : `${chess.wins_at_level}/${CHESS_WINS_TO_ADVANCE} vitórias para o próximo`;

  return (
    <Card className="border-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Xadrez · Charlie</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Nível {chess.level}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{progressLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {chess.wins_total}V · {chess.draws_total}E · {chess.losses_total}D
          </p>
        </div>
        <Link
          to="/mentor"
          className="shrink-0 text-xs text-hero underline-offset-2 hover:underline"
        >
          Abrir mentor
        </Link>
      </div>
    </Card>
  );
}
