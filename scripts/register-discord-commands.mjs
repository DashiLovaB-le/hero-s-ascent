/**
 * Registra (ou atualiza) o slash command global `/vincular` do bot Discord.
 *
 * Uso:
 *   node --env-file=.env scripts/register-discord-commands.mjs
 *
 * Requer: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID
 */
const token = process.env.DISCORD_BOT_TOKEN?.trim();
const appId = process.env.DISCORD_APPLICATION_ID?.trim();

if (!token || !appId) {
  console.error("Defina DISCORD_BOT_TOKEN e DISCORD_APPLICATION_ID no .env");
  process.exit(1);
}

const commands = [
  {
    name: "vincular",
    description: "Vincula sua conta do V-Project com o código gerado no Perfil",
    type: 1,
    dm_permission: true,
    options: [
      {
        type: 3,
        name: "codigo",
        description: "Código do app (Perfil → Discord → Conectar)",
        required: true,
      },
    ],
  },
];

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

const body = await res.text();
if (!res.ok) {
  console.error("Falha ao registrar commands:", res.status, body);
  process.exit(1);
}

console.log("Slash commands registrados:");
console.log(body);
console.log("\nPróximo passo: no Portal, setar Interactions Endpoint URL para");
console.log("  https://<ref>.supabase.co/functions/v1/discord-webhook");
