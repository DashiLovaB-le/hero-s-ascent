# ResumoAplicacao — V-Project

Documento único para compreender **o que a aplicação é**, **como funciona**, **como está construída** e **o que ainda não faz**.  
Alinhado ao código do repositório `hero-s-ascent` (julho 2026 — inclui ML Fases 1–4).

| Campo | Valor |
| --- | --- |
| **Nome do produto** | V-Project |
| **Repo / pasta** | `hero-s-ascent` |
| **Idioma da UI** | Português (Brasil) |
| **Público** | Desenvolvimento masculino gamificado |
| **Metáfora** | Jornada do Herói |
| **Backend** | Supabase projeto `gmzddccyikpxbiozsiue` (Vproject) |
| **Produção** | Vercel — `https://v-project-rho.vercel.app` |
| **Schema canônico** | `supabase/migrations/20260717004140_complete_schema.sql` |

---

## 1. O que é o produto

O **V-Project** transforma autodisciplina em uma jornada gamificada. O herói:

1. Entra na conta (e-mail/senha ou Google)
2. Faz onboarding (áreas de foco + primeiras metas)
3. Cria hábitos diários ligados a atributos
4. Completa hábitos → ganha **XP**, sobe de **nível**, mantém **streak**, fortalece **atributos**
5. Conversa com o mentor **Charlie** (IA), que pode criar **desafios** com recompensa de XP
6. Personaliza o app com **fundos de tela** desbloqueáveis
7. Recebe **notificações in-app** (sino) e, se quiser, no **Telegram** (`@DashiVProject_bot`)
8. Pode informar a **cidade/região** no perfil; o Charlie usa o **clima local** (Open-Meteo) no contexto da conversa
9. Registra **check-in** diário (sono/energia/humor) na Jornada — sinais reais para o Charlie e para o agente
10. Camada de **ML** (features + scores + jobs) alimenta lembretes, desafios e iniciativas com guardrails

Não é uma rede social. É um app individual de progresso, ritmo diário e mentoria.

---

## 2. Experiência do usuário (fluxo ponta a ponta)

```text
Landing (/)
  → Auth (/auth)  — login / cadastro / Google
  → Trigger Supabase cria profiles + attributes + user_roles
  → /journey (dashboard)
       → se onboarding incompleto → /onboarding
       → hábitos do dia, XP, streak, card do Charlie, **check-in** (sono/energia/humor)
  → /habits  — CRUD + marcar concluído
  → /goals   — CRUD metas
  → /mentor  — chat Charlie, presença, desafios, sinais ML
  → /profile — identidade, atributos, cidade, wallpaper, Telegram
  → sino (notificações) + crons diários (lembretes / ML features / agente)
```

### Telas públicas

| Rota | Função |
| --- | --- |
| `/` | Landing: brand, hero, pilares, CTA |
| `/auth` | Login, cadastro, Google OAuth, animações de entrada |

### Telas autenticadas (shell `/_authenticated`)

Layout compartilhado:

- Header: logo, nav desktop, **NotificationBell**, logout
- Bottom nav mobile + botão central do Charlie
- Wallpaper de fundo (preferência do perfil)
- `beforeLoad`: valida sessão Supabase; sem user → redirect `/auth`
- Rotas autenticadas usam `ssr: false` (SPA no client após auth)

| Rota | Função |
| --- | --- |
| `/journey` | Dashboard: nível, XP, streak, hábitos do dia, check-in, atributos, entrada para Charlie |
| `/habits` | Criar / editar / excluir / concluir hábitos |
| `/goals` | Criar / excluir metas |
| `/mentor` | Chat com Charlie, desafios ativos, histórico |
| `/profile` | Perfil, radar de atributos, ritmo, troféus, localização/clima, wallpapers, Telegram |
| `/onboarding` | Escolha de categorias + metas iniciais |

---

## 3. Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, TanStack Start, TanStack Router, TanStack Query, Vite 8 |
| UI | Tailwind CSS v4, shadcn/Radix, Lucide, Sonner, Recharts |
| Validação | Zod |
| Backend | Supabase Auth + Postgres + RLS |
| Jobs | Edge Functions + `pg_cron` / `pg_net` (`notification-jobs`, `ml-features-job`, `agent-initiatives-job`, `telegram-webhook`) |
| IA | OpenRouter (Charlie) |
| ML | Feature store + scores heurísticos (`heuristic_v1`); sklearn shadow; CF leve; agente |
| Clima | Open-Meteo (geocoding + forecast, sem API key) |
| Deploy | Vercel (Nitro preset `vercel` em `vite.config.ts`) |
| Patch conhecido | `patch-package` em `@tanstack/react-router` (evita `Uncaught undefined` no reload) |

