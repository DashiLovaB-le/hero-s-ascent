# Status da Aplicação — V-Project

Documento de referência sobre **como a aplicação funciona hoje**.  
Útil para onboarding de desenvolvedores, produto e futuras iterações.

| Campo | Valor |
| --- | --- |
| **Nome do produto** | V-Project |
| **Pasta / repo** | `hero-s-ascent` |
| **Idioma da UI** | Português (Brasil) |
| **Data deste status** | Julho 2026 |
| **Projeto Supabase** | `gmzddccyikpxbiozsiue` (Vproject) |
| **App produção** | https://v-projectdashi.lovable.app |
| **Schema canônico** | `supabase/migrations/20260717004140_complete_schema.sql` |

---

## 1. Visão geral

O **V-Project** é um app de desenvolvimento masculino gamificado pela metáfora da **Jornada do Herói**. O usuário:

1. Autentica-se (e-mail/senha ou Google)
2. Passa por um onboarding de áreas de foco e metas
3. Cria hábitos diários ligados a atributos
4. Completa hábitos → ganha **XP**, sobe de **nível**, mantém **streak** e fortalece **atributos**
5. Conversa com o mentor **Charlie** (IA), que pode criar **desafios** com recompensa de XP
6. Recebe **notificações in-app** (sino) e, se conectar, no **Telegram** (`@DashiVProject_bot`)

Visual: dark cyberpunk (fundo `#1B1B1B`, texto creme `#FFE7D0`, accent laranja `#FC6E20`), painéis com **clip-path** chanfrado (`cp-panel` / `cp-modal`).

---

## 2. Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, TanStack Start, TanStack Router, TanStack Query, Vite 8 |
| UI | Tailwind CSS v4, shadcn/Radix, Lucide, Sonner (toasts) |
| Validação | Zod |
| Backend / dados | Supabase (Auth + Postgres + RLS) |
| Jobs | Edge Functions + `pg_cron` / `pg_net` |
| Canais | In-app + Telegram Bot API |
| IA (mentor) | OpenRouter |
| Tipagem DB | `src/integrations/supabase/types.ts` |

Arquivos de entrada importantes:

- `src/router.tsx` — QueryClient + router
- `src/start.ts` — middleware global de auth nos server functions
- `src/routes/__root.tsx` — shell HTML, fontes, Toaster, sync auth ↔ cache
- `src/routeTree.gen.ts` — árvore de rotas gerada

---

## 3. Estrutura de pastas (essencial)

```
src/
  routes/                    # Rotas (file-based)
    index.tsx                # Landing /
    auth.tsx                 # Login / cadastro
    _authenticated/          # Shell autenticado (+ NotificationBell)
      journey.tsx
      habits.tsx
      goals.tsx
      mentor.tsx
      profile.tsx             # + TelegramSettingsCard + wallpaper
      onboarding.tsx
  mentor/                    # Charlie
  notifications/             # In-app + Telegram helpers + jobs
  lib/
    journey.ts / journey.functions.ts / journey-queries.ts
    profile.functions.ts
  integrations/supabase/
  components/ui/
  styles.css
public/
supabase/
  migrations/                # Schema (canônico = complete_schema)
  functions/
    notification-jobs/       # Cron diário 22:00 BRT
    telegram-webhook/        # /start vínculo
```

---

## 4. Rotas e o que cada tela faz

### Públicas

| Rota | Arquivo | Função |
| --- | --- | --- |
| `/` | `src/routes/index.tsx` | Landing |
| `/auth` | `src/routes/auth.tsx` | Login / cadastro / Google |

### Autenticadas (`/_authenticated`)

Layout em `src/routes/_authenticated/route.tsx`:

- Header: logo, nav, **NotificationBell**, logout
- Bottom nav mobile + Charlie central
- Wallpaper de fundo (preferência do perfil)
- `beforeLoad`: sessão; sem user → `/auth`

| Rota | Função |
| --- | --- |
| `/journey` | Dashboard XP / streak / hábitos do dia / Charlie |
| `/habits` | CRUD + concluir hábitos |
| `/goals` | CRUD metas |
| `/mentor` | Chat Charlie + desafios ativos |
| `/profile` | Identidade, atributos, troféus, **Telegram**, wallpaper, editar perfil |
| `/onboarding` | Áreas + metas iniciais |

