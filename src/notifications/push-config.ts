import type { Json } from "@/integrations/supabase/types";
import type { NotificationTipo } from "@/notifications/create";

/** Tipos que podem ir por Web Push (espelha Telegram + conquistas). */
export const PUSH_NOTIFY_TIPOS = new Set<string>([
  "mentor_challenge",
  "mentor_challenge_done",
  "mentor_challenge_expired",
  "habit_reminder",
  "streak_risk",
  "agent_initiative",
  "achievement",
  "system",
]);

export type NotificationSettingsRow = {
  user_id: string;
  push_enabled: boolean;
  notify_habit_reminder: boolean;
  notify_streak_risk: boolean;
  notify_mentor: boolean;
  notify_achievement: boolean;
  notify_agent: boolean;
};

/** Remove aspas/whitespace que o painel da Vercel às vezes inclui. */
export function sanitizeVapidKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");
  return cleaned || undefined;
}

export function decodeVapidPublicKey(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function analyzeVapidPublicKey(raw: string | undefined | null): {
  configured: boolean;
  valid: boolean;
  keyLength: number;
  byteLength: number;
  publicKey: string | null;
} {
  const key = sanitizeVapidKey(raw) ?? null;
  if (!key) {
    return { configured: false, valid: false, keyLength: 0, byteLength: 0, publicKey: null };
  }
  try {
    const bytes = decodeVapidPublicKey(key);
    const valid = bytes.length === 65 && bytes[0] === 0x04;
    return {
      configured: true,
      valid,
      keyLength: key.length,
      byteLength: bytes.length,
      publicKey: valid ? key : null,
    };
  } catch {
    return {
      configured: true,
      valid: false,
      keyLength: key.length,
      byteLength: -1,
      publicKey: null,
    };
  }
}

export function tipoAllowedBySettings(
  tipo: string,
  settings: Pick<
    NotificationSettingsRow,
    | "notify_habit_reminder"
    | "notify_streak_risk"
    | "notify_mentor"
    | "notify_achievement"
    | "notify_agent"
  >,
): boolean {
  switch (tipo as NotificationTipo) {
    case "habit_reminder":
      return settings.notify_habit_reminder;
    case "streak_risk":
      return settings.notify_streak_risk;
    case "mentor_challenge":
    case "mentor_challenge_done":
    case "mentor_challenge_expired":
    case "mentor_presence":
      return settings.notify_mentor;
    case "achievement":
      return settings.notify_achievement;
    case "agent_initiative":
      return settings.notify_agent;
    case "system":
    case "habit_complete":
      return true;
    default:
      return true;
  }
}

export function buildPushPayload(input: {
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  const href =
    input.metadata && typeof input.metadata.href === "string"
      ? input.metadata.href
      : "/journey";
  return {
    title: input.titulo,
    body: (input.corpo ?? "").trim() || "Abra o V-Project",
    href,
  };
}

function readEnv(name: string): string | undefined {
  // Server (Node / Nitro) — runtime Vercel
  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name];
  }
  return undefined;
}

export function getVapidPublicKey(): string | undefined {
  // Preferir chave sem prefixo VITE_ no server (runtime). VITE_ também funciona se injetada.
  const analyzed = analyzeVapidPublicKey(
    readEnv("VAPID_PUBLIC_KEY") || readEnv("VITE_VAPID_PUBLIC_KEY"),
  );
  return analyzed.publicKey ?? undefined;
}

export function getVapidPrivateKey(): string | undefined {
  return sanitizeVapidKey(readEnv("VAPID_PRIVATE_KEY"));
}

export function getVapidSubject(): string {
  const url = readEnv("APP_PUBLIC_URL")?.trim();
  if (url?.startsWith("http")) {
    try {
      return `mailto:admin@${new URL(url).hostname}`;
    } catch {
      /* fallthrough */
    }
  }
  return "mailto:admin@v-project.app";
}