### Entrada da aplicação

| Arquivo | Papel |
| --- | --- |
| `src/router.tsx` | QueryClient + createRouter |
| `src/start.ts` | Middleware global: anexa JWT em server functions |
| `src/server.ts` | Wrapper SSR / erros catastróficos |
| `src/routes/__root.tsx` | Shell HTML, CSS, fontes, Toaster, sync auth ↔ cache |
| `src/routeTree.gen.ts` | Árvore de rotas gerada |

---

## 4. Estrutura de pastas (mapa mental)

```text
src/
  routes/                      # File-based routes
    index.tsx                  # Landing
    auth.tsx                   # Auth
    _authenticated/            # Shell + páginas protegidas
  mentor/                      # Charlie (UI, context, OpenRouter, functions)
  notifications/               # Sino, CRUD, create, jobs, Telegram
  lib/
    journey.ts                 # Níveis, categorias, frases (puro)
    journey.functions.ts       # Server fns jornada / hábitos / metas (+ recompute ML)
    journey-queries.ts         # React Query options
    profile.functions.ts       # Panorama do perfil
    checkins.functions.ts      # Check-in diário (sono/energia/humor)
    ml/                        # Feature store, adaptive, agent, CF
      features.ts              # computeUserFeatures + heuristic_v1
      recompute.ts             # Upsert user_features / user_ml_scores
      adaptive.ts              # Guardrails Fase 3 (notif + desafios)
      agent.ts / agent-jobs.ts # Iniciativas do agente (Fase 4)
      collaborative.ts         # CF por weekday_rates
    wallpapers.ts              # Catálogo + regras de unlock
    wallpaper-storage.ts       # Preferência local + evento
    weather.ts                 # Open-Meteo (server)
    safe-query.ts              # Normaliza erros de query
  components/
    CheckinCard.tsx            # UI check-in na Jornada
    ui/                        # shadcn
  integrations/supabase/       # Client, admin, auth middleware, types
  styles.css                   # Tokens cyberpunk + utils
ml/                            # Pacote Python Fase 2 (train / evaluate / score-shadow)
plans/
  ML-fase-1.md … ML-fase-4.md  # Roadmap ML canônico
public/                        # logo, charlie, wallpapers, ícones
supabase/
  migrations/                  # Schema + incrementais (ML 1–4)
  functions/
    notification-jobs/         # Cron lembretes + adaptive
    ml-features-job/           # Cron features + scores
    agent-initiatives-job/     # Cron CF + iniciativas
    telegram-webhook/          # /start vínculo Telegram
patches/                       # patch-package (TanStack Router)
```

---

## 5. Autenticação e segurança

### Fluxo

1. `/auth` — e-mail/senha, cadastro ou Google
2. Trigger `on_auth_user_created` no Postgres cria:
   - `profiles`
   - `attributes`
   - `user_roles` (role `user`)
3. Browser guarda sessão Supabase (localStorage)
4. Toda server function autenticada:
   - `attachSupabaseAuth` (client) envia `Authorization: Bearer <JWT>`
   - `requireSupabaseAuth` (server) valida claims e injeta `supabase` + `userId`
5. Logout: `signOut` + limpa React Query + navega para `/auth`
6. Se o JWT for de **outro projeto** Supabase, a sessão é limpa (proteção pós-migração de projeto)

### RLS (resumo)

- Dados do usuário filtrados por `auth.uid()`
- `notifications`: usuário SELECT/UPDATE; INSERT via service role
- `telegram_link_codes`: insert do usuário autenticado (código one-time); consumo no webhook com service role
- Colunas Telegram no perfil protegidas por trigger `guard_telegram_profile_cols` (usuário não inventa `telegram_chat_id`; só limpa / opt-in)

---

## 6. Onboarding

