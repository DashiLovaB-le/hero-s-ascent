import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maybeSendTelegramNotification } from "@/notifications/telegram";

export const NOTIFICATION_TIPOS = [
  "mentor_challenge",
  "mentor_challenge_done",
  "mentor_challenge_expired",
  "habit_complete",
  "habit_reminder",
  "streak_risk",
  "mentor_presence",
  "achievement",
  "system",
  "agent_initiative",
] as const;

export type NotificationTipo = (typeof NOTIFICATION_TIPOS)[number];

/** Cria notificação (service role — bypass RLS de INSERT). */
export async function createNotification(input: {
  userId: string;
  tipo: NotificationTipo;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: input.userId,
    tipo: input.tipo,
    titulo: input.titulo,
    corpo: input.corpo ?? "",
    metadata: (input.metadata ?? {}) as Json,
  });
  if (error) {
    console.error("[notifications] create", error.message);
    return { ok: false as const, error: error.message };
  }

  await maybeSendTelegramNotification({
    userId: input.userId,
    tipo: input.tipo,
    titulo: input.titulo,
    corpo: input.corpo,
    metadata: input.metadata,
  });

  return { ok: true as const };
}
