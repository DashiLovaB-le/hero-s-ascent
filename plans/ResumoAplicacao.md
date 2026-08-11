# ResumoAplicacao — V-Project

Documento único para compreender **o que a aplicação é**, **como funciona**, **como está construída** e **o que ainda não faz**.  
Alinhado ao código do repositório `hero-s-ascent` (**agosto 2026** — ML Fases 1–4, Web Push, **6 exercícios** MediaPipe + hub Fitness, metas enriquecidas, loja Charlie, Capacitor Android, Charlie Call / despertador, xadrez ritual, XP fixo, **Alter Ego Fases 1–3**, **Discord**, relatório evening `identity_report`).

| Campo | Valor |
| --- | --- |
| **Nome do produto** | V-Project |
| **Repo / pasta** | `hero-s-ascent` |
| **Idioma da UI** | Português (Brasil) |
| **Público** | Desenvolvimento masculino gamificado |
| **Metáfora** | Jornada do Herói |
| **Backend** | Supabase projeto `gmzddccyikpxbiozsiue` (Vproject) |
| **Produção** | Vercel — `https://v-project-rho.vercel.app` |
| **Schema canônico** | `supabase/migrations/20260717004140_complete_schema.sql` + migrations incrementais |

---

## 1. O que é o produto

O **V-Project** transforma autodisciplina em uma jornada gamificada. O herói:

1. Entra na conta (e-mail/senha ou Google)
2. Faz onboarding (áreas de foco + primeiras metas + **Alter Ego** — “próxima versão”)
3. Cria hábitos diários ligados a atributos
4. Completa hábitos **declarados** → ganha **XP**, sobe de **nível**, mantém **streak**, fortalece **atributos** + **prova de identidade**
5. Valida exercícios com câmera (MediaPipe on-device: flexão, agachamento, prancha, afundo, abdominal, elevação de quadril) e/ou treinos no hub **Fitness**
6. Conversa com o mentor **Charlie** (IA), que pode criar **desafios**, **sugerir hábitos** e acompanhar **metas** — como **guardião do Alter Ego** (não é o alter ego)
7. Escolhe a **personalidade** do Charlie na loja (`/store`) — vitrine pronta para produtos futuros
8. Personaliza o app com **fundos de tela** desbloqueáveis
9. Recebe **notificações in-app** (sino), **Web Push**, **push nativo**, **Telegram** (`@DashiVProject_bot`) e **Discord** (DM do bot Charlie)
10. Informa **cidade/região** no perfil; o Charlie usa o **clima local** (Open-Meteo)
11. Registra **check-in** diário (sono/energia/humor + **“agiu como a identidade?”**) na Jornada
12. Camada de **ML** (features + scores + aderência à identidade + jobs) alimenta lembretes, desafios, iniciativas e o relatório evening
13. No **Android (Capacitor)** agenda o **despertador do Charlie** (ligação in-app + ritual matinal)
14. No **Modo foco** do mentor, joga **xadrez** com o Charlie
15. XP de hábitos **declarados** é **fixo** (default 15, ajustável em `app_settings` / Dashi)

Loop psicológico desejado:

> **Identidade → Compromisso → Ação → Prova → Reforço → Evolução**

Não é uma rede social. É um app individual de progresso, ritmo diário, identidade e mentoria.

---

## 2. Experiência do usuário (fluxo ponta a ponta)

```text
Landing (/)
  → Auth (/auth)  — login / cadastro / Google
  → Trigger Supabase cria profiles + attributes + user_roles
  → /journey  — dashboard: nível, XP, streak, hábitos, Alter Ego, check-in, Charlie
       → se onboarding incompleto → /onboarding (foco + metas + Alter Ego)
  → /habits  — CRUD + concluir (declarados) + card exercício / Fitness
  → /fitness — hub de exercícios + templates de treino
  → /exercises/$slug — sessão validada (câmera + pose)
  → /exercises/ranking — ranking de sessões
  → /goals   — metas (norte, prazo, progresso, vínculo com hábitos)
  → /identity — Alter Ego + histórico de provas
  → /mentor  — chat Charlie, presença morning/evening, desafios, xadrez, SINAIS ML
  → /store   — loja de personalidades do Charlie
  → /profile — atributos, cidade, wallpaper, Telegram, Discord, Web Push, despertador
  → /alarm/ritual — briefing pós-despertador → Jornada
  → sino + crons (lembretes / identity_report / ML / agente)
  → APK Capacitor — mesmo produto + bridges nativas
  → /dashitecnology/* — control room (role dashi)
```

