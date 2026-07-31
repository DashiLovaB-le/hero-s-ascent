import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PUSH_NOTIFY_TIPOS,
  buildPushPayload,
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  tipoAllowedBySettings,
} from "@/notifications/push-config";

type WebPushModule = typeof import("web-push");

let webPushPromise: Promise<WebPushModule | null> | undefined;

async function getWebPush(): Promise<WebPushModule | null> {
  if (!webPushPromise) {
    webPushPromise = import("web-push")
      .then((m) => {
        const mod = (m as { default?: WebPushModule }).default ?? (m as WebPushModule);
        return mod;
      })
      .catch((e) => {
        console.error("[web-push] import failed", e);
        return null;
      });
  }
  return webPushPromise;
}

/** Envia Web Push se opt-in + subscription. Nunca lança. */
export async function maybeSendWebPushNotification(input: {
  userId: string;
  tipo: string;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  if (!PUSH_NOTIFY_TIPOS.has(input.tipo)) return;

  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return;

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

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", input.userId);

    if (error || !subs?.length) return;

    const webpush = await getWebPush();
    if (!webpush) return;

    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);

    const payload = JSON.stringify(buildPushPayload(input));
    const staleIds: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 60 * 60 * 12 },
          );
        } catch (e: unknown) {
          const statusCode =
            e && typeof e === "object" && "statusCode" in e
              ? Number((e as { statusCode?: number }).statusCode)
              : undefined;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            console.error("[web-push] send", e);
          }
        }
      }),
    );

    if (staleIds.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds);
    }
  } catch (e) {
    console.error("[web-push] maybeSend", e);
  }
}
