import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  journeyQueryOptions,
  missionsQueryOptions,
} from "@/lib/journey-queries";

type AuthDoorOverlayProps = {
  active: boolean;
  onComplete: () => void;
};

type Phase = "idle" | "arming" | "opening" | "loading" | "exiting";

const ARM_MS = 420;
const OPEN_MS = 1100;
const LOADER_IN_MS = 160;
const LOADER_OUT_MS = 180;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Overlay fullscreen: porta cyberpunk abre L/R após login,
 * depois barra de progresso real (prefetch da jornada) em fundo preto.
 */
export function AuthDoorOverlay({ active, onComplete }: AuthDoorOverlayProps) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loaderShown, setLoaderShown] = useState(false);
  const completed = useRef(false);
  const timers = useRef<number[]>([]);
  const onCompleteEvent = useEffectEvent(onComplete);

  function clearTimers() {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }

  function schedule(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }

  async function prefetchApp(onProgress: (pct: number) => void) {
    const tasks = [
      () => qc.ensureQueryData(journeyQueryOptions()),
      () => qc.ensureQueryData(missionsQueryOptions()),
    ];
    let done = 0;
    onProgress(0);
    await Promise.all(
      tasks.map(async (run) => {
        try {
          await run();
        } catch {
          // Onboarding incompleto / rede — ainda seguimos; o beforeLoad redireciona.
        } finally {
          done += 1;
          onProgress(Math.round((done / tasks.length) * 100));
        }
      }),
    );
  }

  useEffect(() => {
    if (!active) {
      clearTimers();
      completed.current = false;
      setPhase("idle");
      setVisible(false);
      setProgress(0);
      setLoaderShown(false);
      return;
    }

    let cancelled = false;
    completed.current = false;
    setVisible(true);
    setProgress(0);
    setLoaderShown(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function finish() {
      if (completed.current || cancelled) return;
      completed.current = true;
      document.body.style.overflow = prevOverflow;
      onCompleteEvent();
    }

    async function runLoadingSequence() {
      if (cancelled) return;
      setPhase("loading");
      // Surgimento rápido da barra
      schedule(() => {
        if (!cancelled) setLoaderShown(true);
      }, 16);

      await new Promise<void>((r) => schedule(r, LOADER_IN_MS));
      if (cancelled) return;

      await prefetchApp((pct) => {
        if (!cancelled) setProgress(pct);
      });
      if (cancelled) return;

      setProgress(100);
      // Desaparecimento rápido
      setPhase("exiting");
      setLoaderShown(false);
      schedule(finish, LOADER_OUT_MS);
    }

    if (prefersReducedMotion()) {
      void runLoadingSequence();
      return () => {
        cancelled = true;
        clearTimers();
        document.body.style.overflow = prevOverflow;
      };
    }

    setPhase("arming");
    schedule(() => {
      if (!cancelled) setPhase("opening");
    }, ARM_MS);
    schedule(() => {
      if (!cancelled) void runLoadingSequence();
    }, ARM_MS + OPEN_MS);

    return () => {
      cancelled = true;
      clearTimers();
      document.body.style.overflow = prevOverflow;
    };
  }, [active, qc]);

  if (!visible) return null;

  const isOpening = phase === "opening" || phase === "loading" || phase === "exiting";
  const showLoader = phase === "loading" || phase === "exiting";
  const status =
    phase === "arming"
      ? "DESBLOQUEANDO PROTOCOLO…"
      : phase === "opening"
        ? "ACESSO CONCEDIDO"
        : showLoader
          ? `CARREGANDO ${progress}%`
          : "AGUARDE";

  return (
    <div
      className={`auth-door ${isOpening ? "auth-door--open" : ""} ${phase === "arming" ? "auth-door--arming" : ""} ${showLoader ? "auth-door--loading" : ""}`}
      role="presentation"
      aria-hidden={!showLoader}
      aria-busy={phase === "loading"}
    >
      <div className="auth-door__void" />

      {!showLoader && (
        <>
          <div className="auth-door__panel auth-door__panel--left">
            <div className="auth-door__face" />
            <div className="auth-door__seam auth-door__seam--left" />
          </div>
          <div className="auth-door__panel auth-door__panel--right">
            <div className="auth-door__face" />
            <div className="auth-door__seam auth-door__seam--right" />
          </div>

          <div className="auth-door__hud">
            <p className="auth-door__brand">V-PROJECT</p>
            <p className="auth-door__status">{status}</p>
            <div className="auth-door__bar" aria-hidden>
              <span />
            </div>
          </div>
        </>
      )}

      {showLoader && (
        <div
          className={`auth-door__boot ${loaderShown ? "auth-door__boot--in" : "auth-door__boot--out"}`}
        >
          <p className="auth-door__boot-label">V-PROJECT</p>
          <div
            className="auth-door__boot-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Carregando aplicação"
          >
            <div
              className="auth-door__boot-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="auth-door__boot-pct">{progress}%</p>
        </div>
      )}
    </div>
  );
}