### Telas públicas

| Rota | Função |
| --- | --- |
| `/` | Landing: brand, hero, pilares, CTA |
| `/auth` | Login, cadastro, Google OAuth |
| `/sobre` | Página institucional |
| `/parceiros` | Afiliados / parceiros |
| `/obrigado` | Pós-compra (Kiwify) — **sem gate de assinatura no app ainda** |
| `/maintenance` | Manutenção |

### Telas autenticadas (shell `/_authenticated`)

Layout compartilhado:

- Header: logo, nav desktop, **NotificationBell**, logout
- Bottom nav mobile + botão central do Charlie
- Wallpaper de fundo (preferência do perfil)
- `beforeLoad`: valida sessão Supabase; sem user → redirect `/auth`
- Rotas autenticadas usam `ssr: false`

| Rota | Função |
| --- | --- |
| `/journey` | Dashboard: nível, XP, streak, hábitos do dia, **AlterEgoJourneyCard**, check-in (incl. identidade), atributos, Charlie |
| `/habits` | CRUD hábitos declarados + entrada para exercício / Fitness + sugerir com Charlie |
| `/fitness` | Hub: catálogo dos 6 exercícios + templates de treino |
| `/fitness/workout/$slug` | Detalhe do template |
| `/fitness/play/$workoutId` | Player de treino multi-exercício |
| `/exercises/$slug` | Sessão validada (câmera + pose on-device) |
| `/exercises/ranking` | Ranking de sessões |
| `/goals` | Metas (status, motivo, prazo, norte, progresso 7d, vínculo hábitos) |
| `/identity` | Alter Ego (criar/editar/regenerar) + histórico de provas |
| `/mentor` | Chat Charlie; presença; desafios; xadrez (Modo foco); link loja |
| `/store` | Personalidades do Charlie (ativação real do tom) |
| `/profile` | Perfil, radar, troféus, localização, wallpapers, **Telegram**, **Discord**, push, despertador |
| `/onboarding` | Categorias + metas iniciais + passo Alter Ego |
| `/alarm/ritual` | Ritual pós-Charlie Call (fora do shell autenticado, aberto pelo nativo) |

### Control room (`/dashitecnology`)

Acesso: role `dashi` em `user_roles`.

Rotas: cockpit, users, habits, goals, gamification, levels, wallpapers, tokens, charlie, charlie-alarm, wisdom, ml, agent, notifications, telegram, **discord**, jobs, checkins, content, popups, system, maintenance, analytics, traffic.

Em `/dashitecnology/users/$userId`, **Limpar histórico completo** apaga sessões, metas (hábitos.goal_id → NULL) e histórico — mantém conta, nome e hábitos cadastrados.

---

## 3. Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, TanStack Start, TanStack Router, TanStack Query, Vite 8 |
| UI | Tailwind CSS v4, shadcn/Radix, Lucide, Sonner, Recharts |
| Validação | Zod |
| Backend | Supabase Auth + Postgres + RLS |
| Jobs | Edge Functions + `pg_cron` / `pg_net` |
| IA | OpenRouter (Charlie) |
| ML | Feature store + `heuristic_v1` (+ identity adherence); sklearn shadow; CF; agente |
| Pose | MediaPipe PoseLandmarker (`@mediapipe/tasks-vision`) — **só no device** |
| Xadrez | `chess.js` + `react-chessboard` + engine local (`src/mentor/chess-engine.ts`) |
| Clima | Open-Meteo |
| Push | Web Push (VAPID) + push nativo Capacitor (FCM) |
| Canais chat | Telegram + Discord (DM) |
| Mobile | Capacitor Android (`android/`); Live URL → produção; iOS ainda não |
| Charlie Call | Plugin nativo + AlarmManager; ringtones `classic` / `warrior` / `calm` |
| Deploy | Vercel (Nitro); APK via `cap:build:apk` |
| Patch | `patch-package` em `@tanstack/react-router` |