---

## 5. Autenticação — fluxo detalhado

(inalterado em essência)

1. `/auth` → e-mail/senha, cadastro ou Google OAuth  
2. Trigger `on_auth_user_created` → `profiles` + `attributes` + `user_roles`  
3. Server functions: JWT via `attachSupabaseAuth` + `requireSupabaseAuth`  
4. Logout limpa React Query e sessão  

---

## 6. Onboarding

`onboarding_completo === false` → CTA em jornada/mentor.  
`/onboarding` → categorias → `setGoals` → marca completo.  
Não cria hábitos nem chama IA.

---

## 7. Domínio da gamificação

XP/níveis (`LEVELS` em `journey.ts`), streak, 8 atributos, capítulos (seed sem avanço automático), hábitos/conclusões, metas, conquistas (catálogo sem unlock automático), `activity_history` (só writes).

---

## 8. Mentor Charlie

Módulo `src/mentor/`: chat OpenRouter, presença, memórias, desafios (máx. 2 ativos).  
Concluir desafio → XP + `activity_history` + notificação.  
Expiração: lazy no mentor + job global `notification-jobs` → status `expirado` + notificação.

---

## 9. Camada de dados (Supabase)

### 9.1 Tabelas

| Tabela | Papel |
| --- | --- |
| `profiles` | Herói (+ `wallpaper_id`, `telegram_*`) |
| `attributes` | 8 atributos |
| `levels` / `chapters` / `achievements` | Seeds |
| `user_achievements` | Unlock |
| `goals` / `habits` / `habit_completions` | Jornada diária |
| `activity_history` | Log XP |
| `user_roles` | `admin` / `user` |
| `mentor_messages` / `mentor_memories` / `mentor_challenges` / `mentor_objectives` | Charlie |
| `notifications` | Centro in-app |
| `telegram_link_codes` | Códigos one-time de vínculo |

### 9.2 RLS (resumo)

- Dados do usuário: `auth.uid()`
- `notifications`: SELECT/UPDATE próprio; INSERT só service_role
- `telegram_link_codes`: sem policy authenticated (só service_role)
- Trigger `guard_telegram_profile_cols`: usuário não inventa `telegram_chat_id` (só limpa / opt-in)

### 9.3 Schema canônico

`supabase/migrations/20260717004140_complete_schema.sql` inclui jornada + mentor + **notificações + Telegram + wallpaper** + agendamento cron se o Vault tiver `notification_jobs_cron_secret`.

Migrations incrementais históricas permanecem na pasta (idempotentes / no-ops relativos).

---

## 10. Cache e performance

| Config | Valor |
| --- | --- |
| `staleTime` jornada/metas/notificações | ~30s |
| `staleTime` mentor | ~15s |
| `gcTime` | 5 min |
| `refetchOnWindowFocus` | off |

---

## 11. Design system

Paleta `#1B1B1B` / `#FFE7D0` / `#323232` / `#FC6E20`.  
Fonts Ethnocentric + Chakra Petch. Utils `cp-panel` / `cp-modal` / `page-enter`.

---

## 12. Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Sim | Projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Sim | Anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (server) | Admin inserts |
| `CRON_SECRET` | Sim (jobs) | Edge `notification-jobs` |
| `TELEGRAM_BOT_TOKEN` | Sim (Telegram) | Bot API + webhook |
| `TELEGRAM_BOT_USERNAME` | Não | Default `DashiVProject_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Sim (webhook) | Header secret Telegram |
| `APP_PUBLIC_URL` | Sim (links) | `https://v-projectdashi.lovable.app` |
| `OPENROUTER_API_KEY` | Sim (Charlie) | IA |
| `OPENROUTER_MODEL` | Não | Override |

Secrets das Edge Functions espelham os mesmos nomes (exceto `SUPABASE_*`, injetados pela plataforma).

---

## 13. Fluxo ponta a ponta (usuário novo)