- Se `onboarding_completo === false`, há CTA em jornada/mentor apontando para `/onboarding`
- Fluxo: escolher categorias de foco → `setGoals` (metas iniciais) → marca onboarding completo
- **Não** cria hábitos automaticamente e **não** chama a IA
- Soft gate: ainda é possível abrir `/habits` sem terminar o onboarding

---

## 7. Domínio da gamificação

### XP e níveis (12)

Definidos em `src/lib/journey.ts`:

| Nível | Título | XP necessário |
| --- | --- | --- |
| 1 | Homem Comum | 0 |
| 2 | Aprendiz | 200 |
| 3 | Iniciado | 600 |
| 4 | Aspirante | 1400 |
| 5 | Guerreiro | 3000 |
| 6 | Sentinela | 6000 |
| 7 | Cavaleiro | 10000 |
| 8 | Estrategista | 16000 |
| 9 | Mestre | 25000 |
| 10 | Sábio | 40000 |
| 11 | Rei | 65000 |
| 12 | Lenda | 100000 |

### Atributos (8)

Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento, Liderança.

Ao concluir um hábito, o XP sobe e o atributo ligado ao hábito incrementa.

### Streak

Dias consecutivos com hábitos concluídos. Atualizado em `completeHabit`.  
Há notificação de **risco de streak** (`streak_risk`) via job diário.

### Categorias de foco

Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito.

### Capítulos e conquistas

Tabelas seed (`chapters`, `achievements`, `user_achievements`) + engine em `progress-engine.ts`:

- avanço de capítulo e unlock de conquistas ao progredir (hábitos / XP / missões)
- UI de troféus no perfil
- missões de capítulo (`missions`) com progresso ao concluir hábitos

### Hábitos e metas

- Hábitos: título, descrição, XP, atributo, categoria, ativo
- Conclusões: 1 por hábito por dia (`habit_completions`)
- Metas: texto + categoria; onboarding cria as primeiras via `setGoals`

### Activity history

Tabela `activity_history` recebe writes (hábitos, desafios, etc.). Histórico visível no panorama do perfil.

---

## 8. Mentor Charlie

Módulo: `src/mentor/`.

| Capacidade | Detalhe |
| --- | --- |
| Chat | Mensagens user/assistant em `mentor_messages` |
| Presença | Mensagem periódica + **insight** se risco ML alto |
| Memórias | `mentor_memories` (importância; prune ~20) |
| Objetivos | `mentor_objectives` |
| Desafios | `mentor_challenges` — máx. 2 ativos; **clamp adaptativo** (Fase 3) |
| Sinais ML | Bloco `SINAIS ML` no contexto (`user_ml_scores` / `heuristic_v1`) |
| Check-ins | Sono/energia/humor só se o herói registrou; senão o prompt proíbe inventar |
| IA | OpenRouter (`OPENROUTER_API_KEY`, modelo configurável) |
| Clima | Se o perfil tem lat/lon, o contexto inclui snapshot Open-Meteo |

Concluir desafio → XP + activity + notificação `mentor_challenge_done`.  
Expiração → status `expirado` + notificação `mentor_challenge_expired` (lazy no mentor e/ou job global).

Documentos: `plans/Charlie-fase-1.md`, `plans/ML-fase-1.md` … `ML-fase-4.md`.

---

## 8b. Machine Learning (Fases 1–4)

| Fase | Entrega | Doc |
| --- | --- | --- |
| **1 — Feature store** | `user_features` + `user_ml_scores` (`heuristic_v1`); job `ml-features-job` (03:00 UTC); recompute após hábito; Charlie lê scores | `ML-fase-1.md` |
| **2 — Preditivo** | Pacote Python `ml/` (logistic/GBM); AUC offline; **shadow** em `user_ml_scores_shadow` (não vai ao Charlie) | `ML-fase-2.md` |
| **3 — Adaptativo** | Lembretes e desafios guiados por scores + guardrails (`src/lib/ml/adaptive.ts`) | `ML-fase-3.md` |
| **4 — Agente** | Check-ins; iniciativas (`agent_initiatives`); CF leve (`user_cf_recommendations`); job `agent-initiatives-job` (04:00 UTC) | `ML-fase-4.md` |

**Produção (Charlie / notifs):** só `heuristic_v1` em `user_ml_scores`.  
**Shadow sklearn / CF:** tabelas separadas; promoção sklearn exige decisão humana (AUC ≥ 0.65).  
**Agente:** máx. 1 iniciativa/dia; não cria desafio sozinho — notifica e convida a agir.

