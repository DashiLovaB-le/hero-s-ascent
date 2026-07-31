/**
 * Módulo Mentor / IA — tudo do mecanismo fica nesta pasta.
 *
 * Arquivos:
 *   openrouter.ts   — client OpenRouter (modelo: control room / OPENROUTER_MODEL)
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
  challengeFollowUpUserText,
  detectPresenceKind,
  detectSkipPatterns,
  parseMentorAiPayload,
  presenceUserPrompt,
  resolveMentorCyclePhase,
} from "./context";
export type { ChallengeOutcome } from "./context";
export { getMentorSystemPrompt, getMentorSystemPromptForUser } from "./prompt.server";
export {
  getMentorThread,
  ensureMentorPresence,
  sendMentorMessage,
  updateMentorChallenge,
  listCharliePersonalities,
  setCharliePersonality,
} from "./functions";
export { mentorThreadQueryOptions, MENTOR_STALE_MS } from "./queries";
export type { MentorThreadData } from "./queries";
export { MentorPage } from "./MentorPage";
export { MentorJourneyCard } from "./MentorJourneyCard";
export { CharlieNavButton } from "./CharlieNavButton";
export { CharliePersonalityPicker } from "./CharliePersonalityPicker";
export { CHARLIE_PERSONALITY_SEEDS, DEFAULT_CHARLIE_PERSONALITY } from "./personalities.seed";
