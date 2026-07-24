import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTelegramBotUsername } from "@/notifications/telegram";

const LINK_TTL_MS = 10 * 60 * 1000;

function newLinkCode() {
  return randomBytes(16).toString("hex");
}

/** Gera código one-time e URL t.me/Bot?start=code */
export const createTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const code = newLinkCode();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

    // Usa o client do usuário (JWT) — evita SERVICE_ROLE no host Lovable
    // ("Invalid API key"). RLS: INSERT só com auth.uid() = user_id.
    const { error } = await context.supabase.from("telegram_link_codes").insert({
      code,
      user_id: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const bot = getTelegramBotUsername();
    return {
      code,
      expiresAt,
      deepLink: `https://t.me/${bot}?start=${code}`,
    };
  });

export const setTelegramOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    if (data.enabled && !profile?.telegram_chat_id) {
      throw new Error("Conecte o Telegram antes de ativar as notificações.");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ telegram_opt_in: data.enabled })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    return { ok: true as const, enabled: data.enabled };
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        telegram_chat_id: null,
        telegram_opt_in: false,
        telegram_linked_at: null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("telegram_chat_id, telegram_opt_in, telegram_linked_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      linked: Boolean(data?.telegram_chat_id),
      optIn: Boolean(data?.telegram_opt_in),
      linkedAt: data?.telegram_linked_at ?? null,
      botUsername: getTelegramBotUsername(),
    };
  });
