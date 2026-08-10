import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EXERCISE_CONSENT_VERSION } from "@/lib/exercise-xp";
import { getExerciseDefinition } from "@/lib/exercise/registry";
import {
  formatStepTarget,
  getWorkoutTemplateDef,
} from "@/lib/fitness/workout-templates";
import { startWorkout } from "@/lib/fitness/workout.functions";

export const Route = createFileRoute("/_authenticated/fitness/workout/$slug")({
  component: WorkoutPreviewPage,
  ssr: false,
});

function WorkoutPreviewPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const template = getWorkoutTemplateDef(slug);
  const startFn = useServerFn(startWorkout);
  const [consent, setConsent] = useState(false);

  const startM = useMutation({
    mutationFn: () =>
      startFn({
        data: {
          slug,
          clientMeta: {
            consent_version: EXERCISE_CONSENT_VERSION,
            ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        },
      }),
    onSuccess: (res) => {
      void navigate({
        to: "/fitness/play/$workoutId",
        params: { workoutId: res.session.id },
      });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!template) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">Treino desconhecido.</p>
        <Link to="/fitness">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start gap-3">
        <Link to="/fitness" className="mt-1">
          <Button size="icon" variant="ghost" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">
            Treino guiado
          </p>
          <h1 className="font-display text-2xl font-bold">{template.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{template.descricao}</p>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-hero/70">
            ~{template.durationMin} min · {template.difficulty} ·{" "}
            {template.steps.reduce((n, s) => n + s.sets, 0)} séries
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {template.steps.map((step, i) => {
          const def = getExerciseDefinition(step.exerciseSlug);
          return (
            <li
              key={`${step.exerciseSlug}-${i}`}
              className="cp-panel flex items-center justify-between gap-3 border border-transparent bg-card/80 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-display text-base leading-tight">
                  {def?.nome ?? step.exerciseSlug}
                </p>
                <p className="text-xs text-muted-foreground">
                  {def?.mode === "hold" ? "Hold" : "Reps"} · descanso{" "}
                  {step.restMs > 0 ? `${Math.round(step.restMs / 1000)}s` : "—"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium text-hero">
                {formatStepTarget(step)}
              </p>
            </li>
          );
        })}
      </ul>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Entendo que a câmera estima pose <strong>no aparelho</strong>, sem gravar
          vídeo, e que isso não é avaliação médica.
        </span>
      </label>

      <Button
        className="w-full gap-2"
        size="lg"
        disabled={!consent || startM.isPending}
        onClick={() => startM.mutate()}
      >
        <Play className="h-4 w-4" />
        {startM.isPending ? "Iniciando…" : "Começar treino"}
      </Button>
    </div>
  );
}
