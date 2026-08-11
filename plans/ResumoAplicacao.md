# ResumoAplicacao — V-Project

Documento único para compreender **o que a aplicação é**, **como funciona**, **como está construída** e **o que ainda não faz**.  
Alinhado ao código do repositório `hero-s-ascent` (agosto 2026 — ML Fases 1–4, Web Push, exercícios validados, metas enriquecidas, loja Charlie, **Capacitor Android**, **Charlie Call / despertador**, **xadrez ritual**, **XP fixo de hábitos**).

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
4. Completa hábitos **declarados** → ganha **XP**, sobe de **nível**, mantém **streak**, fortalece **atributos**
5. Pode validar **flexões** com câmera ao vivo (pose on-device, sem gravar vídeo) → XP híbrido por sessão
6. Conversa com o mentor **Charlie** (IA), que pode criar **desafios**, **sugerir hábitos** e acompanhar **metas**
7. Escolhe a **personalidade** do Charlie na loja (`/store`) — vitrine pronta para produtos futuros
8. Personaliza o app com **fundos de tela** desbloqueáveis
9. Recebe **notificações in-app** (sino), opcionalmente **Web Push** e **Telegram** (`@DashiVProject_bot`)
10. Pode informar a **cidade/região** no perfil; o Charlie usa o **clima local** (Open-Meteo) no contexto da conversa
11. Registra **check-in** diário (sono/energia/humor) na Jornada — sinais reais para o Charlie e para o agente
12. Camada de **ML** (features + scores + jobs) alimenta lembretes, desafios e iniciativas com guardrails
13. No **Android (Capacitor)** pode agendar o **despertador do Charlie** (ligação in-app + ritual matinal)
14. No **Modo foco** do mentor, joga **xadrez** com o Charlie (partida pausável; resultado entra no contexto da IA)
15. XP de hábitos **declarados** é **fixo** (default 15, ajustável em `app_settings` / Dashi) — anti-farm

Não é uma rede social. É um app individual de progresso, ritmo diário e mentoria.

---

## 2. Experiência do usuário (fluxo ponta a ponta)

