import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppPublicUrl } from "@/notifications/telegram-config";

export { getAppPublicUrl, getTelegramBotUsername } from "@/notifications/telegram-config";

export const TELEGRAM_NOTIFY_TIPOS = new Set([
  "mentor_challenge",
  "mentor_challenge_done",
  "mentor_challenge_expired",
  "habit_reminder",
  "streak_risk",
  "agent_initiative",
]);

export function getTelegramBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.description || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "telegram fetch failed" };
  }
}

export function formatTelegramNotificationText(input: {
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

/** Envia no Telegram se opt-in + chat_id. Nunca lança. */
export async function maybeSendTelegramNotification(input: {
  userId: string;
  tipo: string;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  if (!TELEGRAM_NOTIFY_TIPOS.has(input.tipo)) return;

  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id, telegram_opt_in")
      .eq("id", input.userId)
      .maybeSingle();

    if (error || !profile?.telegram_opt_in || !profile.telegram_chat_id) return;

    const href =
      input.metadata && typeof input.metadata.href === "string"
        ? input.metadata.href
        : undefined;

    const text = formatTelegramNotificationText({
      titulo: input.titulo,
      corpo: input.corpo,
      href,
    });

    const sent = await sendTelegramMessage(profile.telegram_chat_id, text);
    if (!sent.ok) {
      console.error("[telegram] send", sent.error);
    }
  } catch (e) {
    console.error("[telegram] maybeSend", e);
  }
}