Testes: `npm run test:ml`.  
CLI Python: `cd ml && python -m vproject_ml train|evaluate|score-shadow`.

## 9. Fundos de tela (wallpapers)

- Catálogo: `src/lib/wallpapers.ts`
- Arquivos: `public/wallpapers/`
- Unlock por: sempre disponível, nível, XP, streak máximo ou capítulo
- Preferência: coluna `profiles.wallpaper_id` + sync em `localStorage` (`wallpaper-storage`)
- UI: `WallpaperSettings` no perfil; fundo aplicado no layout autenticado
- Ao desbloquear (ex.: ao ganhar XP), pode gerar notificação

---

## 10. Localização e clima

- Perfil grava cidade/região + lat/lon/timezone (migration `20260727140000_profile_location_weather.sql`)
- Geocoding e forecast: Open-Meteo (`src/lib/weather.ts`), cache ~45 min
- Charlie usa o clima com parcimônia (não inventa tempo se não houver região)

---

## 11. Notificações in-app

### UI

- `NotificationBell` no header autenticado
- Sheet lateral: filtros Todas / Não lidas, marcar lida / marcar todas
- Error boundary no sino (falha não derruba o layout)

### Tipos

`mentor_challenge`, `mentor_challenge_done`, `mentor_challenge_expired`, `habit_complete`, `habit_reminder`, `streak_risk`, `mentor_presence`, `achievement`, `system`, `agent_initiative`

### Criação

- `createNotification` (service role) em `src/notifications/create.ts`
- Listagem/marcar: server fns client-safe em `functions.ts` (sem service role no bundle)

### Jobs diários

| Function | Cron (UTC) | Papel |
| --- | --- | --- |
| `notification-jobs` | `0 1 * * *` (~22:00 BRT) | `habit_reminder` / `streak_risk` (adaptive) + expirar desafios |
| `ml-features-job` | `0 3 * * *` | Recalcula features + scores `heuristic_v1` |
| `agent-initiatives-job` | `0 4 * * *` | CF + iniciativas do agente |
| `telegram-webhook` | sob demanda | Vínculo Telegram |

- Auth dos crons: header `x-cron-secret` = `CRON_SECRET` (Vault `notification_jobs_cron_secret`)
- Quiet hours ≈ 23:00–06:59 BRT (reminders e iniciativas; expiração sempre roda)
- Anti-spam: no máx. 1 reminder/streak/iniciativa por usuário/dia

---

## 12. Telegram

| Peça | Detalhe |
| --- | --- |
| Bot | `@DashiVProject_bot` |
| UI vínculo | `TelegramSettingsCard` em `/profile` |
| Vínculo | Perfil → gera código → `t.me/Bot?start=code` |
| Webhook | `telegram-webhook`; header `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET` |
| Opt-in | `profiles.telegram_opt_in` |
| Create + espelho | `src/notifications/create.ts` + `telegram.ts` |

**Tipos espelhados (in-app + Telegram se opt-in):**  
`mentor_challenge`, `mentor_challenge_done`, `mentor_challenge_expired`, `habit_reminder`, `streak_risk`, `agent_initiative`.

---

## 13. Modelo de dados (Supabase)

| Tabela | Papel |
| --- | --- |
| `profiles` | Herói (XP, streak, capítulo, wallpaper, telegram, localização…) |
| `attributes` | 8 atributos |
| `levels` / `chapters` / `achievements` | Seeds de catálogo |
| `user_achievements` | Conquistas desbloqueadas |
| `missions` | Missões de capítulo |
| `goals` | Metas |
| `habits` | Hábitos |
| `habit_completions` | Check diário |
| `activity_history` | Log de XP/eventos |
| `user_roles` | `admin` / `user` |
| `mentor_*` | Mensagens, memórias, desafios, objetivos |
| `notifications` | Centro in-app |
| `telegram_link_codes` | Códigos one-time |
| `user_features` | Feature store ML (Fase 1) |
| `user_ml_scores` | Scores produção `heuristic_v1` → Charlie |
| `user_ml_scores_shadow` | Scores sklearn (shadow, Fase 2) |
| `ml_model_runs` | AUC / metadados de treino |
| `user_checkins` | Sono / energia / humor (Fase 4) |
| `agent_initiatives` | Iniciativas do agente |
| `user_cf_recommendations` | Sugestões CF (weekday peers) |