```text
Landing (/)
  → Auth (/auth)  — login / cadastro / Google
  → Trigger Supabase cria profiles + attributes + user_roles
  → /journey  — dashboard: nível, XP, streak, hábitos, **alter ego**, card do Charlie, check-in
       → se onboarding incompleto → /onboarding
  → /habits  — CRUD + concluir (declarados) + card Exercício validado
  → /exercises/pushup — sessão de flexão (câmera + pose on-device)
  → /goals   — metas (norte, prazo, progresso, vínculo com hábitos)
  → /identity — Alter Ego do herói (código, virtudes; ≠ personalidade do Charlie) — ver `plans/alter-ego.md`
  → /mentor  — chat Charlie, presença, desafios, sugestões, xadrez (modo foco), sinais ML
  → /store   — loja de personalidades do Charlie (ativação real do tom)
  → /profile — identidade, atributos, cidade, wallpaper, Telegram, Web Push, despertador (nativo)
  → /alarm/ritual — briefing pós-atendimento do despertador → Jornada
  → sino (notificações) + crons diários (lembretes / ML features / agente)
  → APK Capacitor (Live URL) — mesmo produto web + bridges (push nativo, Charlie Call)
  → /dashitecnology/* — control room (role `dashi`; Charlie Alarm, XP de hábitos…)
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
| `/journey` | Dashboard: nível, XP, streak, hábitos **declarados** do dia, **alter ego**, check-in, atributos, entrada para Charlie |
| `/habits` | CRUD de hábitos declarados (título, **detalhes/descrição**, XP fixo do sistema) + card exercício validado + sugerir com Charlie |
| `/exercises/$slug` | Sessão validada (MVP: `pushup`) — câmera ao vivo, calibração, contagem por pose |
| `/goals` | Metas com status, motivo, prazo, norte, progresso 7d e vínculo com hábitos |
| `/identity` | Alter Ego do herói (criar/editar/regenerar código) — ver [`plans/alter-ego.md`](alter-ego.md) |
| `/mentor` | Chat com Charlie; **xadrez** no Modo foco; link **Configurar Personalidade** → `/store` |
| `/store` | Loja de personalidades (cards cyberpunk); confirmar ativa `profiles.charlie_personality` |
| `/profile` | Perfil, radar, ritmo, troféus, localização/clima, wallpapers, Telegram, Web Push / push nativo, **despertador** |
| `/alarm/ritual` | Ritual pós-Charlie Call (briefing + LEVANTEI → `/journey`) — aberto pelo shell nativo |
| `/onboarding` | Escolha de categorias + metas iniciais |

### Control room (`/dashitecnology`)

Acesso: role `dashi` em `user_roles`. Visão operacional (heróis, jobs, ML, agente, notificações, **Charlie Alarm**, gamificação…).  
Em `/dashitecnology/users/$userId`, **Limpar histórico completo** apaga `exercise_sessions`, **`goals`** (hábitos.goal_id → NULL) e o restante do histórico — mantém conta, nome e hábitos cadastrados.  
`/dashitecnology/charlie-alarm` — flags globais do despertador + smoke do ritual.

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
| Pose (exercícios) | MediaPipe PoseLandmarker (`@mediapipe/tasks-vision`) — **só no device**, sem upload de vídeo |
| Xadrez | `chess.js` + `react-chessboard` + engine local raso (`src/mentor/chess-engine.ts`) |
| Clima | Open-Meteo (geocoding + forecast, sem API key) |
| Push | Web Push (VAPID) + **push nativo** no Capacitor (FCM) |
| Mobile | **Capacitor** Android (`android/`); Live URL → produção; iOS ainda não |
| Charlie Call | Plugin nativo + AlarmManager; ringtones `classic` / `warrior` / `calm` |
| Deploy | Vercel (Nitro preset `vercel` em `vite.config.ts`); APK via `cap:build:apk` |
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
      exercises.$slug.tsx      # Sessão de exercício validado
      store.tsx                # Loja de personalidades do Charlie
    dashitecnology/            # Control room (role dashi)
  mentor/                      # Charlie (UI, context, OpenRouter, functions)
    chess-context.ts           # Resumo de partidas → prompt do mentor
    chess.functions.ts         # Persistência charlie_chess_games
    chess-engine.ts            # Minimax raso (adversário local)
    CharlieChessModal.tsx      # UI fullscreen (tap-to-move)
  notifications/               # Sino, CRUD, create, jobs, Telegram, Web Push + nativo
  admin/                       # Server fns da control room
  lib/
    journey.ts                 # Níveis, categorias, frases (puro)
    journey.functions.ts       # Server fns jornada / hábitos / metas (+ recompute ML)
    habit-xp.ts                # XP fixo de hábitos (app_settings.habit_xp_reward)
    goals.functions.ts         # Board de metas + completar/vincular hábitos
    mentor-goals.ts            # Bloco METAS DO HERÓI para o Charlie
    charlie-store.ts           # Imagens / preço display da loja
    charlie-call/              # Despertador / Charlie Call (client + server fns)
    platform.ts                # Guards Capacitor.isNativePlatform()
    exercise.functions.ts      # Sessões validadas (start/complete/cancel)
    exercise-xp.ts             # XP híbrido da sessão
    exercise/                  # Pose: framing, calibração, counter, overlay, MediaPipe
    useExerciseCamera.ts       # getUserMedia (sem gravação)
    journey-queries.ts         # React Query options
    profile.functions.ts       # Panorama do perfil
    checkins.functions.ts      # Check-in diário (sono/energia/humor)
    ml/                        # Feature store, adaptive, agent, CF
    wallpapers.ts              # Catálogo + regras de unlock
    wallpaper-storage.ts       # Preferência local + evento
    weather.ts                 # Open-Meteo (server)
    safe-query.ts              # Normaliza erros de query
  components/
    CheckinCard.tsx            # UI check-in na Jornada
    ExerciseSessionCameraModal.tsx  # Modal câmera + coaching de pose
    ui/                        # shadcn
  integrations/supabase/       # Client, admin, auth middleware, types
  styles.css                   # Tokens cyberpunk + utils
ml/                            # Pacote Python Fase 2 (train / evaluate / score-shadow)
android/                       # Projeto Capacitor Android (+ plugin CharlieCall)
plans/
  ML-fase-1.md … ML-fase-4.md  # Roadmap ML canônico
  ExerciciosValidados-Flexao.md
  PlanejamentoMobile-Capacitor.md
  Charlie-Call-Nativo.md / Charlie-Despertador.md / Charlie-xadrez.md
public/                        # logo, charlie, wallpapers, animate-icons, charlie-versions, icons/chess.png
supabase/
  migrations/                  # Schema + incrementais (ML, exercícios, metas, alarmes, xadrez, XP)
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

Dias consecutivos com hábitos concluídos. Atualizado em `completeHabit` (declarados) e ao completar sessão validada com XP.  
Há notificação de **risco de streak** (`streak_risk`) via job diário.

### Categorias de foco

Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito.

### Capítulos e conquistas

Tabelas seed (`chapters`, `achievements`, `user_achievements`) + engine em `progress-engine.ts`:

- avanço de capítulo e unlock de conquistas ao progredir (hábitos / XP / missões)
- UI de troféus no perfil
- missões de capítulo (`missions`) com progresso ao concluir hábitos

### Hábitos e metas

Dois modos de hábito:

| Tipo | Como conclui | XP |
| --- | --- | --- |
| **Declarado** | Check manual em `/habits` ou `/journey` | **XP fixo** do sistema (`app_settings.habit_xp_reward`, default **15**, faixa 5–50) — server enforce; Dashi ajusta |
| **Validado** (`habits.exercise_type_id`) | Sessão em `/exercises/$slug` | XP híbrido da sessão (base + por rep × forma, com teto e cap diário) |

- Hábitos declarados: título, **descrição/detalhes**, atributo, categoria, ativo, opcional `goal_id` (campo `xp_recompensa` legado não manda no check)
- Helper: `src/lib/habit-xp.ts` (`resolveHabitXpReward`)
- Conclusões declaradas: 1 por hábito por dia (`habit_completions`)
- `completeHabit` **bloqueia** hábitos com `exercise_type_id` (obriga a sessão)
- Charlie pode propor `habit_suggestion` no mentor (aceitar → cria hábito; recusar → descarta)
- Em `/habits`, **Sugerir com Charlie** usa o ícone `/charlie-ico.ico`; UI **Detalhes** edita `habits.descricao`

**Metas enriquecidas** (`/goals`, migration `20260802010000_goals_enrichment.sql`):

| Campo / peça | Detalhe |
| --- | --- |
| Status | `ativa` · `pausada` · `concluida` |
| Motivo | Texto curto (“por quê importa”) |
| Prazo | Data opcional; UI sinaliza atraso |
| Norte | Até 3 metas destaque (`is_norte`) |
| Progresso 7d | % de hábitos vinculados concluídos na semana |
| Vínculo | `habits.goal_id` → meta (ON DELETE SET NULL) |
| Conquistar | Marca concluída + XP (`xp_recompensa`, default 40) + memória no Charlie |
| Server | `src/lib/goals.functions.ts` (board, CRUD, link, complete) |

Onboarding ainda cria as primeiras via `setGoals` (título + categoria).

### Exercícios validados (MVP: flexão)

Doc: `plans/ExerciciosValidados-Flexao.md`.

| Peça | Detalhe |
| --- | --- |
| Catálogo | `exercise_types` (seed `pushup`) — global, igual para todos |
| Sessão | `exercise_sessions` + `exercise_session_metrics` |
| UI | Card em `/habits` → `/exercises/pushup` → modal de câmera |
| Pipeline | `getUserMedia` → MediaPipe Pose → framing → calibração (~3s) → contagem |
| Coaching | Cues ao vivo (profundidade, lockout, alinhamento) + guia + skeleton; **sem gravar/enviar vídeo** |
| XP | `exercise-xp.ts` — híbrido; cancelar / 0 reps → sem XP |
| Privacidade | Consentimento na página; processamento só no device |

### Activity history

Tabela `activity_history` recebe writes (hábitos, desafios, sessões de exercício, etc.). Histórico visível no panorama do perfil.

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
| Sugestão de hábito | Tipagem `habit_suggestion` no mentor — aceitar cria o hábito |
| Metas | Bloco `METAS DO HERÓI` (`src/lib/mentor-goals.ts`) — nortes, prazo, ritmo 7d |
| Personalidade | `profiles.charlie_personality` — escolhida na **loja** `/store` (não modal) |
| Sinais ML | Bloco `SINAIS ML` no contexto (`user_ml_scores` / `heuristic_v1`) |
| Check-ins | Sono/energia/humor só se o herói registrou; senão o prompt proíbe inventar |
| **Xadrez (ritual)** | Ícone só no **Modo foco**; modal fullscreen; FEN/PGN em `charlie_chess_games`; pause/resume; tap-to-move |
| Contexto xadrez | Resumo enxuto (último resultado, 7d/30d, sequência V-D-E-A, ritual) via `chess-context.ts` — **sem** Elo/abertura/FEN no prompt |
| **Despertador** | Agenda no device (Capacitor); tela full-screen + ringtone `STREAM_ALARM`; ritual `/alarm/ritual` |
| IA | OpenRouter (`OPENROUTER_API_KEY`, modelo configurável) |
| Clima | Se o perfil tem lat/lon, o contexto inclui snapshot Open-Meteo |

Concluir desafio → XP + activity + notificação `mentor_challenge_done`.  
Expiração → status `expirado` + notificação `mentor_challenge_expired` (lazy no mentor e/ou job global).  
Conquistar meta → memória no mentor + XP.

### Loja de personalidades (`/store`)

- CTA no mentor: **Configurar Personalidade do Charlie** → `/store`
- Vitrine com cards `cp-panel` / `cp-brackets`; arte em `public/charlie-versions/`
- Confirmar chama `setCharliePersonality` e grava o tom real
- Preço de vitrine **Grátis** por enquanto (`charlie-store.ts`); pagamento / inventário ainda não existem
- Slugs: classico, militar, estoico, empresarial, cristao, fitness, financeiro

### Charlie × Xadrez

- Motor local raso (não API externa); 1 partida aberta (`active`/`paused`) por usuário
- Status finais: `won` | `lost` | `draw` (+ `result_reason`, ex. `abandoned`)
- Charlie **não** vira coach de abertura: o prompt só usa tom (paciência / presença)
- Docs: `plans/Charlie-xadrez.md` (produto); código em `src/mentor/chess*`

### Charlie Call / Despertador (Android MVP)

- Preferências em `charlie_alarms` + ringtones (`classic` | `warrior` | `calm`) no perfil / Dashi
- Plugin Capacitor `CharlieCall` + Activity full-screen (lock screen)
- Ao atender → `/alarm/ritual` → **LEVANTEI** → `/journey`
- Web: UI de preferências pode existir; **alarme confiável só no APK**
- Docs: `plans/Charlie-Call-Nativo.md`, `plans/Charlie-Despertador.md`, `plans/PlanejamentoMobile-Capacitor.md`

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

## 8c. Mobile (Capacitor Android)

Doc canônico: `plans/PlanejamentoMobile-Capacitor.md`.

| Peça | Detalhe |
| --- | --- |
| Princípio | Web = fonte da verdade; Capacitor = container + bridges (`platform.ts`) |
| Entrega | APK com **Live URL** → produção Vercel (`…/journey`) |
| Auth | E-mail/senha no WebView; Google via Custom Tabs + deep link |
| Push | Tokens nativos + Web Push no browser |
| Flexão | MediaPipe no device — validado no APK |
| Charlie Call | MVP Android feito (alarme + ritual); iOS / Core-Telecom = depois |
| Scripts | `cap:sync`, `cap:open:android`, `cap:build:apk` / `cap:build:aab` |

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

## 11. Notificações in-app e Web Push

### UI

- `NotificationBell` no header autenticado
- Sheet lateral: filtros Todas / Não lidas, marcar lida / marcar todas
- Error boundary no sino (falha não derruba o layout)
- **Web Push** (VAPID): opt-in no perfil; entrega em background quando o browser permite

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

## 12b. Discord

| Peça | Detalhe |
| --- | --- |
| Bot | `Charlie` (Application ID em `DISCORD_APPLICATION_ID`) |
| UI vínculo | `DiscordSettingsCard` em `/profile` |
| Vínculo | Perfil → código one-time → DM `/vincular` |
| Webhook | `discord-webhook`; assinatura Ed25519 (`DISCORD_PUBLIC_KEY`) |
| Opt-in | `profiles.discord_opt_in` |
| Create + espelho | `src/notifications/create.ts` + `discord.ts` (+ `notification-jobs`) |
| Admin | `/dashitecnology/discord` |

**Tipos espelhados:** mesmos do Telegram. Canal: **só DM** (MVP).

---

## 13. Modelo de dados (Supabase)

| Tabela | Papel |
| --- | --- |
| `profiles` | Herói (XP, streak, capítulo, wallpaper, telegram, localização, `charlie_personality`…) |
| `attributes` | 8 atributos |
| `levels` / `chapters` / `achievements` | Seeds de catálogo |
| `user_achievements` | Conquistas desbloqueadas |
| `missions` | Missões de capítulo |
| `goals` | Metas (status, motivo, prazo, norte, XP ao concluir) |
| `habits` | Hábitos (declarados ou validados via `exercise_type_id`; opcional `goal_id`) |
| `habit_completions` | Check diário (hábitos declarados) |
| `exercise_types` | Catálogo global de exercícios validados (seed: flexão) |
| `exercise_sessions` | Sessões (active / completed / cancelled / rejected) |
| `exercise_session_metrics` | Reps, amplitude, forma, duração… |
| `activity_history` | Log de XP/eventos |
| `user_roles` | `dashi` (control room) / `user` (legado: `admin` no enum, não usado pelo app) |
| `mentor_*` | Mensagens, memórias, desafios, objetivos |
| `notifications` | Centro in-app |
| `telegram_link_codes` | Códigos one-time |
| `discord_link_codes` | Códigos one-time Discord |
| `user_features` | Feature store ML (Fase 1) |
| `user_ml_scores` | Scores produção `heuristic_v1` → Charlie |
| `user_ml_scores_shadow` | Scores sklearn (shadow, Fase 2) |
| `ml_model_runs` | AUC / metadados de treino |
| `user_checkins` | Sono / energia / humor (Fase 4) |
| `agent_initiatives` | Iniciativas do agente |
| `user_cf_recommendations` | Sugestões CF (weekday peers) |
| `app_settings` | Flags/config (ex.: `habit_xp_reward`, flags do despertador) |
| `charlie_alarms` | Preferências do despertador por usuário (horário, ringtone, enabled) |
| `charlie_chess_games` | Partidas Charlie × herói (FEN/PGN, status, resultado) |

Schema base: `supabase/migrations/20260717004140_complete_schema.sql`  
(+ migrations incrementais: notificações, Telegram, wallpaper, clima, missões, **ML fases 1–4**, **exercícios** `20260801134500_*`, **metas** `20260802010000_*`, **alarmes** `20260808030000_*` / ringtone `20260808120000_*`, **XP fixo** `20260809190000_habit_xp_fixed.sql`, **xadrez** `20260809210000_charlie_chess_games.sql`).

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
| `DISCORD_BOT_TOKEN` | Server / Edge | Bot API Discord |
| `DISCORD_PUBLIC_KEY` | Edge webhook | Assinatura Interactions |
| `DISCORD_APPLICATION_ID` | Server | Deep link / commands |
| `DISCORD_BOT_USERNAME` | Server | UI (`Charlie`) |
| `APP_PUBLIC_URL` | Server | Links em mensagens Telegram/Discord |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Server | Web Push |
| `VITE_VAPID_PUBLIC_KEY` | Client (opcional) | Fallback público VAPID no build |
| `SUPABASE_TOKEN` | Local / CLI (opcional) | Access token Supabase CLI / ops — **não** no browser |

Modelo: `.env.example`.  
`.env` **não** deve ser commitado.

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
  agent-initiatives-job telegram-webhook discord-webhook \
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
3. Migrations incrementais: clima, missões, ML fases 1–4, exercícios (`20260801134500_*`), metas (`20260802010000_*`), alarmes (`20260808030000_*`), XP fixo (`20260809190000_*`), xadrez (`20260809210000_*`)
4. `setWebhook` do Telegram com `secret_token` alinhado a `TELEGRAM_WEBHOOK_SECRET`

### Dev local

```bash
npm install
# configurar .env (ver .env.example)
npm run dev
npm run test:ml   # fixtures heuristic + adaptive + agent/CF + chess-context
```

APK Android (Capacitor):

```bash
npm run cap:sync
npm run cap:build:apk   # ou cap:open:android
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

