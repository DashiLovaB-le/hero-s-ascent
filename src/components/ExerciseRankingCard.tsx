import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Trophy } from "lucide-react";
import { getExerciseRanking } from "@/lib/exercise-ranking.functions";
import { runQueryFn } from "@/lib/safe-query";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  className?: string;
};

export function ExerciseRankingCard({ slug, className }: Props) {
  const getFn = useServerFn(getExerciseRanking);
  const { data, isLoading } = useQuery({
    queryKey: ["exercise-ranking", slug, "card"],
    queryFn: () =>
      runQueryFn(() => getFn({ data: { slug, limit: 20 } }), "Falha ao carregar ranking."),
    staleTime: 60_000,
  });

  const subtitle = (() => {
    if (isLoading) return "Carregando sua posição…";
    if (!data) return "Ver ranking da semana";
    if (!data.me.optedIn) return "Você está fora do ranking · ver quadro";
    if (data.me.reps < 1) return "Entre com reps válidas esta semana";
    if (data.me.rank != null) {
      return `Sua posição: #${data.me.rank} · ${data.me.reps} reps esta semana`;
    }
    return `${data.me.reps} reps esta semana`;
  })();

  return (
    <Link
      to="/exercises/ranking"
      search={{ slug }}
      className={cn(
        "cp-panel flex items-center gap-3 border border-transparent bg-card/90 px-4 py-3 transition-[filter] hover:brightness-110",
        className,
      )}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center bg-hero/15 text-hero">
        <Trophy className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold">Ranking da semana</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
