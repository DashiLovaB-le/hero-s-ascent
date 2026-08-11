/** Helpers de Discord sem service role — seguro importar de server fns usados no client. */

export function getDiscordBotUsername(): string {
  return (process.env.DISCORD_BOT_USERNAME || "Charlie").replace(/^@/, "");
}

export function getDiscordApplicationId(): string {
  return (process.env.DISCORD_APPLICATION_ID || "").trim();
}

/** Perfil do bot no Discord (abre DM / Message). Application ID = bot user id na maioria dos apps. */
export function getDiscordBotProfileUrl(): string {
  const id = getDiscordApplicationId();
  if (!id) return "https://discord.com/app";
  return `https://discord.com/users/${id}`;
}

export function getAppPublicUrl(): string {
  const raw =
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_APP_PUBLIC_URL ||
    "https://v-project-rho.vercel.app";
  return raw.replace(/\/$/, "");
}