### Entrada da aplicação

| Arquivo | Papel |
| --- | --- |
| `src/router.tsx` | QueryClient + createRouter |
| `src/start.ts` | Middleware global: anexa JWT em server functions |
| `src/server.ts` | Wrapper SSR / erros catastróficos |
| `src/routes/__root.tsx` | Shell HTML, CSS, fontes, Toaster, sync auth |
| `src/routeTree.gen.ts` | Árvore de rotas gerada |

---

## 4. Estrutura de pastas (mapa mental)

```text
src/
  routes/
    index.tsx, auth.tsx, sobre, parceiros, obrigado, maintenance
    _authenticated/            # Shell + páginas protegidas
      journey, habits, goals, identity, mentor, store, profile, onboarding
      fitness*, exercises.$slug, exercises.ranking
    alarm.ritual.tsx
    dashitecnology/            # Control room (role dashi)
  mentor/                      # Charlie (UI, context, OpenRouter, chess, functions)
  notifications/               # Sino, create, jobs, Telegram, Discord, Web/native push
  admin/                       # Server fns da control room
  lib/
    alter-ego.ts / alter-ego.functions.ts
    identity-proofs.ts / identity-evening-report.ts
    journey*.ts, habit-xp.ts, goals.functions.ts, mentor-goals.ts
    checkins.functions.ts
    charlie-store.ts, charlie-call/, platform.ts
    exercise.functions.ts, exercise-xp.ts, exercise/ (registry + 6 defs)
    fitness/                   # Templates de treino
    ml/                        # features, adaptive, agent, CF, identity-adherence, recompute
    wallpapers.ts, weather.ts, popup.functions.ts, progress-engine.ts
  components/
    AlterEgoJourneyCard.tsx, CheckinCard.tsx, ExerciseSessionCameraModal.tsx, …
  integrations/supabase/
plans/
  alter-ego.md                 # Plano vivo Alter Ego
  ResumoAplicacao.md           # Este documento
  ML-fase-*.md, Charlie-*, PlanejamentoMobile-*, Exercicios*, …
supabase/
  migrations/                  # Schema + incrementais (incl. alter ego / provas / identity_report / discord)
  functions/
    notification-jobs/         # Lembretes + streak + identity_report + expirar desafios
    ml-features-job/
    agent-initiatives-job/
    telegram-webhook/
    discord-webhook/
android/                       # Capacitor + plugin CharlieCall
ml/                            # Python Fase 2 (shadow sklearn)
```

---

## 5. Autenticação e segurança

1. `/auth` — e-mail/senha, cadastro ou Google
2. Trigger `on_auth_user_created` cria `profiles`, `attributes`, `user_roles` (`user`)
3. Sessão no browser (localStorage); server functions via `Authorization: Bearer <JWT>`
4. Logout limpa React Query e navega para `/auth`
5. JWT de outro projeto Supabase → sessão limpa

### RLS (resumo)

- Dados filtrados por `auth.uid()`
- `notifications`: usuário SELECT/UPDATE; INSERT via service role
- `telegram_link_codes` / `discord_link_codes`: códigos one-time; consumo no webhook com service role
- Colunas Telegram (e espelho Discord) no perfil protegidas por trigger — usuário não inventa `chat_id` / `discord_user_id`

---

## 6. Onboarding

- Se `onboarding_completo === false`, CTAs em jornada/mentor apontam para `/onboarding`
- Fluxo: categorias de foco → metas iniciais (`setGoals`) → passo **Alter Ego** (“Sua próxima versão”) → marca onboarding completo
- Contas antigas: podem criar/editar em `/identity`
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

### Streak

Dias consecutivos com hábitos concluídos. Notificação `streak_risk` (job diário; copy pode citar o **código** do Alter Ego).

### Categorias de foco

Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito.

### Capítulos e conquistas

- Engine: `progress-engine.ts` (capítulos + conquistas)
- Conquistas de identidade: `provas_7_semana`, `provas_30`
- Arco narrativo de copy (Intenção → Maestria) mapeado aos capítulos — **não** substitui `capitulo_atual`
- Missões de capítulo (`missions`)

