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

export function getVapidPublicKey(): string | undefined {
  return (
    process.env.VITE_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    undefined
  );
}

export function getVapidPrivateKey(): string | undefined {
  return process.env.VAPID_PRIVATE_KEY?.trim() || undefined;
}

export function getVapidSubject(): string {
  const url = process.env.APP_PUBLIC_URL?.trim();
  if (url?.startsWith("http")) return `mailto:admin@${new URL(url).hostname}`;
  return "mailto:admin@v-project.app";
}
