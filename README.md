<p align="center">
  <img src="public/logo.png" alt="V-Project" width="280" />
</p>

<h1 align="center">V-Project</h1>

<p align="center">
  <strong>Desenvolvimento masculino gamificado pela Jornada do Herói.</strong><br />
  Hábitos, metas, XP, atributos, fundos de tela e mentor com IA — do Homem Comum à Lenda.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactquery&logoColor=white" alt="TanStack" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/OpenRouter-Charlie-8B5CF6?logo=openai&logoColor=white" alt="OpenRouter" />
</p>

---

## Sobre

O **V-Project** transforma autodisciplina em uma jornada. O usuário define metas, cria hábitos diários e ganha XP a cada conclusão — subindo de nível, mantendo streak e fortalecendo 8 atributos.

Inspirado na **Jornada do Herói**, o app guia o progresso em capítulos, com visual dark cyberpunk (painéis chanfrados, accent laranja `#FC6E20`).

O mentor **Charlie** acompanha a jornada com chat, memórias, desafios e, se o herói definir a cidade no perfil, **previsão do tempo da região** (Open-Meteo). Há **check-in diário** (sono/energia/humor) e uma camada de **ML** (features, scores, lembretes adaptativos, iniciativas do agente). O progresso desbloqueia **fundos de tela**, e o sino de notificações (e o Telegram, se conectado) mantém o herói no ritmo.

---

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Landing** (`/`) | Hero full-bleed, pilares e CTA |
| **Auth** (`/auth`) | Login / cadastro (e-mail + senha), Google OAuth, animação da porta e boas-vindas |
| **Onboarding** | Áreas de foco e primeiras metas |
| **Jornada** (`/journey`) | Dashboard: nível, XP, streak, hábitos do dia, check-in, atributos |
| **Hábitos** (`/habits`) | CRUD de hábitos e check-off diário com XP |
| **Metas** (`/goals`) | Gestão das metas por categoria |
| **Charlie** (`/mentor`) | Mentor com IA: chat, memórias, desafios, clima e **sinais ML** |
| **Perfil** (`/profile`) | Panorama: identidade, radar, ritmo 21 dias, troféus, cidade/região, fundos, Telegram |
| **Notificações** | Sino in-app + Telegram opcional + iniciativas do agente |
| **ML** | Feature store, scores, lembretes/desafios adaptativos, shadow sklearn, CF, agente |

### Charlie e clima

- No **Perfil**, o herói informa a cidade/região; o servidor geocodifica (Open-Meteo) e grava lat/lon + timezone
- Em cada conversa/presença, o Charlie recebe temperatura, condição e previsão do dia (cache ~45 min)
- Usa o clima com parcimônia (amanhecer, desafios de corpo/outdoor) — sem inventar tempo se a região não estiver cadastrada
- Sem API key externa além do Open-Meteo (público); migration: `20260727140000_profile_location_weather.sql`

### Gamificação

- **12 níveis** — Homem Comum → Lenda
- **8 atributos** — Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento, Liderança
- **Streak** — dias consecutivos de hábitos concluídos
- **Capítulos** da jornada e **conquistas**
- Categorias: Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito

### Fundos de tela

- Catálogo em `src/lib/wallpapers.ts` (imagens em `public/wallpapers/`)
- Desbloqueio por nível, XP, streak máximo ou capítulo
- Preferência aplicada no layout autenticado; configuração em `/profile`
- Ao liberar um fundo (ex.: ao concluir hábito), notificação no sino
- Ao tocar em fundo bloqueado, pop-up breve com o requisito

### Notificações

- Tipos de produto (desafios do mentor, hábitos, streak, conquistas, sistema, **iniciativas do agente**)
- Jobs diários via Edge Functions + cron (`notification-jobs`, `ml-features-job`, `agent-initiatives-job`)
- Canal opcional: bot Telegram (`TELEGRAM_BOT_*`)

### Machine Learning (Fases 1–4)

| Fase | O que entrega |
| --- | --- |
| **1** | `user_features` + `user_ml_scores` (`heuristic_v1`) → contexto do Charlie; job `ml-features-job` |
| **2** | Treino sklearn (Python em `ml/`) + AUC offline; scores em **shadow** (não substituem o Charlie) |
| **3** | Lembretes e desafios **adaptativos** com guardrails (`src/lib/ml/adaptive.ts`) |
| **4** | Check-ins; iniciativas do agente; collaborative filtering leve (só com peers suficientes) |

Docs: `plans/ML-fase-1.md` … `plans/ML-fase-4.md`. Testes: `npm run test:ml`.

---

## Stack

- **Frontend:** React 19, TanStack Start / Router / Query, Vite 8
- **UI:** Tailwind CSS v4, shadcn/ui, Lucide, Sonner, Recharts
- **Backend:** Supabase (Auth, Postgres, RLS, Edge Functions)
- **IA:** OpenRouter (Charlie)
- **ML:** TypeScript (features/adaptive/agent) + Python/sklearn (shadow)
- **Clima:** Open-Meteo (geocoding + forecast, server-side)
- **Validação:** Zod
- **Idioma:** PT-BR

