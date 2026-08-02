<p align="center">
  <img src="public/logo.png" alt="V-Project" width="280" />
</p>

<h1 align="center">V-Project</h1>

<p align="center">
  <strong>Desenvolvimento masculino gamificado pela Jornada do Herói.</strong><br />
  Hábitos, metas enriquecidas, XP, capítulos, flexão validada por pose, loja do Charlie, fundos de tela e mentor com IA — do Homem Comum à Lenda.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactquery&logoColor=white" alt="TanStack" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/OpenRouter-Charlie-8B5CF6?logo=openai&logoColor=white" alt="OpenRouter" />
  <img src="https://img.shields.io/badge/MediaPipe-Pose-FF6F00?logo=google&logoColor=white" alt="MediaPipe" />
</p>

---

## Sobre

O **V-Project** transforma autodisciplina em uma jornada. O usuário define metas, cria hábitos diários e ganha XP — subindo de nível, mantendo streak e fortalecendo 8 atributos.

Hábitos **declarados** concluem com check manual. Hábitos **validados** (MVP: flexão) exigem sessão com câmera: pose on-device (MediaPipe), calibração ao corpo, coaching de forma em tempo real e métricas persistidas — **sem gravar nem enviar vídeo**.

Inspirado na **Jornada do Herói**, o app guia o progresso em capítulos, com visual dark cyberpunk (painéis chanfrados, accent laranja `#FC6E20`).

O mentor **Charlie** acompanha com chat, memórias, desafios, sugestões de hábito, **metas do herói** e, se a cidade estiver no perfil, clima local (Open-Meteo). A personalidade do Charlie é escolhida na **loja** (`/store`). Há check-in diário, camada de **ML**, **Web Push**, Telegram opcional e control room (`/dashitecnology`) para quem tem role `dashi`.

Produção: `https://v-project-rho.vercel.app` · Doc canônico: [`plans/ResumoAplicacao.md`](plans/ResumoAplicacao.md).

---

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Landing** (`/`) | Hero full-bleed, pilares e CTA |
| **Auth** (`/auth`) | Login / cadastro (e-mail + senha), Google OAuth |
| **Onboarding** | Áreas de foco e primeiras metas |
| **Jornada** (`/journey`) | Dashboard: nível, XP, streak, hábitos declarados, check-in, atributos |
| **Hábitos** (`/habits`) | CRUD declarados + card para exercício validado + sugerir com Charlie |
| **Flexão** (`/exercises/pushup`) | Sessão com câmera, framing, calibração (~3s), contagem e cues de postura |
| **Metas** (`/goals`) | Status, motivo, prazo, norte (máx. 3), progresso 7d, vínculo com hábitos, XP ao conquistar |
| **Charlie** (`/mentor`) | Chat, memórias, desafios, sugestões, metas no contexto, clima, sinais ML |
| **Loja** (`/store`) | Personalidades do Charlie — confirmar ativa o tom em `profiles.charlie_personality` |
| **Perfil** (`/profile`) | Identidade, radar, troféus, cidade/clima, fundos, Telegram, Web Push |
| **Notificações** | Sino in-app + Web Push (VAPID) + Telegram opcional |
| **ML** | Feature store, scores, lembretes/desafios adaptativos, shadow sklearn, CF, agente |
| **Control room** (`/dashitecnology`) | Operação (heróis, jobs, ML…) — role `dashi` |

### Exercícios validados (flexão)

- Card em `/habits` → `/exercises/pushup`
- Fluxo: enquadramento → calibração ao lockout do herói → contagem automática
- Coaching ao vivo: profundidade, lockout, alinhamento do corpo; barra de profundidade + skeleton
- XP **híbrido** (base + por rep válida × fator de forma, com teto e cap diário)
- Cancelar / 0 reps → sem XP; `completeHabit` bloqueado para hábitos validados
- Plano: [`plans/ExerciciosValidados-Flexao.md`](plans/ExerciciosValidados-Flexao.md)

### Metas

- Board em `/goals`: nortes, ativas, pausadas, concluídas
- Campos: motivo, prazo, status, `is_norte` (máx. 3)
- Ligar hábitos à meta; progresso dos últimos 7 dias
- Conquistar → XP + memória no Charlie
- Migration: `supabase/migrations/20260802010000_goals_enrichment.sql`

### Charlie, metas e clima

- No **Perfil**, o herói informa a cidade/região; o servidor geocodifica (Open-Meteo)
- Em cada conversa/presença, o Charlie recebe temperatura e condição (cache ~45 min)
- Contexto inclui bloco **METAS DO HERÓI** (`src/lib/mentor-goals.ts`)
- Pode sugerir hábitos no mentor (aceitar cria o hábito; recusar descarta)
- CTA **Configurar Personalidade do Charlie** → `/store`

