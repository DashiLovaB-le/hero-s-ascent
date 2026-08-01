import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronsUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type XpGainPopupPayload = {
  xp: number;
  detail?: string | null;
};

type Snapshot = {
  id: number;
  payload: XpGainPopupPayload;
} | null;

let snapshot: Snapshot = null;
let nextId = 1;
const listeners = new Set<() => void>();
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

/** Mostra o pop-up cyberpunk de ganho de XP (substitui toast de hábito concluído). */
export function showXpGainPopup(payload: XpGainPopupPayload) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  snapshot = { id: nextId++, payload };
  emit();
  hideTimer = setTimeout(() => {
    snapshot = null;
    hideTimer = null;
    emit();
  }, 2600);
}

export function dismissXpGainPopup() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (!snapshot) return;
  snapshot = null;
  emit();
}

export function XpGainPopupHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [current?.id]);

  if (!current) return null;

  const xp = Math.max(0, Math.round(current.payload.xp));
  const detail = current.payload.detail?.trim() || null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          "pointer-events-auto cp-xp-popup flex w-[min(15.5rem,72vw)] flex-col items-center justify-center gap-3 bg-card px-5 py-7 text-center transition-all duration-300",
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0",
        )}
        onClick={dismissXpGainPopup}
      >
        <div className="grid h-12 w-12 place-items-center bg-hero/15 text-hero">
          <ChevronsUp className="h-7 w-7" strokeWidth={2.25} aria-hidden />
        </div>
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">Recompensa</p>
        <p className="font-display text-3xl font-semibold leading-none tracking-wide text-foreground">
          +{xp} <span className="text-xl text-hero">XP</span>
        </p>
        {detail ? (
          <p className="max-w-[12rem] text-xs leading-snug text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