### Hábitos e metas

| Tipo | Como conclui | XP |
| --- | --- | --- |
| **Declarado** | Check em `/habits` ou `/journey` | XP fixo (`habit_xp_reward`, default **15**, faixa 5–50) |
| **Validado** (`exercise_type_id`) | Sessão em `/exercises/$slug` (ou treino Fitness) | XP híbrido da sessão |

- Conclusões declaradas: 1 por hábito por dia
- `completeHabit` bloqueia hábitos com `exercise_type_id`
- Charlie pode propor `habit_suggestion`
- Completar hábito/meta/desafio → **prova de identidade** (idempotente no dia)

**Metas** (`/goals`, `20260802010000_goals_enrichment.sql`): status, motivo, prazo, norte (máx. 3), progresso 7d, vínculo `habits.goal_id`, conquistar → XP + memória Charlie.

### Exercícios validados + Fitness

Registry: `src/lib/exercise/registry.ts`.

| Slug | Nome |
| --- | --- |
| `pushup` | Flexão |
| `squat` | Agachamento |
| `plank` | Prancha |
| `lunge` | Afundo |
| `situp` | Abdominal |
| `glute_bridge` | Elevação de quadril |

| Peça | Detalhe |
| --- | --- |
| Pipeline | `getUserMedia` → MediaPipe Pose → framing → calibração → contagem |
| Privacidade | Só no device; sem gravar/enviar vídeo |
| XP | `exercise-xp.ts` — híbrido; 0 reps / cancelar → sem XP |
| Hub | `/fitness` + templates (`full-body-12`, `legs-focus`, `push-core`) |
| Ranking | `/exercises/ranking` |

### Activity history

`activity_history` + panorama no perfil.

---

## 8. Alter Ego (camada de identidade)

Plano: [`plans/alter-ego.md`](alter-ego.md) (cópia concluída também em `plans/concluidos/`).

**Posicionamento:** Charlie ≠ Alter Ego. Charlie é o **guardião** da identidade do herói.

| Fase | Status | Entrega |
| --- | --- | --- |
| **0** Escopo | ✅ | Não-objetivos travados (sem moeda nova, sem Charlie falando *como* o ego) |
| **1** Artefato + Charlie + UI | ✅ | `hero_alter_ego`, onboarding, `/identity`, card na jornada, bloco `IDENTIDADE DO HERÓI` |
| **2** Provas + ritual | ✅ | `identity_proofs`, check-in `identidade_hoje`, evening report, conquistas |
| **3** ML adaptativo | ✅ | `identity_adherence` / `risco_identidade`, agente + notifs de alto valor, `identity_report` TG/Discord |
| **2.4** Ativação | ⬜ | Overlay “Alter ego ativado”; Charlie Call citando código |
| **3.3** Avançado | ⬜ | Modos/arquétipos, conselho do ego, níveis narrativos derivados |

### Peças principais

| Peça | Onde |
| --- | --- |
| Schema | `20260811120000_hero_alter_ego.sql`, `20260811140000_identity_proofs.sql`, `20260811160000_identity_report_notification.sql` |
| Lib | `src/lib/alter-ego.ts`, `identity-proofs.ts`, `identity-evening-report.ts`, `ml/identity-adherence.ts` |
| UI | `/identity`, `AlterEgoJourneyCard`, passo no onboarding, `CheckinCard` |
| Charlie | `formatAlterEgoBlock`, provas no contexto, presença morning (código) / evening (relatório) |
| Canais | Cron ~22h BRT + fan-out evening → Telegram/Discord (`identity_report`) |

### Relatório evening (`identity_report`)

1. **Cron** `notification-jobs` (~22:00 BRT): texto determinístico (`buildIdentityEveningReport`) para quem tem Telegram e/ou Discord com opt-in
2. **Presença evening** no Mentor (20h–2h BRT): mensagem LLM no chat + espelho 1×/dia nos canais (se ainda não enviado)
3. Conteúdo típico: compromissos do dia, provas da semana, check-in de identidade, código, “um dia fraco não destrói a identidade”

---

## 9. Mentor Charlie

Módulo: `src/mentor/`.