### Loja de personalidades (`/store`)

- Vitrine com arte em `public/charlie-versions/`
- Confirmar aplica `setCharliePersonality` de verdade
- Preço de vitrine **Grátis** por enquanto; pagamento/inventário ainda não
- Slugs: classico, militar, estoico, empresarial, cristao, fitness, financeiro

### Gamificação

- **12 níveis** — Homem Comum → Lenda
- **8 atributos** — Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento, Liderança
- **Streak** — dias consecutivos de hábitos concluídos
- **Capítulos**, **missões** e **conquistas**
- Categorias: Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito

### Fundos de tela

- Catálogo em `src/lib/wallpapers.ts` (`public/wallpapers/`)
- Desbloqueio por nível, XP, streak máximo ou capítulo
- Preferência no layout autenticado; configuração em `/profile`

### Notificações

- Sino in-app + **Web Push** (opt-in no perfil, chaves VAPID)
- Canal opcional: bot Telegram (`@DashiVProject_bot`)
- Jobs: `notification-jobs`, `ml-features-job`, `agent-initiatives-job`

### Machine Learning (Fases 1–4)

| Fase | O que entrega |
| --- | --- |
| **1** | `user_features` + `user_ml_scores` (`heuristic_v1`) → Charlie; job `ml-features-job` |
| **2** | Treino sklearn (`ml/`) + AUC; scores em **shadow** |
| **3** | Lembretes e desafios adaptativos (`src/lib/ml/adaptive.ts`) |
| **4** | Check-ins; iniciativas do agente; CF leve |

Docs: `plans/ML-fase-1.md` … `plans/ML-fase-4.md`. Testes: `npm run test:ml`.

---

## Stack

- **Frontend:** React 19, TanStack Start / Router / Query, Vite 8
- **UI:** Tailwind CSS v4, shadcn/ui, Lucide, Sonner, Recharts
- **Backend:** Supabase (Auth, Postgres, RLS, Edge Functions)
- **IA:** OpenRouter (Charlie)
- **Pose:** MediaPipe PoseLandmarker (`@mediapipe/tasks-vision`) — on-device
- **ML:** TypeScript (features/adaptive/agent) + Python/sklearn (shadow)
- **Clima:** Open-Meteo
- **Push:** Web Push (VAPID)
- **Validação:** Zod
- **Idioma:** PT-BR

---

## Pré-requisitos

