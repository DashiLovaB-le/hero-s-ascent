import { readFileSync } from "node:fs";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PUSH_NOTIFY_TIPOS,
  buildPushPayload,
  tipoAllowedBySettings,
} from "@/notifications/push-config";

type ServiceAccount = {
  project_id?: string;
  client_email: string;
  private_key: string;
};

function readEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function loadServiceAccount(): ServiceAccount | null {
  const rawJson = readEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as ServiceAccount;
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch (e) {
      console.error("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON inválido", e);
    }
  }

  const path =
    readEnv("FIREBASE_SERVICE_ACCOUNT_PATH") ||
    readEnv("GOOGLE_APPLICATION_CREDENTIALS");
  if (path) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as ServiceAccount;
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch (e) {
      console.error("[fcm] falha ao ler service account em", path, e);
    }
  }

  return null;
}

function getFirebaseProjectId(sa: ServiceAccount): string | null {
  return (
    readEnv("FIREBASE_PROJECT_ID") ||
    sa.project_id ||
    readEnv("GCLOUD_PROJECT") ||
    null
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getFcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    if (!token) return null;
    cachedToken = { value: token, expiresAt: now + 50 * 60_000 };
    return token;
  } catch (e) {
    console.error("[fcm] access token", e);
    return null;
  }
}

type FcmV1ErrorBody = {
  error?: {
    status?: string;
    message?: string;
    details?: Array<{ errorCode?: string }>;
  };
};

function isStaleTokenError(status: number, body: FcmV1ErrorBody): boolean {
  const code = body.error?.details?.find((d) => d.errorCode)?.errorCode;
  if (code === "UNREGISTERED") return true;
  if (status === 404 && body.error?.status === "NOT_FOUND") return true;
  const msg = (body.error?.message ?? "").toLowerCase();
  return msg.includes("requested entity was not found") || msg.includes("not a valid fcm");
}

/**
 * Envia push nativo via FCM HTTP v1 (service account).
 * No-op se credenciais ausentes ou sem tokens. Nunca lança.
 */
export async function maybeSendNativePushNotification(input: {
  userId: string;
  tipo: string;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  if (!PUSH_NOTIFY_TIPOS.has(input.tipo)) return;

  const sa = loadServiceAccount();
  if (!sa) return;
  const projectId = getFirebaseProjectId(sa);
  if (!projectId) {
    console.error("[fcm] FIREBASE_PROJECT_ID / project_id ausente");
    return;
  }

  const accessToken = await getFcmAccessToken(sa);
  if (!accessToken) return;

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
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    await Promise.all(
      devices.map(async (d) => {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: d.token,
                notification: {
                  title: payload.title,
                  body: payload.body,
                },
                data: {
                  tipo: input.tipo,
                  href,
                  title: payload.title,
                  body: payload.body,
                },
                android: {
                  priority: "HIGH",
                  notification: {
                    sound: "default",
                    channelId: "default",
                  },
                },
              },
            }),
          });

          const body = (await res.json().catch(() => ({}))) as FcmV1ErrorBody & {
            name?: string;
          };

          if (!res.ok) {
            if (isStaleTokenError(res.status, body)) {
              staleIds.push(d.id);
            } else {
              console.error("[fcm] http", res.status, body);
            }
            return;
          }

          await supabaseAdmin
            .from("push_devices")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", d.id);
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
