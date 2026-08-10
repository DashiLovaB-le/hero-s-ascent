import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Dumbbell, Flame } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listFitnessCatalog } from "@/lib/exercise/registry";

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
};

function FitnessHubPage() {
  const catalog = listFitnessCatalog();

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
            Câmera on-device · sem gravar vídeo · XP por evidência. Treinos com séries chegam na
            próxima fase — por enquanto escolha um exercício.
          </p>
        </div>
      </div>

      <div className="cp-panel border border-transparent bg-hero-glow/40 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center bg-hero/20 text-hero">
            <Flame className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-sm">
            <p className="font-display text-base">Treinos guiados</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Corpo inteiro, pernas, push + core — em breve no player com descanso entre steps.
            </p>
            <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-hero/80">
              Em breve
            </p>
          </div>
        </div>
      </div>

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