- Node.js 20+
- Conta [Supabase](https://supabase.com) — projeto dedicado
- Conta [OpenRouter](https://openrouter.ai) (Charlie)
- npm
- (Opcional) chaves VAPID para Web Push: `npx web-push generate-vapid-keys`

---

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Copie `.env.example` para `.env`. **Cliente e servidor devem apontar para o mesmo projeto:**

```env
SUPABASE_PROJECT_ID=seu_project_id
SUPABASE_URL=https://seu_project_id.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

VITE_SUPABASE_PROJECT_ID=seu_project_id
VITE_SUPABASE_URL=https://seu_project_id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key

# Mentor (só servidor)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=

# Jobs / cron
CRON_SECRET=um_segredo_longo_aleatorio

# Telegram (opcional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=

# Web Push (opcional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VITE_VAPID_PUBLIC_KEY=

# URL pública (produção)
APP_PUBLIC_URL=https://sua-app.exemplo
```

> `VITE_*` e `SUPABASE_*` (URL / publishable) precisam ser **iguais**.  
> `SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `CRON_SECRET`, VAPID private e tokens do Telegram só no servidor.  
> No Vercel: as mesmas vars em Production; `VITE_*` precisam existir no **build**.

### 3. Banco de dados

Schema canônico:

```text
supabase/migrations/20260717004140_complete_schema.sql
```

Migrations relevantes depois do schema (ordem aproximada):

```text
supabase/migrations/20260717050000_mentor_ai.sql
supabase/migrations/20260717130206_charlie_fase1.sql
supabase/migrations/20260724110000_telegram_notifications.sql
supabase/migrations/20260724114700_notifications.sql
supabase/migrations/20260724195000_notifications_fase2.sql
supabase/migrations/20260724120000_profile_wallpaper.sql
supabase/migrations/20260727140000_profile_location_weather.sql
supabase/migrations/20260727150103_missions.sql
supabase/migrations/20260727150000_ml_feature_store.sql
supabase/migrations/20260727151000_schedule_ml_features_job.sql
supabase/migrations/20260727160000_ml_fase2_shadow.sql
supabase/migrations/20260727170000_ml_fase4_agent.sql
supabase/migrations/20260727171000_schedule_agent_initiatives_job.sql
supabase/migrations/20260801134500_validated_exercises_pushup.sql
supabase/migrations/20260802010000_goals_enrichment.sql
```

No SQL Editor do Supabase, execute o schema e as migrations.  
Schedules de cron **não** devem recriar `pg_cron` se a extensão já existir (erro `2BP01`).

```bash
npx supabase db push
```

Edge Functions:

```bash
npx supabase functions deploy notification-jobs ml-features-job \
  agent-initiatives-job telegram-webhook \
  --project-ref gmzddccyikpxbiozsiue --no-verify-jwt --use-api
```

| Function | Cron (UTC) | Papel |
| --- | --- | --- |
| `notification-jobs` | `0 1 * * *` | Lembretes + streak (adaptive) + expirar desafios |
| `ml-features-job` | `0 3 * * *` | Features + scores `heuristic_v1` |
| `agent-initiatives-job` | `0 4 * * *` | CF + iniciativas do agente |
| `telegram-webhook` | — | Vínculo Telegram |

`CRON_SECRET` deve coincidir com o Vault `notification_jobs_cron_secret`.

### 4. Auth Google (opcional)

No dashboard do **mesmo** projeto Supabase, ative o provider Google.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Abra o endereço do terminal (geralmente `http://localhost:8080`).

---

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test:ml` | Testes ML (heuristic + adaptive + agent/CF) |

Testes de pose/flexão (Node):

```bash
node --import tsx --test src/lib/exercise/pushup-counter.test.ts
```

---

## Estrutura

```text
src/
  routes/
    index.tsx                 # Landing
    auth.tsx                  # Login / cadastro
    _authenticated/
      journey.tsx
      habits.tsx
      exercises.$slug.tsx     # Sessão validada (flexão)
      goals.tsx               # Metas enriquecidas
      mentor.tsx
      store.tsx               # Loja de personalidades
      profile.tsx
      onboarding.tsx
    dashitecnology/           # Control room (dashi)
  mentor/
  notifications/              # Sino, Telegram, Web Push
  admin/                      # Server fns da control room
  components/
    ExerciseSessionCameraModal.tsx
    CheckinCard.tsx
    WallpaperSettings.tsx
  lib/
    journey.ts / journey.functions.ts
    goals.functions.ts / mentor-goals.ts
    charlie-store.ts
    exercise.functions.ts / exercise-xp.ts
    exercise/                 # framing, calibração, counter, overlay, MediaPipe
    useExerciseCamera.ts
    ml/
    weather.ts
    wallpapers.ts
  styles.css
ml/
plans/
  ResumoAplicacao.md
  ExerciciosValidados-Flexao.md
  ML-fase-1.md … ML-fase-4.md
public/
  charlie-versions/           # Arte das personalidades
  animate-icons/              # GIFs (ex.: flame no streak)
supabase/
  migrations/
  functions/
```

---

## Rotas

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `/` | Público | Landing |
| `/auth` | Público | Autenticação |
| `/onboarding` | Autenticado | Primeira configuração |
| `/journey` | Autenticado | Dashboard + check-in |
| `/habits` | Autenticado | Hábitos declarados + entrada para flexão |
| `/exercises/$slug` | Autenticado | Sessão de exercício validado (`pushup`) |
| `/goals` | Autenticado | Metas (norte, prazo, progresso, hábitos) |
| `/mentor` | Autenticado | Charlie |
| `/store` | Autenticado | Personalidades do Charlie |
| `/profile` | Autenticado | Perfil, clima, fundos, Telegram, Web Push |
| `/dashitecnology/*` | Role `dashi` | Control room |

---

## Design

- Tema **dark** com accent **laranja herói** (`#FC6E20`)
- Tipografia: **Ethnocentric** (títulos) + **Chakra Petch** (corpo)
- Painéis com `clip-path` cyberpunk (`cp-panel`, `cp-modal`, …)
- Navbar mobile: 5 colunas com botão elevado do **Charlie** no centro

---

## Auth e projeto Supabase

- Use um **projeto Supabase exclusivo** para o V-Project.
- Tokens de outro projeto geram `Unauthorized: Token from a different Supabase project`.
- O client limpa sessões antigas quando detecta mismatch.

---

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| [`plans/ResumoAplicacao.md`](plans/ResumoAplicacao.md) | Visão completa produto + engenharia |
| [`plans/ExerciciosValidados-Flexao.md`](plans/ExerciciosValidados-Flexao.md) | Flexão validada (câmera + pose) |
| [`plans/ML-fase-1.md`](plans/ML-fase-1.md) … [`ML-fase-4.md`](plans/ML-fase-4.md) | Feature store → preditivo → adaptativo → agente |
| [`plans/Charlie-fase-1.md`](plans/Charlie-fase-1.md) | Evolução do mentor |
| [`plans/PlanejamentoNotificacoes.md`](plans/PlanejamentoNotificacoes.md) | Canais de notificação |

---

## Licença

Projeto privado. Todos os direitos reservados.
