import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Square, SwitchCamera, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useExerciseCamera } from "@/lib/useExerciseCamera";
import { usePushupPoseTracker } from "@/lib/exercise/usePushupPoseTracker";
import { isNativePlatform, requestSessionWakeLock } from "@/lib/platform";
import { cn } from "@/lib/utils";

export type ExerciseSessionCameraModalProps = {
  open: boolean;
  exerciseName: string;
  busy?: boolean;
  onCloseRequest: () => void;
  onComplete: (metrics: {
    reps_validas: number;
    reps_invalidas: number;
    forma_pct: number;
    amplitude_media: number;
  }) => void;
  onCancel: () => void;
};

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STAGE_LABEL: Record<string, string> = {
  framing: "Enquadramento",
  calibrating: "Calibração",
  tracking: "Contando",
};

export function ExerciseSessionCameraModal({
  open,
  exerciseName,
  busy,
  onCloseRequest,
  onComplete,
  onCancel,
}: ExerciseSessionCameraModalProps) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackingStartedAt = useRef<number | null>(null);

  const { videoRef, videoEl, state, error, start } = useExerciseCamera({
    enabled: open,
    facingMode,
  });

  const live = open && state === "live" && !error;

  // Sessão de flexão: manter tela acesa (mobile / nativo)
  useEffect(() => {
    if (!open) return;
    let release: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const r = await requestSessionWakeLock();
      if (cancelled) {
        r();
        return;
      }
      release = r;
    })();
    return () => {
      cancelled = true;
      release?.();
    };
  }, [open]);

  const { session, ready, poseError, recalibrate } = usePushupPoseTracker({
    enabled: live,
    video: videoEl,
    canvas: canvasEl,
    mirrored: facingMode === "user",
  });

  const counter = session.counter;
  const isTracking = session.stage === "tracking";

  useEffect(() => {
    if (!open) {
      setElapsedMs(0);
      trackingStartedAt.current = null;
      return;
    }
    if (isTracking && trackingStartedAt.current == null) {
      trackingStartedAt.current = Date.now();
    }
    if (!isTracking) {
      trackingStartedAt.current = null;
      setElapsedMs(0);
      return;
    }
    const id = window.setInterval(() => {
      const t0 = trackingStartedAt.current;
      if (t0) setElapsedMs(Date.now() - t0);
    }, 250);
    return () => window.clearInterval(id);
  }, [open, isTracking]);

  // Trocar câmera invalida o ângulo calibrado — recomeça o fluxo.
  const prevFacingRef = useRef(facingMode);
  useEffect(() => {
    if (prevFacingRef.current === facingMode) return;
    prevFacingRef.current = facingMode;
    if (open && ready) recalibrate();
  }, [facingMode, open, ready, recalibrate]);

  const setCanvasNode = (node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasEl(node);
  };

  const canFinish =
    !busy &&
    state === "live" &&
    !error &&
    isTracking &&
    (counter.repsValidas > 0 || counter.repsInvalidas > 0);

  const coachTone =
    session.flash === "valid"
      ? "text-emerald-300"
      : session.flash === "invalid" || counter.feedback === "align_body"
        ? "text-amber-200"
        : session.stage === "calibrating"
          ? "text-sky-200"
          : "text-white/95";

  const native = isNativePlatform();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCloseRequest();
      }}
    >
      <DialogContent
        data-native-exercise-session={native ? "" : undefined}
        className={cn(
          "flex h-[min(96dvh,920px)] w-[min(100vw-1rem,42rem)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden border-transparent bg-[#121212] p-0 sm:w-[min(100vw-2rem,48rem)]",
          native
            ? "top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-y-0 rounded-none sm:w-screen [&>button]:right-3 [&>button]:top-[max(0.85rem,calc(var(--safe-area-inset-top,env(safe-area-inset-top,0px))+0.4rem))] [&>button]:z-30 [&>button]:bg-black/50 [&>button]:p-1.5 [&>button]:text-white"
            : "[&>button]:right-3 [&>button]:top-3 [&>button]:z-30 [&>button]:bg-black/50 [&>button]:p-1.5 [&>button]:text-white",
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onCloseRequest();
        }}
      >
        <DialogTitle className="sr-only">Sessão de {exerciseName}</DialogTitle>

        <div className="relative min-h-0 flex-1 bg-black">
          <video
            ref={videoRef}
            className={cn(
              "h-full w-full object-cover",
              facingMode === "user" && "-scale-x-100",
            )}
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={setCanvasNode}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          />

          {(state === "starting" || state === "idle") && !error ? (
            <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white/80">
              Abrindo câmera…
            </div>
          ) : null}

          {live && !ready && !poseError ? (
            <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white/85">
              Carregando coaching de pose…
            </div>
          ) : null}

          {error || poseError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
              <Camera className="h-8 w-8 text-hero" />
              <p className="max-w-sm text-sm text-white/90">{error ?? poseError}</p>
              {error ? (
                <Button size="sm" variant="outline" onClick={() => void start()}>
                  Tentar de novo
                </Button>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-10",
              native
                ? "pt-[max(1.35rem,calc(var(--safe-area-inset-top,env(safe-area-inset-top,0px))+0.55rem))]"
                : "pt-4",
            )}
          >
            <div className="flex items-start justify-between gap-3 pr-10">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.24em] text-hero">
                  Ao vivo · on-device · sem gravar
                </p>
                <p className="font-display text-xl text-white">{exerciseName}</p>
              </div>
              <div className="rounded-md bg-black/50 px-2.5 py-1 text-right backdrop-blur-sm">
                <p className="text-[0.6rem] uppercase tracking-wider text-white/55">
                  {STAGE_LABEL[session.stage] ?? session.stage}
                </p>
                {isTracking ? (
                  <p className="font-mono text-sm text-white/85">{formatElapsed(elapsedMs)}</p>
                ) : session.stage === "calibrating" ? (
                  <p className="font-mono text-sm text-sky-200">
                    {Math.round(session.calibration.progress * 100)}%
                  </p>
                ) : (
                  <p className="text-xs text-white/60">Guia</p>
                )}
              </div>
            </div>
          </div>

          {ready && !error && !poseError ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center gap-2 px-4">
              {isTracking ? (
                <div className="flex items-end gap-6 rounded-lg bg-black/55 px-5 py-3 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="font-mono text-4xl font-semibold tabular-nums text-hero">
                      {counter.repsValidas}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-wider text-white/70">Válidas</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-2xl tabular-nums text-white/85">
                      {counter.repsInvalidas}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-wider text-white/55">
                      Inválidas
                    </p>
                  </div>
                </div>
              ) : null}

              <p
                className={cn(
                  "max-w-[90%] rounded-md bg-black/65 px-4 py-2 text-center text-base font-medium leading-snug backdrop-blur-sm",
                  coachTone,
                )}
              >
                {session.coachMessage}
              </p>

              {session.stage === "framing" ? (
                <p className="text-center text-xs text-white/55">
                  Celular estável · corpo inteiro na guia · braços estendidos
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
            {isTracking ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-black/55 text-white hover:bg-black/75"
                onClick={() => recalibrate()}
              >
                <RefreshCw className="h-4 w-4" />
                Recalibrar
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="bg-black/55 text-white hover:bg-black/75"
              onClick={() =>
                setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
              }
            >
              <SwitchCamera className="h-4 w-4" />
              {facingMode === "user" ? "Frontal" : "Traseira"}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 space-y-3 border-t border-white/10 bg-card px-4 py-3",
            native &&
              "pb-[max(0.85rem,calc(var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+0.35rem))]",
          )}
        >
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
            <div>
              <p className="font-mono text-lg text-foreground">
                {isTracking ? `${counter.amplitudeMedia}%` : "—"}
              </p>
              <p>Amplitude</p>
            </div>
            <div>
              <p className="font-mono text-lg text-foreground">
                {isTracking ? `${counter.formaPct}%` : "—"}
              </p>
              <p>Forma</p>
            </div>
            <div>
              <p className="font-mono text-lg text-foreground">
                {counter.elbowAngle != null ? `${Math.round(counter.elbowAngle)}°` : "—"}
              </p>
              <p>Cotovelo</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="shadow-hero"
              disabled={!canFinish}
              onClick={() =>
                onComplete({
                  reps_validas: counter.repsValidas,
                  reps_invalidas: counter.repsInvalidas,
                  forma_pct: counter.formaPct,
                  amplitude_media: counter.amplitudeMedia,
                })
              }
            >
              <Square className="h-4 w-4" /> Encerrar e ganhar XP
            </Button>
            <Button variant="outline" disabled={busy} onClick={onCancel}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </div>
          {!canFinish && state === "live" && !error ? (
            <p className="text-xs text-muted-foreground">
              {isTracking
                ? "Faça ao menos uma repetição para encerrar."
                : "Enquadre, calibre (~3s parado) e depois conte as reps."}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
