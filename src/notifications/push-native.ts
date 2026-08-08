import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PUSH_NOTIFY_TIPOS,
  buildPushPayload,
  tipoAllowedBySettings,
} from "@/notifications/push-config";

function readEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Legacy FCM server key (Console → Cloud Messaging). */
function getFcmServerKey(): string | undefined {
  return (
    readEnv("FCM_SERVER_KEY") ||
    readEnv("FIREBASE_SERVER_KEY") ||
    readEnv("FIREBASE_CLOUD_MESSAGING_SERVER_KEY")
  );
}

/**
 * Envia push nativo (FCM) para devices Capacitor do usuário.
 * Nunca lança. No-op se FCM_SERVER_KEY ausente ou sem tokens.
 */
export async function maybeSendNativePushNotification(input: {
  userId: string;
  tipo: string;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  if (!PUSH_NOTIFY_TIPOS.has(input.tipo)) return;

  const serverKey = getFcmServerKey();
  if (!serverKey) return;

  try {
    const { data: settings } = await supabaseAdmin
      .from("notification_settings")
      .select(
        "push_enabled, notify_habit_reminder, notify_streak_risk, notify_mentor, notify_achievement, notify_agent",
      )
      .eq("user_id", input.userId)
      .maybeSingle();

    if (!settings?.push_enabled) return;
    if (!tipoAllowedBySettings(input.tipo, settings)) return;

    const { data: devices, error } = await supabaseAdmin
      .from("push_devices")
      .select("id, token, platform")
      .eq("user_id", input.userId)
      .eq("enabled", true);

    if (error || !devices?.length) return;

    const payload = buildPushPayload(input);
    const href =
      input.metadata && typeof input.metadata.href === "string"
        ? input.metadata.href
        : "/journey";

    const staleIds: string[] = [];

    await Promise.all(
      devices.map(async (d) => {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              Authorization: `key=${serverKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: d.token,
              priority: "high",
              notification: {
                title: payload.title,
                body: payload.body,
                sound: "default",
              },
              data: {
                tipo: input.tipo,
                href,
                title: payload.title,
                body: payload.body,
              },
            }),
          });

          const body = (await res.json().catch(() => ({}))) as {
            success?: number;
            failure?: number;
            results?: Array<{ error?: string }>;
          };

          if (!res.ok) {
            console.error("[fcm] http", res.status, body);
            return;
          }

          const err = body.results?.[0]?.error;
          if (err === "NotRegistered" || err === "InvalidRegistration") {
            staleIds.push(d.id);
          } else if (body.failure && err) {
            console.error("[fcm] send", err);
          } else {
            await supabaseAdmin
              .from("push_devices")
              .update({ last_seen_at: new Date().toISOString() })
              .eq("id", d.id);
          }
        } catch (e) {
          console.error("[fcm] fetch", e);
        }
      }),
    );

    if (staleIds.length) {
      await supabaseAdmin.from("push_devices").delete().in("id", staleIds);
    }
  } catch (e) {
    console.error("[fcm] maybeSend", e);
  }
}
