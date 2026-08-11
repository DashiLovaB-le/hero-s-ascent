/**
 * Interactions Endpoint do bot Discord (Charlie)
 *
 * Secrets: DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY
 *
 * Portal → Application → General → Interactions Endpoint URL:
 *   https://<project>.supabase.co/functions/v1/discord-webhook
 *
 * Registrar slash /vincular:
 *   node --env-file=.env scripts/register-discord-commands.mjs
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
    if (!publicKey) {
      return json({ error: "Missing DISCORD_PUBLIC_KEY" }, 500);
    }

    const signature = req.headers.get("X-Signature-Ed25519");
    const timestamp = req.headers.get("X-Signature-Timestamp");
    const bodyText = await req.text();

    if (!signature || !timestamp || !verifyDiscordRequest(bodyText, signature, timestamp, publicKey)) {
      return json({ error: "Invalid request signature" }, 401);
    }

    const interaction = JSON.parse(bodyText) as DiscordInteraction;

    // PING — Discord valida o endpoint
    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    // APPLICATION_COMMAND
    if (interaction.type === 2) {
      const name = interaction.data?.name ?? "";
      if (name === "vincular") {
        return await handleVincular(interaction);
      }
      return ephemeral("Comando desconhecido. Use `/vincular` com o código do Perfil no app.");
    }

    return json({ type: 1 });
  } catch (e) {
    console.error("[discord-webhook]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

async function handleVincular(interaction: DiscordInteraction): Promise<Response> {
  const discordUserId =
    interaction.user?.id ?? interaction.member?.user?.id ?? null;
  if (!discordUserId) {
    return ephemeral("Não foi possível identificar seu usuário Discord.");
  }

  const codeRaw = interaction.data?.options?.find((o) => o.name === "codigo")?.value;
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  if (!code) {
    return ephemeral(
      "Informe o código. No app: Perfil → Discord → Conectar Discord (válido por 10 min).",
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return ephemeral("Serviço indisponível. Tente de novo em instantes.");
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error } = await admin
    .from("discord_link_codes")
    .select("code, user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (error || !row) {
    return ephemeral("Código inválido. Gere um novo link no Perfil do app.");
  }
  if (row.used_at) {
    return ephemeral("Este código já foi usado. Gere um novo no Perfil.");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return ephemeral("Código expirado. Gere um novo no Perfil (válido por 10 min).");
  }

  const nowIso = new Date().toISOString();
  const { error: useErr } = await admin
    .from("discord_link_codes")
    .update({ used_at: nowIso })
    .eq("code", code)
    .is("used_at", null);

  if (useErr) {
    return ephemeral("Não foi possível vincular. Tente de novo.");
  }

  const { error: profErr } = await admin
    .from("profiles")
    .update({
      discord_user_id: discordUserId,
      discord_linked_at: nowIso,
      discord_opt_in: true,
    })
    .eq("id", row.user_id);

  if (profErr) {
    console.error("[discord-webhook] profile", profErr.message);
    return ephemeral(
      "Conta vinculada parcialmente. Abra o Perfil no app e ative o opt-in do Discord.",
    );
  }

  return ephemeral(
    "Vinculado! Você receberá avisos do V-Project aqui (streak, hábitos, desafios do Charlie).\n\nPara pausar: Perfil → Discord → desative o toggle.",
  );
}

function verifyDiscordRequest(
  body: string,
  signatureHex: string,
  timestamp: string,
  publicKeyHex: string,
): boolean {
  try {
    const message = new TextEncoder().encode(timestamp + body);
    const signature = hexToUint8(signatureHex);
    const publicKey = hexToUint8(publicKeyHex);
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch (e) {
    console.error("[discord-webhook] verify", e);
    return false;
  }
}

function hexToUint8(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "");
  if (clean.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function ephemeral(content: string): Response {
  return json({
    type: 4,
    data: {
      content,
      flags: 64,
    },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type DiscordInteraction = {
  type: number;
  data?: {
    name?: string;
    options?: Array<{ name: string; type?: number; value?: string | number | boolean }>;
  };
  user?: { id: string };
  member?: { user?: { id: string } };
};