- Auth (e-mail + Google), onboarding com gate real (UI + server); Google no Capacitor via Custom Tabs
- Hábitos **declarados** (detalhes/descrição), **XP fixo** (default 15), níveis, streak, atributos
- **Metas enriquecidas** (`/goals`): status, motivo, prazo, norte, progresso 7d, vínculo com hábitos, XP ao conquistar
- **Exercícios validados (flexão):** câmera + pose on-device (também no APK) + XP híbrido
- **Engine de progresso:** avanço automático de capítulo + unlock de conquistas (+ XP bônus)
- **Missões de capítulo** (principal/secundária) com progresso ao concluir hábitos
- **Histórico de atividade** no perfil
- **Sugestão de hábitos** via Charlie (onboarding, `/habits`, tipagem no `/mentor`)
- Charlie (chat, presença, memórias, desafios, **METAS DO HERÓI**, clima opcional, **sinais ML**, check-ins, **xadrez ritual + contexto**)
- **Charlie Call / despertador** (MVP Android): alarme + ringtone + ritual `/alarm/ritual`
- **Loja `/store`:** personalidades do Charlie com ativação real do tom
- **ML Fases 1–4:** feature store, scores, adaptive notifs/desafios, sklearn shadow, check-ins, agente, CF
- **Capacitor Android** (Live URL + bridges); wallpapers; flame GIF no streak
- Notificações in-app + **Web Push** + **push nativo** + jobs diários + Telegram
- **Control room** `/dashitecnology` (role `dashi`); Charlie Alarm; limpeza apaga sessões, **metas** e histórico (mantém hábitos)
- Deploy Vercel + Supabase Edge