```
Landing → Auth → trigger profile
  → /journey → /onboarding → hábitos
  → Charlie / desafios
  → sino (notificações)
  → Perfil → Conectar Telegram → opt-in
  → cron 22:00 BRT: reminders + streak + expirar desafios
       → in-app + Telegram (se ligado)
```

---

## 14. O que já funciona vs. lacunas

### Funciona hoje

- Auth, onboarding, hábitos, metas, XP/streak/atributos
- Charlie (chat, presença, memórias, desafios)
- Notificações in-app (sino, filtros Todas/Não lidas)
- Jobs: `habit_reminder`, `streak_risk`, `mentor_challenge_expired` (cron `0 1 * * *` UTC = 22:00 BRT)
- Telegram: vínculo Profile + envio espelhando tipos de produto
- Wallpaper no perfil
- Edge Functions deployadas: `notification-jobs`, `telegram-webhook`

### Lacunas

| Item | Situação |
| --- | --- |
| Unlock automático de conquistas | Sem engine |
| Avanço automático de capítulo | Sem regra |
| Missões | Enum sem UI |
| Hábitos gerados por IA | Não |
| Upload de avatar | Coluna só |
| Histórico de atividade (tela) | Só writes |
| Push / e-mail / WhatsApp | Não (plano Fase 3 / WhatsApp futuro) |
| Soft onboarding | Pode abrir `/habits` sem terminar |

---

## 15. Arquivos mais importantes

| Assunto | Onde |
| --- | --- |
| Níveis / categorias | `src/lib/journey.ts` |
| Jornada server | `src/lib/journey.functions.ts` |
| Charlie | `src/mentor/*` |
| Notificações / Telegram | `src/notifications/*` |
| Schema | `supabase/migrations/20260717004140_complete_schema.sql` |
| Edge jobs | `supabase/functions/notification-jobs/` |
| Edge webhook | `supabase/functions/telegram-webhook/` |
| Planos | `PlanejamentoNotificacoes.md`, `PlanejamentoTelegram.md` |

---

## 16. Notificações + Telegram

Planos: `PlanejamentoNotificacoes.md`, `PlanejamentoTelegram.md`.

| Peça | Onde |
| --- | --- |
| Schema | Embutido no `complete_schema` (+ migrations incrementais) |
| CRUD in-app | `src/notifications/functions.ts` |
| Create + espelho Telegram | `src/notifications/create.ts` + `telegram.ts` |
| Jobs server | `src/notifications/jobs.ts` / `runNotificationJobs` |
| UI sino | `NotificationBell.tsx` no header auth |
| UI vínculo | `TelegramSettingsCard.tsx` em `/profile` |
| Cron | `notification-jobs` — header `x-cron-secret` |
| Webhook | `telegram-webhook` — header `X-Telegram-Bot-Api-Secret-Token` |

**Tipos enviáveis (in-app + Telegram se opt-in):**  
`mentor_challenge`, `mentor_challenge_done`, `mentor_challenge_expired`, `habit_reminder`, `streak_risk`.

**Anti-spam:** máx. 1 `habit_reminder` / `streak_risk` por usuário/dia (índice único).  
**Quiet hours:** ≈ 23:00–06:59 BRT (02:00–09:59 UTC) — só reminders; expiração sempre roda.

---

## 17. Como subir / aplicar banco

1. `npm install` + `.env` completo  
2. SQL Editor: rodar `20260717004140_complete_schema.sql`  
3. Se Vault ainda não tiver o secret do cron:
   ```sql
   select vault.create_secret('SEU_CRON_SECRET', 'notification_jobs_cron_secret');
   ```
   e reexecutar o bloco de cron do schema (ou migration `20260724101500_schedule_notification_jobs.sql`)  
4. Deploy functions (já em produção no Vproject):
   ```bash
   npx supabase functions deploy telegram-webhook notification-jobs \
     --project-ref gmzddccyikpxbiozsiue --no-verify-jwt --use-api
   ```
5. `setWebhook` do Telegram com `secret_token`  
6. `npm run dev`

---

*Documento alinhado ao código. Ao mudar features, atualize §§ 9, 14, 16 e 17.*
