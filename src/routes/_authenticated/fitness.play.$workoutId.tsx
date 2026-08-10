import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, SkipForward, X } from "lucide-react";
import { toast } from "sonner";

import { ExerciseSessionCameraModal } from "@/components/ExerciseSessionCameraModal";
import { showXpGainPopup } from "@/components/XpGainPopup";
import { Button } from "@/components/ui/button";
import { getExerciseDefinition } from "@/lib/exercise/registry";
import { formatStepTarget } from "@/lib/fitness/workout-templates";
import {
  cancelWorkout,
  completeWorkout,
  getWorkoutSession,
  recordWorkoutSet,
} from "@/lib/fitness/workout.functions";
import { runQueryFn } from "@/lib/safe-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fitness/play/$workoutId")({
  component: WorkoutPlayerPage,
  ssr: false,
});

type Phase = "ready" | "camera" | "rest" | "summary";

function WorkoutPlayerPage() {
  const { workoutId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getWorkoutSession);
  const recordFn = useServerFn(recordWorkoutSet);
  const completeFn = useServerFn(completeWorkout);
  const cancelFn = useServerFn(cancelWorkout);

  const [phase, setPhase] = useState<Phase>("ready");
  const [restLeftMs, setRestLeftMs] = useState(0);
  const [setStartedAt, setSetStartedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    xpGanho: number;
    progressLen: number;
  } | null>(null);

  const sessionQ = useQuery({
    queryKey: ["workout-session", workoutId] as const,
    queryFn: () =>
      runQueryFn(
        () => getFn({ data: { workoutId } }),
        "Falha ao carregar treino.",
      ),
  });

  const data = sessionQ.data;
  const template = data?.template;
  const cursor = data?.cursor ?? null;
  const currentStep =
    cursor && template ? template.steps[cursor.stepIndex] : null;
  const currentDef = currentStep
    ? getExerciseDefinition(currentStep.exerciseSlug)
    : null;

  const totalSets = useMemo(
    () => template?.steps.reduce((n, s) => n + s.sets, 0) ?? 0,
    [template],
  );
  const doneSets = data?.progress.length ?? 0;

  useEffect(() => {
    if (phase !== "rest" || restLeftMs <= 0) return;
    const id = window.setInterval(() => {
      setRestLeftMs((ms) => {
        if (ms <= 1000) {
          window.clearInterval(id);
          setPhase("ready");
          return 0;
        }
        return ms - 1000;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, restLeftMs]);

  useEffect(() => {
    if (!data) return;
    if (data.session.status === "completed" && !summary) {
      setSummary({
        xpGanho: data.session.xp_ganho,
        progressLen: data.progress.length,
      });
      setPhase("summary");
    }
  }, [data, summary]);

  const recordM = useMutation({
    mutationFn: (metrics: {
      reps_validas: number;
      reps_invalidas: number;
      forma_pct: number;
      amplitude_media: number;
    }) => {
      if (!cursor || !setStartedAt) throw new Error("Série inativa.");
      return recordFn({
        data: {
          workoutId,
          metrics: {
            stepIndex: cursor.stepIndex,
            setIndex: cursor.setIndex,
            reps_validas: metrics.reps_validas,
            reps_invalidas: metrics.reps_invalidas,
            forma_pct: metrics.forma_pct,
            amplitude_media: metrics.amplitude_media,
            duracao_ms: Math.max(1000, Date.now() - setStartedAt),
          },
        },
      });
    },
    onSuccess: async (res) => {
      setSetStartedAt(null);
      await qc.setQueryData(["workout-session", workoutId], res);

      if (res.complete) {
        try {
          const done = await completeFn({ data: { workoutId } });
          setSummary({
            xpGanho: done.xpGanho,
            progressLen: done.progress.length,
          });
          setPhase("summary");
          showXpGainPopup({
            xp: done.xpGanho,
            detail: `${done.progress.length} séries · ${done.template.titulo}`,
          });
          void qc.invalidateQueries({ queryKey: ["journey"] });
          void qc.invalidateQueries({ queryKey: ["fitness-hub"] });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao finalizar.");
          setPhase("ready");
        }
        return;
      }

      if (res.restMs > 0) {
        setRestLeftMs(res.restMs);
        setPhase("rest");
      } else {
        setPhase("ready");
      }
    },
    onError: (e) => {
      setPhase("ready");
      toast.error(e.message);
    },
  });

  const cancelM = useMutation({
    mutationFn: () => cancelFn({ data: { workoutId } }),
    onSuccess: () => {
      toast.message("Treino cancelado.");
      void navigate({ to: "/fitness" });
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = recordM.isPending || cancelM.isPending;
  const targetLabel = currentStep
    ? currentStep.targetHoldSec != null
      ? `Alvo ${currentStep.targetHoldSec}s`
      : `Alvo ${currentStep.targetReps ?? 10} reps`
    : "";

  if (sessionQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando treino…</div>;
  }
  if (sessionQ.error || !data || !template) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">
          {sessionQ.error instanceof Error
            ? sessionQ.error.message
            : "Treino indisponível."}
        </p>
        <Link to="/fitness">
          <Button variant="outline">Voltar ao Fitness</Button>
        </Link>
      </div>
    );
  }

  if (phase === "summary" && summary) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center bg-hero/20 text-hero">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold">Treino concluído</h1>
          <p className="text-sm text-muted-foreground">{template.titulo}</p>
          <p className="font-display text-3xl text-hero">+{summary.xpGanho} XP</p>
          <p className="text-xs text-muted-foreground">
            {summary.progressLen} séries registradas
          </p>
        </div>
        <ul className="space-y-1 text-sm">
          {data.progress.map((p) => {
            const def = getExerciseDefinition(p.exerciseSlug);
            const unit = def?.mode === "hold" ? "s" : "reps";
            return (
              <li
                key={`${p.stepIndex}-${p.setIndex}`}
                className="flex justify-between gap-2 border-b border-border/40 py-2"
              >
                <span>
                  {def?.nome ?? p.exerciseSlug} · série {p.setIndex + 1}
                </span>
                <span className="text-muted-foreground">
                  {p.reps_validas}
                  {unit} · {Math.round(p.forma_pct)}%
                </span>
              </li>
            );
          })}
        </ul>
        <Link to="/fitness" className="block">
          <Button className="w-full">Voltar ao hub</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Cancelar"
          className="mt-1"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Cancelar este treino? XP não será creditado.")) {
              cancelM.mutate();
            }
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">
            Em andamento
          </p>
          <h1 className="font-display text-xl font-bold">{template.titulo}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {doneSets}/{totalSets} séries
          </p>
          <div className="mt-2 h-1.5 overflow-hidden bg-muted">
            <div
              className="h-full bg-hero transition-[width]"
              style={{
                width: `${totalSets ? Math.round((doneSets / totalSets) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <Link to="/fitness" className="mt-1">
          <Button size="icon" variant="ghost" aria-label="Hub">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {phase === "rest" ? (
        <div className="cp-panel space-y-4 border border-transparent bg-hero-glow/40 p-6 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">
            Descanso
          </p>
          <p className="font-display text-5xl font-bold tabular-nums">
            {Math.ceil(restLeftMs / 1000)}
          </p>
          <p className="text-sm text-muted-foreground">
            Próximo: {currentDef?.nome ?? "—"} · série{" "}
            {cursor ? cursor.setIndex + 1 : "—"}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setRestLeftMs(0);
              setPhase("ready");
            }}
          >
            <SkipForward className="h-4 w-4" />
            Pular descanso
          </Button>
        </div>
      ) : (
        <div className="cp-panel space-y-4 border border-transparent bg-card p-5">
          {currentStep && currentDef && cursor ? (
            <>
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Step {cursor.stepIndex + 1}/{template.steps.length} · série{" "}
                  {cursor.setIndex + 1}/{currentStep.sets}
                </p>
                <h2 className="font-display text-2xl font-bold">{currentDef.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {targetLabel} · planejado {formatStepTarget(currentStep)}
                </p>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={busy}
                onClick={() => {
                  setSetStartedAt(Date.now());
                  setPhase("camera");
                }}
              >
                Abrir câmera
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Preparando próxima série…</p>
          )}
        </div>
      )}

      <ol className="space-y-1.5 text-sm">
        {template.steps.map((step, si) => {
          const def = getExerciseDefinition(step.exerciseSlug);
          const stepDone = data.progress.filter((p) => p.stepIndex === si).length;
          const active = cursor?.stepIndex === si;
          return (
            <li
              key={`${step.exerciseSlug}-${si}`}
              className={cn(
                "flex justify-between gap-2 px-1 py-1",
                active && "text-hero",
                stepDone >= step.sets && "text-muted-foreground line-through",
              )}
            >
              <span>{def?.nome ?? step.exerciseSlug}</span>
              <span>
                {stepDone}/{step.sets}
              </span>
            </li>
          );
        })}
      </ol>

      {currentDef && currentStep && (
        <ExerciseSessionCameraModal
          open={phase === "camera"}
          slug={currentStep.exerciseSlug}
          exerciseName={currentDef.nome}
          busy={recordM.isPending}
          onCloseRequest={() => {
            if (!busy) setPhase("ready");
          }}
          onComplete={(metrics) => recordM.mutate(metrics)}
          onCancel={() => {
            setSetStartedAt(null);
            setPhase("ready");
          }}
        />
      )}
    </div>
  );
}
