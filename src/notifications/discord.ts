import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppPublicUrl } from "@/notifications/discord-config";

export {
  getAppPublicUrl,
  getDiscordApplicationId,
  getDiscordBotProfileUrl,
  getDiscordBotUsername,
} from "@/notifications/discord-config";

/** Mesmos tipos espelhados no Telegram. */
export const DISCORD_NOTIFY_TIPOS = new Set([
  "mentor_challenge",
  "mentor_challenge_done",
  "mentor_challenge_expired",
  "habit_reminder",
  "streak_risk",
  "agent_initiative",
  "system",
  "identity_report",
]);

export function getDiscordBotToken(): string | undefined {
  return process.env.DISCORD_BOT_TOKEN?.trim() || undefined;
}

async function discordApi(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const token = getDiscordBotToken();
  if (!token) return { ok: false, error: "DISCORD_BOT_TOKEN missing" };

  try {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { raw: text };
      }
    }
    if (!res.ok) {
      const msg =
        typeof json === "object" &&
        json &&
        "message" in json &&
        typeof (json as { message: unknown }).message === "string"
          ? (json as { message: string }).message
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "discord fetch failed" };
  }
}

/** Abre (ou reutiliza) canal DM e envia mensagem. */
export async function sendDiscordDm(
  discordUserId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const channel = await discordApi("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!channel.ok) return channel;

  const channelId =
    typeof channel.json === "object" &&
    channel.json &&
    "id" in channel.json &&
    typeof (channel.json as { id: unknown }).id === "string"
      ? (channel.json as { id: string }).id
      : null;
  if (!channelId) return { ok: false, error: "DM channel id missing" };

  const sent = await discordApi(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
  if (!sent.ok) return sent;
  return { ok: true };
}

export function formatDiscordNotificationText(input: {
  titulo: string;
  corpo?: string;
  href?: string;
}): string {
  const base = getAppPublicUrl();
  const path =
    input.href && input.href.startsWith("/") ? input.href : input.href ? `/${input.href}` : "";
  const link = path ? `${base}${path}` : base;

  const titulo = input.titulo.trim();
  const corpo = input.corpo?.trim() ?? "";
  const lines = ["Charlie"];
  if (titulo) lines.push(titulo);
  if (corpo && corpo !== titulo) lines.push(corpo);
  lines.push("", link);
  return lines.join("\n");
}

/** Envia DM no Discord se opt-in + user_id. Nunca lança. */
export async function maybeSendDiscordNotification(input: {
  userId: string;
  tipo: string;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  if (!DISCORD_NOTIFY_TIPOS.has(input.tipo)) return;

  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("discord_user_id, discord_opt_in")
      .eq("id", input.userId)
      .maybeSingle();

    if (error || !profile?.discord_opt_in || !profile.discord_user_id) return;

    const href =
      input.metadata && typeof input.metadata.href === "string"
        ? input.metadata.href
        : undefined;

    const text = formatDiscordNotificationText({
      titulo: input.titulo,
      corpo: input.corpo,
      href,
    });

    const sent = await sendDiscordDm(profile.discord_user_id, text);
    if (!sent.ok) {
      console.error("[discord] send", sent.error);
    }
  } catch (e) {
    console.error("[discord] maybeSend", e);
  }
}