Schema base: `supabase/migrations/20260717004140_complete_schema.sql`  
(+ migrations incrementais: notificações, Telegram, wallpaper, clima, missões, **ML fases 1–4**).

---

## 14. Cache e performance (React Query)

| Config | Valor típico |
| --- | --- |
| `staleTime` jornada / metas / notificações | ~30s |
| `staleTime` mentor | ~15s |
| `gcTime` | 5 min |
| `refetchOnWindowFocus` | off |
| Mutations de hábito | update otimista + invalidate |

Server functions são o canal de mutação/leitura autenticada (não PostgREST direto na maior parte da UI).

---

## 15. Design system

| Token | Valor / uso |
| --- | --- |
| Fundo | `#1B1B1B` |
| Texto | creme `#FFE7D0` |
| Superfície | `#323232` |
| Accent / hero | laranja `#FC6E20` |
| Tipografia | Ethnocentric (display) + Chakra Petch |
| Painéis | `cp-panel` / `cp-modal` (clip-path chanfrado) |
| Tom | Dark cyberpunk, sem “dashboard genérico” na landing |

---

## 16. Variáveis de ambiente

Cliente e servidor devem apontar para o **mesmo** projeto Supabase (`VITE_*` alinhado a `SUPABASE_*`).

| Variável | Onde | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Client + server | API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Client + server | Anon key |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | Client + server | Ref do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin / inserts privilegiados |
| `OPENROUTER_API_KEY` | Server | Charlie |
| `OPENROUTER_MODEL` | Server (opcional) | Override de modelo |
| `CRON_SECRET` | Edge jobs | Auth do cron |
| `TELEGRAM_BOT_TOKEN` | Server / Edge | Bot API |
| `TELEGRAM_BOT_USERNAME` | Server | Deep link |
| `TELEGRAM_WEBHOOK_SECRET` | Edge webhook | Validação Telegram |
| `APP_PUBLIC_URL` | Server | Links em mensagens Telegram |

Modelo: `.env.example`.  
`.env` **não** deve ser commitado...

No **Vercel**, as mesmas variáveis precisam estar em Environment Variables (Production), e `VITE_*` precisam existir no **build**.

---

## 17. Deploy e operação

### App (Vercel)

- Build: `npm run build` → Nitro preset `vercel` → `.vercel/output`
- `postinstall`: `patch-package` reaplica patch do Router
- Domínio atual: `https://v-project-rho.vercel.app`
- Auth Supabase: Site URL + Redirect URLs devem incluir a URL Vercel

### Edge Functions (Supabase)

```bash
npx supabase functions deploy notification-jobs ml-features-job \
  agent-initiatives-job telegram-webhook \
  --project-ref gmzddccyikpxbiozsiue --no-verify-jwt --use-api
```

Functions ativas no projeto: só essas quatro (leftovers Lovable removidos).

### Banco

1. Preferir schema canônico no SQL Editor: `20260717004140_complete_schema.sql`
2. Se o Vault ainda não tiver o secret do cron:
   ```sql
   select vault.create_secret('SEU_CRON_SECRET', 'notification_jobs_cron_secret');
   ```
   e reexecutar os schedules (notifications / ml-features / agent) — **sem** recriar `pg_cron` se já existir (erro `2BP01`)
3. Migrations incrementais: clima, missões, ML fases 1–4 (`20260727150000_*` … `20260727171000_*`)
4. `setWebhook` do Telegram com `secret_token` alinhado a `TELEGRAM_WEBHOOK_SECRET`

### Dev local

```bash
npm install
# configurar .env (ver .env.example)
npm run dev
npm run test:ml   # fixtures heuristic + adaptive + agent/CF
```

ML Python (Fase 2):

```bash
cd ml
py -3 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m vproject_ml train
python -m vproject_ml evaluate
```

---

## 18. O que funciona vs. lacunas

### Funciona hoje