| Capacidade | Detalhe |
| --- | --- |
| Chat | `mentor_messages` |
| Presença | `welcome` · `morning` · `evening` · `return` · `insight` (risco ML) |
| Memórias | `mentor_memories` (prune ~20); 3× check-in “não” → memória opcional |
| Objetivos | `mentor_objectives` |
| Desafios | `mentor_challenges` — clamp adaptativo |
| Sugestão de hábito | `habit_suggestion` |
| Metas | Bloco `METAS DO HERÓI` |
| Alter Ego | Guardião; fricção cita 1 linha do código |
| Personalidade | `profiles.charlie_personality` via `/store` |
| SINAIS ML | streak, abandono, weekday, aderência, risco_identidade, principal risco |
| Check-ins | Sono/energia/humor/identidade — sem inventar |
| Xadrez | Modo foco; `charlie_chess_games`; contexto enxuto |
| Despertador | Capacitor; ritual `/alarm/ritual` |
| Clima | Open-Meteo se perfil tem lat/lon |
| IA | OpenRouter |

Slugs de personalidade: `classico`, `militar`, `estoico`, `empresarial`, `cristao`, `fitness`, `financeiro`.

### Loja (`/store`)

- Ativação real do tom; preço de vitrine **Grátis**; checkout/inventário ainda não

### Charlie Call / Despertador (Android MVP)

- `charlie_alarms` + ringtones; plugin nativo; web = preferências, alarme confiável só no APK

---

## 10. Machine Learning (Fases 1–4 + identidade)

| Fase | Entrega | Doc |
| --- | --- | --- |
| **1** Feature store | `user_features` + `user_ml_scores` (`heuristic_v1`); job `ml-features-job` | `ML-fase-1.md` |
| **2** Preditivo | Python `ml/`; shadow `user_ml_scores_shadow` | `ML-fase-2.md` |
| **3** Adaptativo | Lembretes/desafios por scores (`adaptive.ts`) | `ML-fase-3.md` |
| **4** Agente | `agent_initiatives`; CF; job `agent-initiatives-job` | `ML-fase-4.md` |
| **Alter Ego** | `identity_adherence` / `risco_identidade` em `explicacao`; copy de código no agente / streak | `alter-ego.md` Fase 3 |

**Produção:** só `heuristic_v1`. Shadow sklearn exige decisão humana.  
**Agente:** máx. 1 iniciativa/dia; kinds `streak_protect` | `checkin_nudge` | `cf_habit_hint` — não cria desafio sozinho.

Testes: `npm run test:ml` (inclui alter-ego, provas, identity-evening-report, voice).

---

## 11. Mobile (Capacitor Android)

Doc: `plans/PlanejamentoMobile-Capacitor.md`.

| Peça | Detalhe |
| --- | --- |
| Princípio | Web = fonte da verdade; Capacitor = container + bridges |
| Entrega | APK Live URL → Vercel (`…/journey`) |
| Auth | E-mail/senha no WebView; Google via Custom Tabs |
| Push | Tokens nativos + Web Push no browser |
| Exercícios | MediaPipe no device |
| Charlie Call | MVP Android; iOS depois |
| Scripts | `cap:sync`, `cap:open:android`, `cap:build:apk` / `cap:build:aab` |

---

## 12. Fundos de tela (wallpapers)

- Catálogo `src/lib/wallpapers.ts` + `public/wallpapers/`
- Unlock por nível / XP / streak / capítulo
- Preferência `profiles.wallpaper_id` + `localStorage`
- Admin: `/dashitecnology/wallpapers`

---

## 13. Localização e clima

- Perfil: cidade + lat/lon/timezone
- Open-Meteo (`src/lib/weather.ts`), cache ~45 min
- Charlie usa com parcimônia

---

## 14. Notificações (in-app, push, Telegram, Discord)

### UI

- `NotificationBell` + sheet (filtros, marcar lida)
- Opt-ins no perfil: Web Push, push nativo, Telegram, Discord

### Tipos (`NOTIFICATION_TIPOS`)

`mentor_challenge`, `mentor_challenge_done`, `mentor_challenge_expired`, `habit_complete`, `habit_reminder`, `streak_risk`, `mentor_presence`, `achievement`, `system`, `agent_initiative`, **`identity_report`**

