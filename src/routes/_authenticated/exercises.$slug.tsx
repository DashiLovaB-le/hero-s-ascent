import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronsUp, Play } from "lucide-react";
import { toast } from "sonner";

import {
  cancelExerciseSession,
  completeExerciseSession,
  ensureValidatedExerciseHabit,
  listRecentExerciseSessions,
  startExerciseSession,
} from "@/lib/exercise.functions";
import { EXERCISE_CONSENT_VERSION, PUSHUP_SLUG } from "@/lib/exercise-xp";
import { showXpGainPopup } from "@/components/XpGainPopup";
import { ExerciseSessionCameraModal } from "@/components/ExerciseSessionCameraModal";
import { Button } from "@/components/ui/button";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/_authenticated/exercises/$slug")({
  component: ExerciseSessionPage,
});

function ExerciseSessionPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const ensureFn = useServerFn(ensureValidatedExerciseHabit);
  const startFn = useServerFn(startExerciseSession);
  const completeFn = useServerFn(completeExerciseSession);
  const cancelFn = useServerFn(cancelExerciseSession);
  const listFn = useServerFn(listRecentExerciseSessions);

  const [consent, setConsent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const pageQuery = useQuery({
    queryKey: ["exercise-page", slug] as const,
    queryFn: () =>
      runQueryFn(
        async () => {
          const ensured = await ensureFn({ data: { slug } });
          const recent = await listFn({ data: { slug, limit: 5 } });
          return { ...ensured, recent };
        },
        "Falha ao carregar exercício.",
      ),
  });

  const resetSessionLocal = () => {
    setSessionId(null);
    setStartedAt(null);
    setCameraOpen(false);
  };

  const startM = useMutation({
    mutationFn: () =>
      startFn({
        data: {
          slug,
          clientMeta: {
            camera_preview: true,
            consent_version: EXERCISE_CONSENT_VERSION,
            ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        },
      }),
    onSuccess: (res) => {
      setSessionId(res.session.id);
      setStartedAt(Date.now());
      setCameraOpen(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const completeM = useMutation({
    mutationFn: (metrics: {
      reps_validas: number;
      reps_invalidas: number;
      forma_pct: number;
      amplitude_media: number;
    }) => {
      if (!sessionId || !startedAt) throw new Error("Sessão inativa.");
      return completeFn({
        data: {
          sessionId,
          metrics: {
            reps_validas: metrics.reps_validas,
            reps_invalidas: metrics.reps_invalidas,
            duracao_ms: Math.max(1000, Date.now() - startedAt),
            amplitude_media: metrics.amplitude_media,
            forma_pct: metrics.forma_pct,
            cadencia_rpm: null,
            fatigue_rep_index: null,
          },
        },
      });
    },
    onSuccess: (res, metrics) => {
      resetSessionLocal();
      showXpGainPopup({
        xp: res.xpGanho,
        detail: `${res.metrics?.reps_validas ?? metrics.reps_validas} reps · forma ${res.metrics?.forma_pct ?? metrics.forma_pct}%`,
      });
      void qc.invalidateQueries({ queryKey: ["exercise-page", slug] });
      void qc.invalidateQueries({ queryKey: ["journey"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelM = useMutation({
    mutationFn: async () => {
      if (!sessionId) return;
      await cancelFn({ data: { sessionId } });
    },
    onSuccess: () => {
      resetSessionLocal();
      toast.message("Sessão cancelada.");
      void qc.invalidateQueries({ queryKey: ["exercise-page", slug] });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    setConsent(false);
    resetSessionLocal();
  }, [slug]);

  if (pageQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando exercício…</div>;
  }
  if (pageQuery.error || !pageQuery.data) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">
          {pageQuery.error instanceof Error ? pageQuery.error.message : "Exercício indisponível."}
        </p>
        <Link to="/habits">
          <Button variant="outline">Voltar aos hábitos</Button>
        </Link>
      </div>
    );
  }

  const { exerciseType, recent } = pageQuery.data;
  const isPushup = slug === PUSHUP_SLUG || exerciseType.slug === PUSHUP_SLUG;
  const busy = completeM.isPending || cancelM.isPending || startM.isPending;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start gap-3">
        <Link to="/habits" className="mt-1">
          <Button size="icon" variant="ghost" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">Exercício validado</p>
          <h1 className="font-display text-2xl font-bold">{exerciseType.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {exerciseType.descricao ??
              "A câmera acompanha a execução sem gravar vídeo. XP híbrido: base + reps × forma."}
          </p>
        </div>
      </div>

      <div className="cp-modal cp-brackets border border-transparent bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center bg-hero/15 text-hero">
            <ChevronsUp className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p>
              XP: base <strong>{exerciseType.xp_base}</strong> +{" "}
              <strong>{exerciseType.xp_por_rep_valida}</strong>/rep válida · teto{" "}
              <strong>{exerciseType.xp_sessao_max}</strong>/sessão · máx.{" "}
              <strong>{exerciseType.sessoes_por_dia_max}</strong>/dia
            </p>
            <p className="text-xs text-muted-foreground">
              Estimativa de execução — não é avaliação médica. Nada de vídeo é salvo.
            </p>
            {isPushup ? (
              <label className="flex items-start gap-2 text-xs leading-snug">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={cameraOpen}
                />
                <span>
                  Autorizo o uso da câmera neste dispositivo só para acompanhar a sessão em tempo
                  real (consentimento {EXERCISE_CONSENT_VERSION}).
                </span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <Button
            className="shadow-hero"
            disabled={!consent || busy || cameraOpen}
            onClick={() => startM.mutate()}
          >
            <Play className="h-4 w-4" /> Iniciar sessão
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          Sessões recentes
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão ainda.</p>
        ) : (
          recent.map((s) => (
            <div
              key={s.id}
              className="cp-panel flex items-center justify-between gap-3 border border-transparent bg-card/80 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium capitalize">{s.status}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.started_at).toLocaleString("pt-BR")}
                  {s.metrics
                    ? ` · ${s.metrics.reps_validas} reps · forma ${s.metrics.forma_pct ?? "—"}%`
                    : ""}
                </p>
              </div>
              <p className="text-hero">+{s.xp_ganho} XP</p>
            </div>
          ))
        )}
      </section>

      <ExerciseSessionCameraModal
        open={cameraOpen && Boolean(sessionId)}
        exerciseName={exerciseType.nome}
        busy={busy}
        onCloseRequest={() => {
          if (!busy) cancelM.mutate();
        }}
        onComplete={(metrics) => completeM.mutate(metrics)}
        onCancel={() => cancelM.mutate()}
      />
    </div>
  );
}
