import { useEffect, useEffectEvent, useRef, useState } from "react";

type AuthDoorOverlayProps = {
  active: boolean;
  onComplete: () => void;
};

type Phase = "idle" | "arming" | "opening" | "revealed";

const REDUCED_MOTION_MS = 120;
const ARM_MS = 420;
const OPEN_MS = 1100;
const HOLD_MS = 180;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Overlay fullscreen: porta cyberpunk abre L/R após login.
 * Arte: /porta-login.png — costura vertical central.
 */
export function AuthDoorOverlay({ active, onComplete }: AuthDoorOverlayProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(false);
  const completed = useRef(false);
  const timers = useRef<number[]>([]);
  const onCompleteEvent = useEffectEvent(onComplete);

  function clearTimers() {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }

  useEffect(() => {
    if (!active) {
      clearTimers();
      completed.current = false;
      setPhase("idle");
      setVisible(false);
      return;
    }

    completed.current = false;
    setVisible(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function finish() {
      if (completed.current) return;
      completed.current = true;
      document.body.style.overflow = prevOverflow;
      onCompleteEvent();
    }

    if (prefersReducedMotion()) {
      setPhase("revealed");
      const id = window.setTimeout(finish, REDUCED_MOTION_MS);
      timers.current.push(id);
      return () => {
        clearTimers();
        document.body.style.overflow = prevOverflow;
      };
    }

    setPhase("arming");
    const t1 = window.setTimeout(() => setPhase("opening"), ARM_MS);
    const t2 = window.setTimeout(() => setPhase("revealed"), ARM_MS + OPEN_MS);
    const t3 = window.setTimeout(finish, ARM_MS + OPEN_MS + HOLD_MS);
    timers.current.push(t1, t2, t3);
    return () => {
      clearTimers();
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);

  if (!visible) return null;

  const isOpening = phase === "opening" || phase === "revealed";
  const status =
    phase === "arming"
      ? "DESBLOQUEANDO PROTOCOLO…"
      : phase === "opening"
        ? "ACESSO CONCEDIDO"
        : phase === "revealed"
          ? "ENTRANDO NA JORNADA"
          : "AGUARDE";

  return (
    <div
      className={`auth-door ${isOpening ? "auth-door--open" : ""} ${phase === "arming" ? "auth-door--arming" : ""}`}
      role="presentation"
      aria-hidden
    >
      <div className="auth-door__void" />
      <div className="auth-door__bloom" />

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
    </div>
  );
}