### Criação e fan-out

`createNotification` (`src/notifications/create.ts`) → in-app + Telegram + Discord + Web Push + native push.

Voz do Charlie (`charlie-telegram-voice.ts`) nos alertas de alto valor; **`identity_report` usa título/corpo crus** (já são o relatório).

### Jobs diários

| Function | Cron (UTC) | Papel |
| --- | --- | --- |
| `notification-jobs` | `0 1 * * *` (~22:00 BRT) | `habit_reminder` / `streak_risk` + **`identity_report`** + expirar desafios |
| `ml-features-job` | `0 3 * * *` | Features + scores |
| `agent-initiatives-job` | `0 4 * * *` | CF + iniciativas |
| `telegram-webhook` | sob demanda | Vínculo Telegram |
| `discord-webhook` | sob demanda | Interactions Discord (Ed25519) |

- Auth: `x-cron-secret` = `CRON_SECRET`
- Quiet hours ≈ 23:00–06:59 BRT (reminders/iniciativas/relatório; expiração sempre)
- Anti-spam: 1 reminder / streak / iniciativa / **identity_report** por usuário/dia

### Telegram

| Peça | Detalhe |
| --- | --- |
| Bot | `@DashiVProject_bot` |
| UI | `TelegramSettingsCard` em `/profile` |
| Opt-in | `profiles.telegram_opt_in` |
| Admin | `/dashitecnology/telegram` |

**Tipos espelhados:** `habit_reminder`, `streak_risk`, `mentor_challenge*`, `agent_initiative`, `system`, **`identity_report`**.

### Discord

| Peça | Detalhe |
| --- | --- |
| Bot | `Charlie` (`DISCORD_APPLICATION_ID`) |
| UI | `DiscordSettingsCard` em `/profile` |
| Vínculo | Código one-time → DM `/vincular` |
| Webhook | `discord-webhook` + `DISCORD_PUBLIC_KEY` |
| Opt-in | `profiles.discord_opt_in` |
| Canal | **só DM** (MVP) |
| Admin | `/dashitecnology/discord` |

**Tipos espelhados:** mesmos do Telegram.

### Push (Web + nativo)

`PUSH_NOTIFY_TIPOS` inclui os espelhados acima + `achievement` + `identity_report`.  
`identity_report` / desafios respeitam `notify_mentor` nas settings.

---

## 15. Modelo de dados (Supabase)

| Tabela | Papel |
| --- | --- |
| `profiles` | Herói (XP, streak, capítulo, wallpaper, telegram/discord, localização, `charlie_personality`…) |
| `attributes` | 8 atributos |
| `levels` / `chapters` / `achievements` / `user_achievements` | Catálogo + unlock |
| `missions` | Missões de capítulo |
| `goals` | Metas enriquecidas |
| `habits` / `habit_completions` | Hábitos + checks |
| `exercise_types` / `exercise_sessions` / `exercise_session_metrics` | Exercícios validados |
| `activity_history` | Log de eventos/XP |
| `user_roles` | `dashi` / `user` |
| `mentor_*` | Mensagens, memórias, desafios, objetivos |
| `hero_alter_ego` | Identidade secreta do herói |
| `identity_proofs` | Provas (hábito/meta/desafio/…) |
| `user_checkins` | Sono/energia/humor/`identidade_hoje` |
| `notifications` | Centro in-app (+ fan-out) |
| `telegram_link_codes` / `discord_link_codes` | Códigos one-time |
| `user_features` / `user_ml_scores` / `user_ml_scores_shadow` | ML |
| `ml_model_runs` | Metadados de treino |
| `agent_initiatives` / `user_cf_recommendations` | Agente + CF |
| `app_settings` | Flags (`habit_xp_reward`, despertador…) |
| `charlie_alarms` | Despertador por usuário |
| `charlie_chess_games` | Partidas Charlie × herói |
| `wallpaper_catalog` | Fundos |

Schema base: `20260717004140_complete_schema.sql`  
Incrementais relevantes: notificações, Telegram, Discord, wallpaper, clima, missões, ML 1–4, exercícios, metas, alarmes, XP fixo, xadrez, **`20260811120000_hero_alter_ego`**, **`20260811140000_identity_proofs`**, **`20260811160000_identity_report_notification`**, **`20260811160000_discord_notifications`** (mesmo prefixo de timestamp — ordem de apply importa).

