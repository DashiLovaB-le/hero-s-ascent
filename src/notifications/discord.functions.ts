import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getDiscordBotProfileUrl,
  getDiscordBotUsername,
} from "@/notifications/discord-config";

const LINK_TTL_MS = 10 * 60 * 1000;

function newLinkCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gera código one-time para `/vincular` no Discord. */
export const createDiscordLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const code = newLinkCode();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

    const { error } = await context.supabase.from("discord_link_codes").insert({
      code,
      user_id: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const bot = getDiscordBotUsername();
    return {
      code,
      expiresAt,
      botUsername: bot,
      botProfileUrl: getDiscordBotProfileUrl(),
      /** Instrução pronta para o usuário colar no Discord. */
      slashHint: `/vincular codigo:${code}`,
    };
  });

export const setDiscordOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("discord_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    if (data.enabled && !profile?.discord_user_id) {
      throw new Error("Conecte o Discord antes de ativar as notificações.");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ discord_opt_in: data.enabled })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    return { ok: true as const, enabled: data.enabled };
  });

export const unlinkDiscord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        discord_user_id: null,
        discord_opt_in: false,
        discord_linked_at: null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getDiscordSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("discord_user_id, discord_opt_in, discord_linked_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      linked: Boolean(data?.discord_user_id),
      optIn: Boolean(data?.discord_opt_in),
      linkedAt: data?.discord_linked_at ?? null,
      botUsername: getDiscordBotUsername(),
      botProfileUrl: getDiscordBotProfileUrl(),
    };
  });
