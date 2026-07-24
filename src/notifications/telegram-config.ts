/** Helpers de Telegram sem service role — seguro importar de server fns usados no client. */

export function getTelegramBotUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME || "DashiVProject_bot").replace(/^@/, "");
}

export function getAppPublicUrl(): string {
  const raw =
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_APP_PUBLIC_URL ||
    "https://v-project-rho.vercel.app";
  return raw.replace(/\/$/, "");
}
