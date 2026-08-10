import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Dumbbell, Flame } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listFitnessCatalog } from "@/lib/exercise/registry";
import {
  formatStepTarget,
  listWorkoutTemplateDefs,
} from "@/lib/fitness/workout-templates";
import { listRecentWorkouts } from "@/lib/fitness/workout.functions";
import { getExerciseDefinition } from "@/lib/exercise/registry";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/_authenticated/fitness")({
  component: FitnessHubPage,
  ssr: false,
});

const REGION_LABEL: Record<string, string> = {
  push: "Push",
  legs: "Pernas",
  core: "Core",
  posterior: "Posterior",
  full: "Completo",
  push_core: "Push + core",
};

const DIFF_LABEL: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
};

function FitnessHubPage() {
  const catalog = listFitnessCatalog();
  const templates = listWorkoutTemplateDefs();
  const listRecentFn = useServerFn(listRecentWorkouts);

  const recentQ = useQuery({
    queryKey: ["fitness-hub", "recent"] as const,
    queryFn: () =>
      runQueryFn(
        () => listRecentFn({ data: { limit: 5 } }),
        "Falha ao carregar histórico.",
      ),
    retry: false,
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start gap-3">
        <Link to="/habits" className="mt-1">
          <Button size="icon" variant="ghost" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">
            Charlie Fitness
          </p>
          <h1 className="font-display text-2xl font-bold">Treino em casa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Câmera on-device · sem gravar vídeo · XP consolidado no fim do treino guiado.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          Treinos guiados
        </p>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.slug}>
              <Link
                to="/fitness/workout/$slug"
                params={{ slug: t.slug }}
                className="cp-panel flex items-center gap-3 border border-transparent bg-hero-glow/30 p-4 transition-[filter] hover:brightness-110"
              >
                <div className="grid h-10 w-10 place-items-center bg-hero/20 text-hero">
                  <Flame className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base leading-tight">{t.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.descricao}</p>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.16em] text-hero/70">
                    ~{t.durationMin} min · {DIFF_LABEL[t.difficulty] ?? t.difficulty} ·{" "}
                    {REGION_LABEL[t.region] ?? t.region}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {t.steps
                      .map((s) => {
                        const nome =
                          getExerciseDefinition(s.exerciseSlug)?.nome ?? s.exerciseSlug;
                        return `${nome} ${formatStepTarget(s)}`;
                      })
                      .join(" · ")}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-hero" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recentQ.data && recentQ.data.length > 0 && (
        <section className="space-y-2">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Últimos treinos
          </p>
          <ul className="space-y-1.5 text-sm">
            {recentQ.data.map((w) => (
              <li
                key={w.id}
                className="flex justify-between gap-2 border-b border-border/40 py-2"
              >
                <span className="truncate">{w.titulo}</span>
                <span className="shrink-0 text-muted-foreground">
                  +{w.xp_ganho} XP · {w.setCount} séries
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          Exercícios avulsos
        </p>
        <ul className="space-y-2">
          {catalog.map((item) => (
            <li key={item.slug}>
              <Link
                to="/exercises/$slug"
                params={{ slug: item.slug }}
                className="cp-panel flex items-center gap-3 border border-transparent bg-card/80 p-4 transition-[filter] hover:brightness-110"
              >
                <div className="grid h-10 w-10 place-items-center bg-hero/15 text-hero">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base leading-tight">{item.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.shortBlurb}</p>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.16em] text-hero/70">
                    {REGION_LABEL[item.region] ?? item.region} ·{" "}
                    {item.mode === "hold" ? "hold" : "reps"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-hero" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Estimativa de execução — não é avaliação médica.
      </p>
    </div>
  );
}
