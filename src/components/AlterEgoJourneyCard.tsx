import { Link } from "@tanstack/react-router";
import { ChevronRight, Swords } from "lucide-react";
import { Card } from "@/components/ui/card";
import { firstCodigoLine } from "@/lib/alter-ego";

type Props = {
  alterEgo: {
    nome: string;
    codigo: string[];
  } | null;
  proofStats?: { week: number; total: number } | null;
  identityArc?: { nome: string; frase: string } | null;
};

/** Card de identidade / Alter Ego na Jornada. */
export function AlterEgoJourneyCard({ alterEgo, proofStats, identityArc }: Props) {
  if (!alterEgo) {
    return (
      <Link to="/identity" className="block">
        <Card className="cp-brackets group border-transparent bg-card/90 p-5 transition hover:brightness-110">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">Identidade</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
            <Swords className="h-4 w-4 text-hero" aria-hidden />
            Crie sua próxima versão
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina quem você precisa se tornar — Charlie protege esse código.
          </p>
          <span className="mt-3 inline-flex items-center text-xs text-hero">
            Criar identidade{" "}
            <ChevronRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </Card>
      </Link>
    );
  }

  const codigo = firstCodigoLine(alterEgo);
  const week = proofStats?.week ?? 0;

  return (
    <Link to="/identity" className="block">
      <Card className="cp-brackets group border-transparent bg-card/90 p-5 transition hover:brightness-110">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">Sua identidade</p>
        <h2 className="mt-1 font-display text-lg font-semibold">{alterEgo.nome}</h2>
        {codigo && (
          <p className="mt-2 border-l-2 border-hero pl-3 text-sm italic text-muted-foreground">
            "{codigo}"
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="text-foreground tabular-nums">{week}</span> provas esta semana
          {proofStats?.total != null ? (
            <span className="text-muted-foreground"> · {proofStats.total} no total</span>
          ) : null}
        </p>
        {identityArc && (
          <p className="mt-1 text-xs text-muted-foreground">
            Arco: {identityArc.nome} — {identityArc.frase}
          </p>
        )}
        <span className="mt-3 inline-flex items-center text-xs text-hero">
          Ver identidade{" "}
          <ChevronRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  );
}