---

## 16. Cache e performance (React Query)

| Config | Valor típico |
| --- | --- |
| `staleTime` jornada / metas / notificações | ~30s |
| `staleTime` mentor | ~15s |
| `gcTime` | 5 min |
| `refetchOnWindowFocus` | off |
| Mutations de hábito | update otimista + invalidate |

---

## 17. Design system

| Token | Valor / uso |
| --- | --- |
| Fundo | `#1B1B1B` |
| Texto | creme `#FFE7D0` |
| Superfície | `#323232` |
| Accent | laranja `#FC6E20` |
| Tipografia | Ethnocentric (display) + Chakra Petch |
| Painéis | `cp-panel` / `cp-modal` |
| Tom | Dark cyberpunk |

---

## 18. Variáveis de ambiente

Cliente e servidor no **mesmo** projeto (`VITE_*` alinhado a `SUPABASE_*`).

| Variável | Onde | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_*` / `SUPABASE_*` | Client + server | URL, anon, project id |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Admin / inserts |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | Server | Charlie |
| `CRON_SECRET` | Edge jobs | Auth do cron |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET` | Server / Edge | Telegram |
| `DISCORD_BOT_TOKEN` / `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` / `DISCORD_BOT_USERNAME` | Server / Edge | Discord |
| `APP_PUBLIC_URL` | Server | Links nas DMs |
| `VAPID_*` / `VITE_VAPID_PUBLIC_KEY` | Server / client | Web Push |
| `SUPABASE_TOKEN` | Local / CLI | Access token ops (deploy Edge, SQL) — **nunca** no browser |

Modelo: `.env.example`. `.env` **não** commitado. No Vercel, `VITE_*` no **build**.

---

## 19. Deploy e operação

### App (Vercel)

- `npm run build` → Nitro preset `vercel`
- Domínio: `https://v-project-rho.vercel.app`
- Auth Supabase: Site URL + Redirect URLs

### Edge Functions

```bash
npx supabase functions deploy notification-jobs ml-features-job \
  agent-initiatives-job telegram-webhook discord-webhook \
  --project-ref gmzddccyikpxbiozsiue --no-verify-jwt --use-api
```

(Usar `SUPABASE_ACCESS_TOKEN` / `SUPABASE_TOKEN` do `.env`.)

### Banco

1. Schema canônico + migrations incrementais (Alter Ego / provas / identity_report / Discord)
2. Vault `notification_jobs_cron_secret` = `CRON_SECRET`
3. `setWebhook` Telegram + Interactions URL Discord

### Dev local

```bash
npm install
npm run dev
npm run test:ml
```

---

## 20. O que funciona vs. lacunas

### Funciona hoje

- Auth (e-mail + Google), onboarding com **Alter Ego**
- Hábitos declarados (XP fixo), níveis, streak, atributos, metas enriquecidas
- **6 exercícios** MediaPipe + hub **Fitness** + ranking
- Progresso (capítulos, conquistas, missões) + provas de identidade
- Charlie (chat, presença, memórias, desafios, metas, clima, ML, check-ins, xadrez, guardião do Alter Ego)
- Charlie Call / despertador (MVP Android)
- Loja de personalidades
- ML Fases 1–4 + **aderência à identidade**
- Relatório evening → **Telegram + Discord** (`identity_report`)
- Capacitor Android; wallpapers; popups in-app
- Notificações in-app + Web Push + push nativo + jobs
- Control room `/dashitecnology` (incl. Discord, checkins, ML, agent, jobs)

### Ainda não / incompleto

| Item | Situação |
| --- | --- |
| Overlay “Alter ego ativado” / Call matinal com código | Fase 2.4 aberta |
| Modos / conselho do ego / níveis narrativos derivados | Fase 3.3 aberta |
| Prova no “levantei” do despertador | Schema permite `alarm`; emit ainda não ligado |
| Upload de avatar | Coluna existe; fluxo incompleto |
| Push e-mail / WhatsApp | Não |
| Pagamento / inventário da loja | Vitrine grátis |
| Assinatura Kiwify (entitlement) | Páginas `/parceiros` `/obrigado`; **sem gate no app** — ver `Assinatura-Kiwify.md` |
| Promoção sklearn → Charlie | Shadow only |
| Capacitor iOS | Fora do MVP |
| Despertador na web pura | Alarme confiável só no APK |
| Xadrez “pro” | Sem Elo/multiplayer/análise (de propósito) |
| Backup Drive | Só plano |

