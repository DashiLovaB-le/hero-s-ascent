import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trophy } from "lucide-react";
import { z } from "zod";
import { getExerciseRanking, type ExerciseRankingEntry } from "@/lib/exercise-ranking.functions";
import { PUSHUP_SLUG } from "@/lib/exercise-xp";
import { runQueryFn } from "@/lib/safe-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  slug: z.string().trim().min(1).max(40).optional(),
});

export const Route = createFileRoute("/_authenticated/exercises/ranking")({
  validateSearch: (s: Record<string, unknown>): { slug?: string } => {
    const parsed = searchSchema.safeParse(s);
    return parsed.success ? parsed.data : {};
  },
  component: ExerciseRankingPage,
});

function formatWeekLabel(start: string, end: string) {
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function RankRow({ entry, highlight }: { entry: ExerciseRankingEntry; highlight?: boolean }) {
  return (
    <li
      className={cn(
        "cp-panel flex items-center gap-3 border border-transparent px-3 py-2.5 text-sm",
        highlight || entry.isMe ? "bg-hero/15" : "bg-card/80",
      )}
    >
      <span className="w-8 shrink-0 font-mono text-sm text-hero">#{entry.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {entry.nome}
          {entry.isMe ? <span className="ml-1 text-xs text-hero">(você)</span> : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {entry.formaPct != null ? `Forma média ${entry.formaPct}%` : "Forma —"}
        </p>
      </div>
      <span className="shrink-0 font-mono text-base text-foreground">{entry.reps}</span>
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        reps
      </span>
    </li>
  );
}

function ExerciseRankingPage() {
  const { slug: slugSearch } = Route.useSearch();
  const slug = slugSearch || PUSHUP_SLUG;
  const getFn = useServerFn(getExerciseRanking);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["exercise-ranking", slug],
    queryFn: () =>
      runQueryFn(() => getFn({ data: { slug, limit: 20 } }), "Falha ao carregar ranking."),
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-start gap-3">
        <Link to="/exercises/$slug" params={{ slug }} className="mt-1">
          <Button size="icon" variant="ghost" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">Ranking semanal</p>
          <h1 className="font-display text-2xl font-bold">
            {data?.exercise.nome ?? "Exercício"}
          </h1>
          {data ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatWeekLabel(data.weekStart, data.weekEnd)} · {data.participants} no ranking
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Reps válidas desta semana</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando ranking…</p>
      ) : isError ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Não foi possível carregar."}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : data ? (
        <>
          {!data.me.optedIn ? (
            <div className="cp-panel border border-transparent bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
              Você está fora do ranking público.{" "}
              <Link to="/profile" className="underline decoration-hero underline-offset-2">
                Ativar no perfil
              </Link>
            </div>
          ) : null}

          <section className="space-y-2">
            <p className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-hero" /> Top 20
            </p>
            {data.top.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguém no ranking ainda. Complete uma sessão esta semana para entrar.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.top.map((e) => (
                  <RankRow key={e.userId} entry={e} />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Sua posição
            </p>
            <div className="cp-panel border border-transparent bg-card/90 px-4 py-3 text-sm">
              {!data.me.optedIn ? (
                <p className="text-muted-foreground">Opt-out ativo — suas reps não entram no quadro.</p>
              ) : data.me.reps < 1 ? (
                <p className="text-muted-foreground">
                  Faça uma sessão de {data.exercise.nome.toLowerCase()} esta semana para pontuar.
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg">
                      {data.me.rank != null ? `#${data.me.rank}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.me.formaPct != null
                        ? `Forma média ${data.me.formaPct}%`
                        : "Forma —"}
                    </p>
                  </div>
                  <p className="font-mono text-2xl text-hero">{data.me.reps}</p>
                </div>
              )}
            </div>

            {data.neighbors.length > 0 ? (
              <ul className="space-y-2">
                {data.neighbors.map((e) => (
                  <RankRow key={`n-${e.userId}`} entry={e} highlight={e.isMe} />
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
