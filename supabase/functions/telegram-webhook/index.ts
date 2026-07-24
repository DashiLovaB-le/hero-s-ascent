/**
 * Webhook do bot Telegram (@DashiVProject_bot)
 *
 * Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
 * setWebhook:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook
 *   ?url=https://gmzddccyikpxbiozsiue.supabase.co/functions/v1/telegram-webhook
 *   &secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
    const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!expected || got !== expected) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!url || !key || !botToken) {
      return json({ error: "Missing env" }, 500);
    }

    const update = await req.json();
    const message = update?.message;
    const chatId = message?.chat?.id != null ? String(message.chat.id) : null;
    const text: string = typeof message?.text === "string" ? message.text : "";

    if (!chatId) {
      return json({ ok: true, ignored: true });
    }

    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (text.startsWith("/start")) {
      const parts = text.trim().split(/\s+/);
      const code = parts[1]?.trim();

      if (!code) {
        await tgSend(
          botToken,
          chatId,
          "Olá! Para vincular sua conta do V-Project, abra o app → Perfil → Conectar Telegram.",
        );
        return json({ ok: true });
      }

      const { data: row, error } = await admin
        .from("telegram_link_codes")
        .select("code, user_id, expires_at, used_at")
        .eq("code", code)
        .maybeSingle();

      if (error || !row) {
        await tgSend(botToken, chatId, "Código inválido. Gere um novo link no Perfil do app.");
        return json({ ok: true });
      }
      if (row.used_at) {
        await tgSend(botToken, chatId, "Este código já foi usado. Gere um novo no Perfil.");
        return json({ ok: true });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await tgSend(botToken, chatId, "Código expirado. Gere um novo no Perfil (válido por 10 min).");
        return json({ ok: true });
      }

      const nowIso = new Date().toISOString();
      const { error: useErr } = await admin
        .from("telegram_link_codes")
        .update({ used_at: nowIso })
        .eq("code", code)
        .is("used_at", null);

      if (useErr) {
        await tgSend(botToken, chatId, "Não foi possível vincular. Tente de novo.");
        return json({ ok: true });
      }

      const { error: profErr } = await admin
        .from("profiles")
        .update({
          telegram_chat_id: chatId,
          telegram_linked_at: nowIso,
          telegram_opt_in: true,
        })
        .eq("id", row.user_id);

      if (profErr) {
        await tgSend(botToken, chatId, "Conta vinculada parcialmente. Abra o Perfil e ative o opt-in.");
        return json({ ok: true });
      }

      await tgSend(
        botToken,
        chatId,
        "Vinculado! Você receberá avisos do V-Project aqui (streak, hábitos, desafios do Charlie).\n\nPara pausar: Perfil → Telegram → desative o toggle.",
      );
      return json({ ok: true, linked: true });
    }

    await tgSend(
      botToken,
      chatId,
      "Bot do V-Project ativo. Use o link do Perfil no app para conectar sua conta.",
    );
    return json({ ok: true });
  } catch (e) {
    console.error("[telegram-webhook]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function tgSend(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("[telegram-webhook] send", e);
  }
}