---

## 21. Arquivos mais importantes

| Assunto | Onde |
| --- | --- |
| Alter Ego | `src/lib/alter-ego*.ts`, `identity-proofs.ts`, `identity-evening-report.ts` |
| Identidade UI | `src/routes/_authenticated/identity.tsx`, `AlterEgoJourneyCard.tsx` |
| Aderência ML | `src/lib/ml/identity-adherence.ts`, `features.ts`, `recompute.ts` |
| Níveis / jornada | `src/lib/journey.ts`, `journey.functions.ts` |
| Progresso | `src/lib/progress-engine.ts` |
| Metas | `src/lib/goals.functions.ts` |
| Exercícios / Fitness | `src/lib/exercise/*`, `src/lib/fitness/*` |
| Check-ins | `src/lib/checkins.functions.ts`, `CheckinCard.tsx` |
| Charlie | `src/mentor/*` |
| Notificações / TG / Discord / Push | `src/notifications/*` |
| Jobs produto | `src/notifications/jobs.ts` + Edge `notification-jobs` |
| Control room | `src/admin/*`, `src/routes/dashitecnology/*` |
| Schema | `supabase/migrations/*` |
| Edge | `supabase/functions/{notification-jobs,ml-features-job,agent-initiatives-job,telegram-webhook,discord-webhook}/` |

---

## 22. Glossário rápido

| Termo | Significado |
| --- | --- |
| **Herói** | Usuário autenticado |
| **Alter Ego** | Identidade secreta (código, virtudes, inimigo) — quem o herói está se tornando |
| **Prova** | Evidência persistida de ação alinhada (`identity_proofs`) |
| **Charlie** | Mentor IA — guardião do Alter Ego, não o alter ego |
| **Jornada** | Dashboard principal |
| **Streak** | Dias consecutivos com hábitos |
| **Desafio** | Missão temporária do Charlie |
| **SINAIS ML** | Scores no contexto (incl. aderência / risco_identidade) |
| **identity_report** | Relatório evening espelhado no Telegram/Discord |
| **Shadow** | Predição sklearn não usada em produção |
| **Iniciativa** | Ação sugerida pelo agente |
| **Check-in** | Sono / energia / humor / identidade do dia |
| **Hábito declarado / validado** | Check manual vs sessão de exercício |
| **Norte** | Meta destaque (máx. 3) |
| **Fitness** | Hub + treinos multi-exercício |
| **dashi** | Role admin da control room |
| **Service role** | Chave admin Supabase (nunca no browser) |

---

## 23. Documentos relacionados

| Arquivo | Conteúdo |
| --- | --- |
| `README.md` | Setup, features, env |
| `plans/alter-ego.md` | Plano Alter Ego (Fases 0–3; 2.4/3.3 abertos) |
| `plans/ExerciciosValidados-Flexao.md` | Origem do pipeline de pose (hoje: 6 exercícios) |
| `plans/ML-fase-1.md` … `ML-fase-4.md` | Roadmap ML |
| `plans/PlanejamentoMobile-Capacitor.md` | Shell Android |
| `plans/Charlie-Call-Nativo.md` / `Charlie-Despertador.md` | Despertador |
| `plans/Charlie-xadrez.md` | Ritual de xadrez |
| `plans/PlanejamentoDiscord.md` | Canal Discord |
| `plans/concluidos/PlanejamentoTelegram.md` | Canal Telegram |
| `plans/Assinatura-Kiwify.md` | Assinatura (não implementada) |
| `plans/Charlie-fase-1.md` / `upgrade-Charlie.md` | Evolução do mentor |

---

*Documento único de referência (produto + engenharia). Ao mudar features relevantes, atualize as seções 1–2, 6–11, 14–15, 18–20 e o glossário.*
