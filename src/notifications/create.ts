import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maybeSendTelegramNotification } from "@/notifications/telegram";
import { maybeSendWebPushNotification } from "@/notifications/push";
import {
  intensityFromRisks,
  isCharlieVoiceTipo,
  voiceCharlieNotification,
} from "@/notifications/charlie-telegram-voice";

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

function metaNumber(meta: Record<string, Json | undefined> | undefined, key: string): number | null {
  const v = meta?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metaString(meta: Record<string, Json | undefined> | undefined, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Aplica voz do Charlie (personalidade do perfil) nos tipos de alerta. */
async function applyCharlieVoice(input: {
  userId: string;
  tipo: NotificationTipo;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}): Promise<{ titulo: string; corpo: string }> {
  if (!isCharlieVoiceTipo(input.tipo)) {
    return { titulo: input.titulo, corpo: input.corpo ?? "" };
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("nome, charlie_personality")
      .eq("id", input.userId)
      .maybeSingle();

    if (error) {
      console.warn("[notifications] voice profile", error.message);
      return { titulo: input.titulo, corpo: input.corpo ?? "" };
    }

    const voiced = voiceCharlieNotification({
      tipo: input.tipo,
      personalitySlug: profile?.charlie_personality ?? "classico",
      nome: profile?.nome ?? null,
      pending: metaNumber(input.metadata, "pending"),
      streak: metaNumber(input.metadata, "streak"),
      weekdayWeak: metaString(input.metadata, "weekday_weakest_label"),
      subject: (input.corpo ?? "").trim() || input.titulo,
      kind: metaString(input.metadata, "kind"),
      xp: metaNumber(input.metadata, "xp"),
      intensity: intensityFromRisks(
        metaNumber(input.metadata, "risco_streak"),
        metaNumber(input.metadata, "risco_abandono"),
      ),
      fallbackTitulo: input.titulo,
      fallbackCorpo: input.corpo,
    });

    return voiced;
  } catch (e) {
    console.warn("[notifications] voice failed", e);
    return { titulo: input.titulo, corpo: input.corpo ?? "" };
  }
}

/** Cria notificação (service role — bypass RLS de INSERT). */
export async function createNotification(input: {
  userId: string;
  tipo: NotificationTipo;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  const voiced = await applyCharlieVoice(input);

  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: input.userId,
    tipo: input.tipo,
    titulo: voiced.titulo,
    corpo: voiced.corpo,
    metadata: (input.metadata ?? {}) as Json,
  });
  if (error) {
    console.error("[notifications] create", error.message);
    return { ok: false as const, error: error.message };
  }

  await Promise.all([
    maybeSendTelegramNotification({
      userId: input.userId,
      tipo: input.tipo,
      titulo: voiced.titulo,
      corpo: voiced.corpo,
      metadata: input.metadata,
    }),
    maybeSendWebPushNotification({
      userId: input.userId,
      tipo: input.tipo,
      titulo: voiced.titulo,
      corpo: voiced.corpo,
      metadata: input.metadata,
    }),
  ]);

  return { ok: true as const };
}
