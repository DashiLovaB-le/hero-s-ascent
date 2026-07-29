/**
 * Módulo Mentor / IA — tudo do mecanismo fica nesta pasta.
 *
 * Arquivos:
 *   openrouter.ts   — client OpenRouter (OPENROUTER_API_KEY / OPENROUTER_MODEL)
 *   context.ts      — system prompt, presença, padrões, parse da resposta
 *   functions.ts    — server functions (chat, presença, desafios)
 *   queries.ts      — React Query
 *   CharlieNavButton.tsx — botão central da bottom nav
 *   MentorPage.tsx  — UI da conversa
 *   MentorJourneyCard.tsx — card na Jornada
 *   schema.sql      — tabelas do Mentor (espelho; migration aplicada em supabase/migrations/)
 *
 * Fora desta pasta (só wiring do app):
 *   src/routes/_authenticated/mentor.tsx — rota TanStack (fina)
 *   nav layout em src/routes/_authenticated/route.tsx (usa CharlieNavButton)
 */
export { chatCompletion } from "./openrouter";
export {
  MENTOR_SYSTEM_PROMPT,
  MENTOR_SYSTEM_PROMPT_DEFAULT,
  buildMentorContextBlock,
  detectPresenceKind,
  detectSkipPatterns,
  parseMentorAiPayload,
  presenceUserPrompt,
} from "./context";
export { getMentorSystemPrompt } from "./prompt.server";
export {
  getMentorThread,
  ensureMentorPresence,
  sendMentorMessage,
  updateMentorChallenge,
} from "./functions";
export { mentorThreadQueryOptions, MENTOR_STALE_MS } from "./queries";
export type { MentorThreadData } from "./queries";
export { MentorPage } from "./MentorPage";
export { MentorJourneyCard } from "./MentorJourneyCard";
export { CharlieNavButton } from "./CharlieNavButton";