### Ainda não / incompleto

| Item | Situação |
| --- | --- |
| Upload de avatar | Coluna existe; fluxo incompleto |
| Push e-mail / WhatsApp | Não (Web Push, push nativo e Telegram já existem) |
| Mais exercícios validados | Só flexão no MVP; agachamento/prancha no plano |
| Resumo pós-sessão dedicado | Encerrar → XP popup; tela de resumo rica ainda no plano |
| Charlie com histórico de flexões | Métricas persistidas; injeção no contexto ainda no plano (Fase 3 do doc de exercícios) |
| Pagamento / inventário da loja | Vitrine + ativação grátis; checkout e ownership ainda não |
| Produtos além de personalidade | `/store` preparado como vitrine; só personalidades hoje |
| Promoção sklearn → Charlie | Shadow only; exige AUC real + decisão humana |
| CF com N pequeno | Sem peers suficientes, não inventa sugestões |
| Capacitor iOS | Fora do MVP; Charlie Call / CallKit depois |
| Despertador na web pura | Preferências possíveis; alarme confiável só no shell nativo |
| Xadrez “pro” | Sem Elo, multiplayer, análise de abertura ou ranking social (de propósito) |

> Missões: migration `supabase/migrations/20260727150103_missions.sql`.  
> ML: migrations `20260727150000_ml_feature_store.sql` … `20260727171000_schedule_agent_initiatives_job.sql`.  
> Exercícios: `20260801134500_validated_exercises_pushup.sql`.  
> Metas: `20260802010000_goals_enrichment.sql`.  
> Alarmes: `20260808030000_charlie_alarms.sql` (+ ringtone keys).  
> XP fixo: `20260809190000_habit_xp_fixed.sql`.  
> Xadrez: `20260809210000_charlie_chess_games.sql`.