---

## Pré-requisitos

- Node.js 20+
- Conta [Supabase](https://supabase.com) — **projeto dedicado** (não compartilhe o banco com outros apps)
- Conta [OpenRouter](https://openrouter.ai) (para o Charlie)
- npm

---

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Copie `.env.example` para `.env` na raiz. **Cliente e servidor devem apontar para o mesmo projeto:**

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

# URL pública (produção)
APP_PUBLIC_URL=https://sua-app.exemplo
```

> `VITE_*` e `SUPABASE_*` (URL / publishable) precisam ser **iguais**.  
> `SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `CRON_SECRET` e tokens do Telegram só no servidor — nunca no client.  
> Após trocar de projeto: faça **redeploy**, limpe a sessão do browser e entre de novo.

### 3. Banco de dados

Schema canônico (jornada + mentor + RLS + trigger de signup):

```text
supabase/migrations/20260717004140_complete_schema.sql
```

Migrations relevantes depois do schema:

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
```

No SQL Editor do projeto Supabase, execute o schema completo e, em seguida, as migrations acima (na ordem).  
Schedules de cron **não** devem recriar `pg_cron` se a extensão já existir (erro `2BP01`).

Opcional via CLI (com o projeto linkado):

```bash
npx supabase db push
```

Edge Functions (todas com `--no-verify-jwt`; auth via `x-cron-secret` / Telegram secret):

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

`CRON_SECRET` no projeto deve coincidir com o Vault `notification_jobs_cron_secret`.
### 4. Auth Google (opcional)

No dashboard do **mesmo** projeto Supabase, ative o provider Google.  
O app usa `supabase.auth.signInWithOAuth` nesse projeto.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Abra o endereço do terminal (geralmente `http://localhost:8080` ou a próxima porta livre).

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

---

## Estrutura

```text
src/
  routes/
    index.tsx                 # Landing
    auth.tsx                  # Login / cadastro
    _authenticated/           # Área logada (+ wallpaper + NotificationBell)
      journey.tsx             # Dashboard + CheckinCard
      habits.tsx
      goals.tsx
      mentor.tsx              # Charlie (+ SINAIS ML)
      profile.tsx             # Panorama + cidade/clima + fundos + Telegram
      onboarding.tsx
  mentor/                     # UI + server functions + OpenRouter + contexto
  notifications/              # Sino, create, jobs, Telegram
  components/
    CheckinCard.tsx           # Check-in diário
    WallpaperSettings.tsx
    auth/                     # Porta + boas-vindas
  integrations/supabase/      # Client, auth middleware, env unificado
  lib/
    journey.ts / journey.functions.ts
    checkins.functions.ts
    ml/                       # features, adaptive, agent, CF
    weather.ts
    wallpapers.ts
  styles.css
ml/                           # Python Fase 2 (train / evaluate / score-shadow)
plans/
  ResumoAplicacao.md
  ML-fase-1.md … ML-fase-4.md
public/
  logo.png
  wallpapers/
supabase/
  migrations/
  functions/
    notification-jobs/
    ml-features-job/
    agent-initiatives-job/
    telegram-webhook/
```

---

## Rotas

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `/` | Público | Landing |
| `/auth` | Público | Autenticação |
| `/onboarding` | Autenticado | Primeira configuração |
| `/journey` | Autenticado | Dashboard + check-in |
| `/habits` | Autenticado | Hábitos |
| `/goals` | Autenticado | Metas |
| `/mentor` | Autenticado | Charlie (mentor) |
| `/profile` | Autenticado | Perfil, cidade/clima, fundos, Telegram |

---

## Design

- Tema **dark** com accent **laranja herói** (`#FC6E20`)
- Tipografia: **Ethnocentric** (títulos) + **Chakra Petch** (corpo)
- Painéis com `clip-path` cyberpunk (`cp-panel`, `cp-modal`, `cp-brackets`, `cp-toast`)
- Navbar mobile: 5 colunas com botão elevado do **Charlie** no centro
- Fundo de tela desbloqueável aplicado atrás do conteúdo autenticado

---

## Auth e projeto Supabase

- Use um **projeto Supabase exclusivo** para o V-Project (sem Lovable no fluxo atual).
- Tokens de outro projeto geram `Unauthorized: Token from a different Supabase project`.
- O client limpa sessões antigas (`sb-*-auth`) automaticamente quando detecta mismatch.

---

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| [`plans/ResumoAplicacao.md`](plans/ResumoAplicacao.md) | Visão completa produto + engenharia |
| [`plans/ML-fase-1.md`](plans/ML-fase-1.md) … [`ML-fase-4.md`](plans/ML-fase-4.md) | Feature store → preditivo → adaptativo → agente |
| [`plans/Charlie-fase-1.md`](plans/Charlie-fase-1.md) | Evolução do mentor |

---

## Licença

Projeto privado. Todos os direitos reservados.