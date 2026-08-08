/**
 * Charlie Call / Despertador — client Capacitor (web-safe).
 */
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNativePlatform } from "@/lib/platform";

export type CharlieCallMode = "alarm" | "urgency";

export type CharlieCallPresentOptions = {
  mode?: CharlieCallMode;
  callerName?: string;
  reason?: string;
  callId?: string;
  audioKey?: string;
};

export type CharlieScheduleOptions = {
  triggerAtMs: number;
  requestCode?: number;
  callerName?: string;
  reason?: string;
  callId?: string;
  audioKey?: string;
};

export type CharlieCallEvent = {
  callId: string;
  mode: string;
  audioKey?: string;
};

type CharlieCallPlugin = {
  present(options: CharlieCallPresentOptions): Promise<{ callId: string; presented: boolean }>;
  scheduleAlarm(
    options: CharlieScheduleOptions,
  ): Promise<{ scheduled: boolean; triggerAtMs?: number; needsExactAlarmPermission?: boolean }>;
  cancelAlarm(options?: { requestCode?: number }): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
  canScheduleExact(): Promise<{ allowed: boolean }>;
  persistBootSchedule(options: {
    enabled: boolean;
    triggerAtMs: number;
    callerName?: string;
    reason?: string;
    callId?: string;
    audioKey?: string;
  }): Promise<void>;
  addListener(
    eventName: "callAnswered" | "callDeclined" | "callMissed",
    listenerFunc: (event: CharlieCallEvent) => void,
  ): Promise<PluginListenerHandle>;
};

const CharlieCallNative = registerPlugin<CharlieCallPlugin>("CharlieCall");

export function isCharlieCallAvailable(): boolean {
  return isNativePlatform();
}

export async function presentCharlieCall(opts: CharlieCallPresentOptions = {}) {
  if (!isNativePlatform()) {
    throw new Error("Charlie Call só funciona no app nativo.");
  }
  return CharlieCallNative.present({
    mode: opts.mode ?? "alarm",
    callerName: opts.callerName ?? "Charlie",
    reason: opts.reason ?? "Hora de subir",
    callId: opts.callId ?? `sim-${Date.now()}`,
    audioKey: normalizeRingtoneKey(opts.audioKey),
  });
}

export async function scheduleCharlieAlarm(opts: CharlieScheduleOptions) {
  if (!isNativePlatform()) return { scheduled: false as const };
  return CharlieCallNative.scheduleAlarm({
    requestCode: 77001,
    callerName: "Charlie",
    reason: "Hora de subir",
    ...opts,
    audioKey: normalizeRingtoneKey(opts.audioKey),
  });
}

export async function cancelCharlieAlarm(requestCode = 77001) {
  if (!isNativePlatform()) return;
  await CharlieCallNative.cancelAlarm({ requestCode });
}

export async function persistCharlieBootSchedule(
  opts: Parameters<CharlieCallPlugin["persistBootSchedule"]>[0],
) {
  if (!isNativePlatform()) return;
  await CharlieCallNative.persistBootSchedule({
    ...opts,
    audioKey: normalizeRingtoneKey(opts.audioKey),
  });
}

export async function canScheduleCharlieExact() {
  if (!isNativePlatform()) return { allowed: false };
  return CharlieCallNative.canScheduleExact();
}

export async function openCharlieExactAlarmSettings() {
  if (!isNativePlatform()) return;
  await CharlieCallNative.openExactAlarmSettings();
}

export async function attachCharlieCallListeners(handlers: {
  onAnswered?: (e: CharlieCallEvent) => void;
  onDeclined?: (e: CharlieCallEvent) => void;
}): Promise<() => void> {
  if (!isNativePlatform()) return () => undefined;
  const handles: PluginListenerHandle[] = [];
  if (handlers.onAnswered) {
    handles.push(await CharlieCallNative.addListener("callAnswered", handlers.onAnswered));
  }
  if (handlers.onDeclined) {
    handles.push(await CharlieCallNative.addListener("callDeclined", handlers.onDeclined));
  }
  return () => {
    for (const h of handles) void h.remove();
  };
}

/** Próximo disparo a partir de time_local (HH:MM) + dias ISO-ish 0=dom..6=sáb. */
export function nextAlarmTriggerMs(opts: {
  timeLocal: string;
  daysOfWeek: number[];
  timezone?: string;
  fromMs?: number;
}): number {
  const [hh, mm] = opts.timeLocal.split(":").map((x) => Number(x));
  const hour = Number.isFinite(hh) ? hh : 6;
  const minute = Number.isFinite(mm) ? mm : 30;
  const days = opts.daysOfWeek?.length ? opts.daysOfWeek : [1, 2, 3, 4, 5];
  const from = opts.fromMs ?? Date.now();

  // Usa timezone do device para MVP (prefs.timezone documentado; sync fino depois)
  for (let add = 0; add <= 8; add++) {
    const d = new Date(from + add * 86_400_000);
    const day = d.getDay(); // 0=dom
    if (!days.includes(day)) continue;
    const candidate = new Date(d);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() > from + 15_000) return candidate.getTime();
  }
  // fallback: amanhã no horário
  const fb = new Date(from + 86_400_000);
  fb.setHours(hour, minute, 0, 0);
  return fb.getTime();
}

export const CHARLIE_RINGTONES = [
  { key: "classic", label: "Clássico", file: "classic.wav" },
  { key: "warrior", label: "Guerreiro", file: "warrior.wav" },
  { key: "calm", label: "Calmo", file: "calm.wav" },
] as const;

export type CharlieRingtoneKey = (typeof CHARLIE_RINGTONES)[number]["key"];

/** Pasta canônica dos toques (APK: android assets; web preview: public). */
export const CHARLIE_RINGTONES_DIR = "audio/charlie-ringtones";

export function normalizeRingtoneKey(key: string | null | undefined): CharlieRingtoneKey {
  if (key === "warrior" || key === "calm" || key === "classic") return key;
  if (key === "classico") return "classic";
  return "classic";
}