---

## 19. Arquivos mais importantes

| Assunto | Onde |
| --- | --- |
| Níveis / categorias | `src/lib/journey.ts` |
| Capítulos / gate onboarding | `src/lib/chapters.ts` |
| Engine progresso | `src/lib/progress-engine.ts` |
| Missões | `src/lib/missions-core.ts`, `missions.functions.ts` |
| Hábitos IA | `src/lib/habit-suggest.ts` |
| Metas | `src/lib/goals.functions.ts`, `src/routes/_authenticated/goals.tsx` |
| Metas → Charlie | `src/lib/mentor-goals.ts` |
| Loja Charlie | `src/routes/_authenticated/store.tsx`, `src/lib/charlie-store.ts` |
| XP fixo hábitos | `src/lib/habit-xp.ts` |
| Xadrez | `src/mentor/chess*.ts(x)`, `chess-context.ts` |
| Charlie Call | `src/lib/charlie-call/*`, `src/routes/alarm.ritual.tsx` |
| Platform / Capacitor | `src/lib/platform.ts`, `android/` |
| Exercícios / pose | `src/lib/exercise.functions.ts`, `exercise-xp.ts`, `src/lib/exercise/*` |
| Modal de sessão | `src/components/ExerciseSessionCameraModal.tsx` |
| Jornada server | `src/lib/journey.functions.ts` |
| Check-ins | `src/lib/checkins.functions.ts`, `src/components/CheckinCard.tsx` |
| ML (TS) | `src/lib/ml/*` |
| ML (Python) | `ml/vproject_ml/*` |
| Perfil / panorama | `src/lib/profile.functions.ts` |
| Charlie | `src/mentor/*` |
| Notificações / Telegram / Push | `src/notifications/*` |
| Control room | `src/admin/*`, `src/routes/dashitecnology/*` |
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
| **Hábito declarado** | Conclusão manual (check) |
| **Hábito validado** | Exige sessão de exercício (ex.: flexão) |
| **Norte** | Meta destaque (máx. 3); guia o foco da jornada |
| **Sessão** | Execução com câmera + métricas persistidas (sem vídeo) |
| **Loja** | `/store` — personalidades do Charlie (vitrine + ativação) |
| **Xadrez ritual** | Partida com o Charlie no Modo foco; contexto enxuto no prompt |
| **Despertador / Charlie Call** | Alarme nativo + tela de chamada + ritual matinal |
| **XP fixo** | Recompensa única de hábitos declarados (`habit_xp_reward`) |
| **Sino** | UI de notificações in-app |
| **Web Push** | Notificação do browser (VAPID), opt-in no perfil |
| **Capacitor** | Shell Android que embute o app web + plugins nativos |
| **dashi** | Role de admin da control room |
| **Server function** | RPC TanStack Start (server) chamada do client |
| **Service role** | Chave admin Supabase (nunca no browser) |

---

## 21. Documentos relacionados

| Arquivo | Conteúdo |
| --- | --- |
| `README.md` | Setup, features, env |
| `plans/ExerciciosValidados-Flexao.md` | Plano + checklist da flexão validada |
| `plans/ML-fase-1.md` … `ML-fase-4.md` | Feature store → preditivo → adaptativo → agente |
| `plans/PlanejamentoMobile-Capacitor.md` | Shell Android, bridges, roadmap mobile |
| `plans/Charlie-Call-Nativo.md` | Ligação in-app / plugin nativo |
| `plans/Charlie-Despertador.md` | Despertador do mentor |
| `plans/Charlie-xadrez.md` | Ritual de xadrez (produto) |
| `PlanejamentoLacunas.md` | Plano das lacunas (histórico) |
| `PlanejamentoNotificacoes.md` | Plano de notificações (fases de canal) |
| `PlanejamentoTelegram.md` | Plano do canal Telegram |
| `plans/Charlie-fase-1.md` / `upgrade-Charlie.md` | Evolução do mentor |

---

*Documento único de referência (produto + engenharia). Ao mudar features relevantes, atualize as seções 2, 6–13, 16–18, 8b e 8c.*