- Auth (e-mail + Google), onboarding com gate real (UI + server)
- Hábitos, metas, XP, níveis, streak, atributos
- **Engine de progresso:** avanço automático de capítulo + unlock de conquistas (+ XP bônus)
- **Missões de capítulo** (principal/secundária) com progresso ao concluir hábitos
- **Histórico de atividade** no perfil
- **Sugestão de hábitos** via Charlie/OpenRouter (com fallback) no onboarding e em `/habits`
- Charlie (chat, presença, memórias, desafios, clima opcional, **sinais ML**, check-ins)
- **ML Fases 1–4:** feature store, scores, adaptive notifs/desafios, sklearn shadow, check-ins, agente, CF
- Wallpapers desbloqueáveis (inclui após subir de capítulo)
- Notificações in-app + jobs diários (3 crons de produto + webhook)
- Telegram (vínculo + opt-in + espelho, incl. iniciativas do agente)
- Deploy Vercel + Supabase Edge

### Ainda não / incompleto

| Item | Situação |
| --- | --- |
| Upload de avatar | Coluna existe; fluxo incompleto |
| Push / e-mail / WhatsApp | Não |
| Promoção sklearn → Charlie | Shadow only; exige AUC real + decisão humana |
| CF com N pequeno | Sem peers suficientes, não inventa sugestões |

> Missões: migration `supabase/migrations/20260727150103_missions.sql`.  
> ML: migrations `20260727150000_ml_feature_store.sql` … `20260727171000_schedule_agent_initiatives_job.sql`.

---

## 19. Arquivos mais importantes

| Assunto | Onde |
| --- | --- |
| Níveis / categorias | `src/lib/journey.ts` |
| Capítulos / gate onboarding | `src/lib/chapters.ts` |
| Engine progresso | `src/lib/progress-engine.ts` |
| Missões | `src/lib/missions-core.ts`, `missions.functions.ts` |
| Hábitos IA | `src/lib/habit-suggest.ts` |
| Jornada server | `src/lib/journey.functions.ts` |
| Check-ins | `src/lib/checkins.functions.ts`, `src/components/CheckinCard.tsx` |
| ML (TS) | `src/lib/ml/*` |
| ML (Python) | `ml/vproject_ml/*` |
| Perfil / panorama | `src/lib/profile.functions.ts` |
| Charlie | `src/mentor/*` |
| Notificações / Telegram | `src/notifications/*` |
| Wallpapers | `src/lib/wallpapers.ts` |
| Clima | `src/lib/weather.ts` |
| Schema | `supabase/migrations/20260717004140_complete_schema.sql` |
| Edge jobs | `supabase/functions/{notification-jobs,ml-features-job,agent-initiatives-job}/` |
| Edge webhook | `supabase/functions/telegram-webhook/` |
| Patch Router | `patches/@tanstack+react-router+1.170.18.patch` |

---

## 20. Glossário rápido

| Termo | Significado |
| --- | --- |
| **Herói** | Usuário autenticado |
| **Charlie** | Mentor IA |
| **Jornada** | Dashboard principal pós-login |
| **Streak** | Sequência de dias com hábitos feitos |
| **Desafio** | Missão temporária criada pelo Charlie |
| **Missão** | Objetivo de arco/capítulo (tabela `missions`) |
| **SINAIS ML** | Scores persistidos no contexto do Charlie |
| **Shadow** | Predição sklearn não usada em produção |
| **Iniciativa** | Ação sugerida pelo agente (não cria desafio sozinha) |
| **Check-in** | Sono / energia / humor do dia |
| **Sino** | UI de notificações in-app |
| **Server function** | RPC TanStack Start (server) chamada do client |
| **Service role** | Chave admin Supabase (nunca no browser) |

---

## 21. Documentos relacionados

| Arquivo | Conteúdo |
| --- | --- |
| `README.md` | Setup, features, env |
| `plans/ML-fase-1.md` … `ML-fase-4.md` | Feature store → preditivo → adaptativo → agente |
| `PlanejamentoLacunas.md` | Plano das lacunas (histórico) |
| `PlanejamentoNotificacoes.md` | Plano de notificações (fases de canal) |
| `PlanejamentoTelegram.md` | Plano do canal Telegram |
| `plans/Charlie-fase-1.md` / `upgrade-Charlie.md` | Evolução do mentor |

---

*Documento único de referência (produto + engenharia). Ao mudar features relevantes, atualize as seções 2, 6–13, 16–18 e 8b.*