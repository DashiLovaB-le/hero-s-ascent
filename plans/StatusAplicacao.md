# Status da Aplicação — V-Project

Documento de referência sobre **como a aplicação funciona hoje**.  
Útil para onboarding de desenvolvedores, produto e futuras iterações.

| Campo | Valor |
| --- | --- |
| **Nome do produto** | V-Project |
| **Pasta / repo** | `hero-s-ascent` |
| **Idioma da UI** | Português (Brasil) |
| **Data deste status** | Julho 2026 |
| **Schema canônico** | `supabase/migrations/20260717004140_complete_schema.sql` |

---

## 1. Visão geral

O **V-Project** é um app de desenvolvimento masculino gamificado pela metáfora da **Jornada do Herói**. O usuário:

1. Autentica-se (e-mail/senha ou Google)
2. Passa por um onboarding de áreas de foco e metas
3. Cria hábitos diários ligados a atributos
4. Completa hábitos → ganha **XP**, sobe de **nível**, mantém **streak** e fortalece **atributos**
5. Conversa com o mentor **Charlie** (IA), que pode criar **desafios** com recompensa de XP

Visual: dark cyberpunk (fundo `#1B1B1B`, texto creme `#FFE7D0`, accent laranja `#FC6E20`), painéis com **clip-path** chanfrado (`cp-panel` / `cp-modal`).

---

## 2. Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, TanStack Start, TanStack Router, TanStack Query, Vite 8 |
| UI | Tailwind CSS v4, shadcn/Radix, Lucide, Sonner (toasts) |
| Validação | Zod |
| Backend / dados | Supabase (Auth + Postgres + RLS) |
| IA (mentor) | OpenRouter (modelo padrão: Claude Sonner ou override via env) |
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
    _authenticated/          # Shell autenticado
      journey.tsx            # Dashboard
      habits.tsx
      goals.tsx
      mentor.tsx             # Wrapper → MentorPage
      profile.tsx
      onboarding.tsx
  mentor/                    # Módulo Charlie (UI + server + OpenRouter)
  notifications/             # In-app: server fns + sino + queries
  lib/
    journey.ts               # Níveis, XP, categorias (lógica pura)
    journey.functions.ts     # Server functions da jornada
    journey-queries.ts       # React Query options
  integrations/supabase/     # Clients, auth middleware, session helpers
  components/ui/             # shadcn
  styles.css                 # Tokens + utilitários cyberpunk
public/                      # logo, charlie.png, BGs, fonte Ethnocentric
supabase/migrations/         # Schema SQL
```

---

## 4. Rotas e o que cada tela faz

### Públicas

| Rota | Arquivo | Função |
| --- | --- | --- |
| `/` | `src/routes/index.tsx` | Landing: hero full-bleed, 6 pilares, CTAs para `/auth` |
| `/auth` | `src/routes/auth.tsx` | Login, cadastro e Google OAuth; se já logado → `/journey` |

### Autenticadas (`/_authenticated`)

Layout em `src/routes/_authenticated/route.tsx`:

- Header com logo, nav desktop (Jornada, Hábitos, Charlie, Metas, Perfil) e logout
- Bottom nav mobile (5 colunas; Charlie no centro elevado via `CharlieNavButton`)
- Transição de página: classe `page-enter` (slide-up + fade)
- `beforeLoad`: valida sessão; sem user → limpa storage e redireciona `/auth`

| Rota | Arquivo | Função |
| --- | --- | --- |
| `/journey` | `journey.tsx` | Dashboard: nível, XP, streak, missão do dia (hábitos), atributos, card do Charlie, conquistas recentes |
| `/habits` | `habits.tsx` | Criar / listar / concluir / apagar hábitos |
| `/goals` | `goals.tsx` | Criar / listar / apagar metas por categoria |
| `/mentor` | `mentor.tsx` → `MentorPage.tsx` | Chat com Charlie, desafios **ativos**, indicador de digitação |
| `/profile` | `profile.tsx` | Editar nome/bio, atributos, **desafios concluídos**, conquistas |
| `/onboarding` | `onboarding.tsx` | 2 passos: áreas de foco → primeiras metas |

---

## 5. Autenticação — fluxo detalhado

### Entrada

1. Usuário acessa `/auth`
2. Pode:
   - **Entrar** com e-mail + senha (`signInWithPassword`)
   - **Criar conta** (`signUp`) — nome vai em `user_metadata`
   - **Google** (`signInWithOAuth`, redirect de volta a `/auth`)
3. Após sucesso: diálogo de boas-vindas + animação de porta (`AuthWelcomeDialog`, `AuthDoorOverlay`) → navegação para `/journey`

### Sessão

- Cliente Supabase em `src/integrations/supabase/client.ts` (persistência em `localStorage`, auto-refresh)
- Cada **server function** recebe o JWT via middleware `attachSupabaseAuth` (`auth-attacher.ts`)
- Validação server-side: `requireSupabaseAuth` (`auth-middleware.ts`) — Bearer token + `getClaims`
- Há helpers para limpar tokens de projetos Supabase antigos/conflitantes (`auth-session.ts`, `env.ts`)

### Bootstrap no banco ao cadastrar

Trigger Postgres `on_auth_user_created` → função `handle_new_user()`:

1. Insere linha em `profiles`
2. Insere linha em `attributes` (todos = 1)
3. Insere `user_roles` com role `user`

Se por algum motivo o perfil não existir, `getJourney` faz **upsert** com service role (`client.server.ts`).

### Logout

Cancela queries, limpa React Query, `signOut`, redireciona `/auth`.

---

## 6. Onboarding

Gatilho: `profiles.onboarding_completo === false`.

- Em `/journey` e `/mentor`, o usuário vê um CTA para completar o chamado (não é hard-block em todas as rotas).
- `/onboarding`:
  1. **Passo 1** — escolhe 2–4 categorias (`CATEGORIAS` em `journey.ts`)
  2. **Passo 2** — metas sugeridas (editáveis) → `setGoals`
- `setGoals` **apaga** metas antigas do usuário, **insere** as novas e marca `onboarding_completo = true`
- Redireciona para `/journey`

**Não cria hábitos automaticamente** e **não chama a IA** no onboarding.

---

## 7. Domínio da gamificação

### 7.1 XP e níveis

Fonte da verdade no **cliente**: array `LEVELS` em `src/lib/journey.ts`.

| Nível | Título | XP necessário |
| ---: | --- | ---: |
| 1 | Homem Comum | 0 |
| 2 | Aprendiz | 200 |
| 3 | Iniciado | 600 |
| 4 | Aspirante | 1 400 |
| 5 | Guerreiro | 3 000 |
| 6 | Sentinela | 6 000 |
| 7 | Cavaleiro | 10 000 |
| 8 | Estrategista | 16 000 |
| 9 | Mestre | 25 000 |
| 10 | Sábio | 40 000 |
| 11 | Rei | 65 000 |
| 12 | Lenda | 100 000 |

Função `calcularNivel(xp)` devolve nível atual, próximo, XP restante e progresso 0–1 (barra).

A tabela `levels` no banco espelha esses valores (seed), mas **a UI não consulta o banco** para níveis.

**Fontes de XP hoje:**

- Conclusão de hábito → `habits.xp_recompensa` (padrão 10)
- Conclusão de desafio do Charlie → `mentor_challenges.xp_recompensa`

### 7.2 Streak

Ao concluir um hábito (`completeHabit`):

- Se `ultimo_dia_completo` for **ontem** → `streak_atual + 1`
- Se for **hoje** → mantém
- Caso contrário → reinicia em `1`
- Atualiza `streak_maximo` e `ultimo_dia_completo`

Exibido no card hero da Jornada (ícone Flame + número).

### 7.3 Atributos (8)

| Chave | Label UI |
| --- | --- |
| `forca` | Força |
| `disciplina` | Disciplina |
| `sabedoria` | Sabedoria |
| `espirito` | Espírito |
| `testosterona` | Testosterona |
| `prosperidade` | Prosperidade |
| `conhecimento` | Conhecimento |
| `lideranca` | Liderança |

Cada hábito tem um `atributo`. Ao completar, aquele atributo recebe **+1**. Começam em **1** no cadastro.

### 7.4 Capítulos

- 7 capítulos seedados no banco (`O Chamado` … `A Lenda`) com `xp_minimo`
- Campo `profiles.capitulo_atual` (default 1)
- Labels na UI: função hardcoded `chapterName()` em `journey.tsx`
- **Não há lógica automática** que avance o capítulo conforme XP

### 7.5 Hábitos e conclusões

**Hábito** (`habits`):

- `titulo`, `descricao`, `xp_recompensa`, `atributo`, `categoria` (opcional), `ativo`

**Conclusão** (`habit_completions`):

- Constraint única `(user_id, habit_id, dia)` — no máximo uma conclusão por hábito por dia
- Fluxo otimizado no servidor (~3 round-trips): lê hábito/perfil/attrs → insere conclusão → atualiza perfil, atributo e `activity_history` em paralelo

UI:

- `/journey` — lista do dia + botão de check
- `/habits` — CRUD + botão “Fazer”

Updates otimistas no React Query (feedback imediato + rollback em erro).

### 7.6 Metas (goals)

Categorias = mesmas 6 áreas do onboarding (`corpo`, `mente`, `espirito`, `prosperidade`, `relacionamentos`, `proposito`).

Operações: listar, criar uma, apagar uma, ou `setGoals` (replace total — usado no onboarding).

### 7.7 Conquistas (achievements)

Catálogo seedado:

| Código | Título | Ícone (slug) |
| --- | --- | --- |
| `primeiro_passo` | Primeiro Passo | footprints |
| `streak_7` | Semana de Ferro | flame |
| `streak_30` | Mês Inabalável | crown |
| `streak_100` | Centenário | trophy |
| `primeiro_nivel` | Ascensão | chevron-up |
| `cavaleiro` | Cavaleiro | shield |
| `lenda` | Lenda Viva | star |

- Exibidas em `/journey` e `/profile` via `user_achievements`
- **Não há engine automática** que desbloqueie conquistas ao atingir streak/nível (hoje só leitura; unlock manual ou futuro)

### 7.8 Histórico de atividade

Tabela `activity_history` recebe inserts em:

- Conclusão de hábito (`tipo: habit_complete`)
- Conclusão de desafio (`tipo: mentor_challenge`)

**Não há tela** que liste esse histórico.

---

## 8. Mentor Charlie — funcionamento completo

Módulo: `src/mentor/`.

### 8.1 O que é

Charlie é um mentor com personalidade definida em `context.ts` (tom sério, sem emojis/gírias no prompt). Usa **OpenRouter** (`openrouter.ts`) com a chave `OPENROUTER_API_KEY`.

### 8.2 Chat

1. Loader da rota carrega `getMentorThread` (mensagens ≤120, desafios ativos, nome, flag onboarding)
2. Se onboarding incompleto → CTA para `/onboarding`
3. No mount: `ensureMentorPresence` pode gerar mensagem automática:
   - `welcome` — primeiro encontro
   - `morning` — horário manhã
   - `evening` — horário noite
   - `return` — retorno após vários dias
4. Usuário envia texto → `sendMentorMessage`:
   - Rate limit: **20 mensagens de usuário / hora**
   - Monta snapshot da jornada (perfil, hábitos, metas, streak, memórias, desafios ativos)
   - Chama o modelo pedindo JSON estruturado (`message`, opcional `memory`, opcional `challenge`)
   - Persiste resposta em `mentor_messages`
5. UX: mensagem do usuário **otimista** + indicador animado “Charlie escreve…” (três pontos) enquanto a IA responde

### 8.3 Memórias

- Tabela `mentor_memories` (`content`, `importance` 1–5)
- Charlie pode gravar uma memória por resposta
- Mantém no máximo ~20 (apaga as mais antigas)

### 8.4 Desafios

- Tabela `mentor_challenges`
- Status: `ativo` | `concluido` | `expirado` | `recusado`
- Máximo de **2 desafios ativos** por vez
- Campos: título, descrição, duração em dias, XP, título de recompensa opcional, datas

**Onde o usuário vê:**

| Status | Onde |
| --- | --- |
| `ativo` | Topo de `/mentor` — botões Concluir / Deixar para depois |
| `concluido` | Seção **Desafios do Charlie** em `/profile` |
| `recusado` | Persistido no banco; sem lista dedicada na UI |

Ao **concluir**: status → `concluido`, soma XP no perfil, registra `activity_history`.  
Ao **deixar para depois**: status → `recusado`.

### 8.5 Arquivos-chave do mentor

| Arquivo | Papel |
| --- | --- |
| `MentorPage.tsx` | UI do chat |
| `functions.ts` | Server functions |
| `context.ts` | Prompt, presença, parse JSON |
| `openrouter.ts` | Cliente HTTP da IA |
| `queries.ts` | React Query (`staleTime` 15s) |
| `CharlieNavButton.tsx` | Botão central da bottom nav |
| `MentorJourneyCard.tsx` | Card teaser na Jornada |

---

## 9. Camada de dados (Supabase)

### 9.1 Tabelas

| Tabela | Papel |
| --- | --- |
| `profiles` | Estado do herói (XP, streak, capítulo, onboarding, nome, bio…) |
| `attributes` | 8 atributos |
| `levels` | Referência de níveis (seed) |
| `chapters` | Referência de capítulos (seed) |
| `achievements` | Catálogo de conquistas |
| `user_achievements` | Conquistas desbloqueadas |
| `goals` | Metas do usuário |
| `habits` | Hábitos |
| `habit_completions` | Check-ins diários |
| `activity_history` | Log de eventos com XP |
| `user_roles` | Papéis (`admin` / `user`) |
| `mentor_messages` | Chat |
| `mentor_memories` | Memórias do mentor |
| `mentor_challenges` | Desafios |

### 9.2 RLS (resumo)

- Dados do usuário: só o próprio `auth.uid()`
- Catálogos (`levels`, `chapters`, `achievements`): SELECT público
- `user_roles`: SELECT próprio
- Funções internas (`set_updated_at`, `handle_new_user`, `has_role`): EXECUTE revogado de anon/authenticated

### 9.3 Enums

`app_role`, `attribute_type`, `goal_category`, `mission_kind` (sem tabela de missões ainda), `mentor_message_role`, `mentor_message_kind`, `mentor_challenge_status`.

### 9.4 Server functions da jornada

Em `src/lib/journey.functions.ts` (todas autenticadas):

- `getJourney` — agrega perfil, atributos, hábitos ativos, conclusões de hoje, conquistas
- `completeHabit`
- `createHabit` / `deleteHabit`
- `listGoals` / `createGoal` / `deleteGoal` / `setGoals`
- `updateProfile`
- `bootstrapUser` — stub legado (bootstrap real está em `getJourney` + trigger)

---

## 10. Cache e performance

| Config | Valor |
| --- | --- |
| `staleTime` padrão (jornada/metas) | 30 segundos |
| `staleTime` mentor | 15 segundos |
| `gcTime` | 5 minutos |
| `refetchOnWindowFocus` | desligado |
| `retry` | 1 |

Loaders das rotas usam `ensureQueryData` para pré-carregar.

Updates otimistas em: conclusão de hábito, delete de hábito/meta, mensagens do chat.

---

## 11. Design system

Definido em `src/styles.css`.

| Token | Hex / uso |
| --- | --- |
| Background | `#1B1B1B` |
| Foreground / creme | `#FFE7D0` |
| Surface / card | `#323232` |
| Hero / primary / XP | `#FC6E20` |

**Tipografia**

- Display: Ethnocentric (`/fonts/ethnocentric.woff`)
- Corpo: Chakra Petch (Google Fonts)

**Utilitários cyberpunk**

- `cp-panel` — clip-path TL+BR (corte 14px)
- `cp-modal` — corte maior + moldura
- `cp-toast` — toasts
- `cp-brackets` — cantoneiras laranja
- `page-enter` — transição entre páginas autenticadas

**Fundos**

- Mobile (≤767px): imagem fixa `/images/hero-bg-mobile.png` + overlay escuro
- Desktop: `/images/hero-bg-desktop.png`
- Landing: `/images/hero-section-lp.jpg`
- Auth: overlay/porta (`AuthDoorOverlay`, assets de login)

Inventário de ícones/emojis: ver `RelacaoDeIcones.md` na raiz.

---

## 12. Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Sim | URL do projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Sim | Chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (server) | Upserts de bootstrap + inserts de notificação |
| `CRON_SECRET` | Sim (jobs Fase 2) | Protege Edge Function / `runNotificationJobs` |
| `OPENROUTER_API_KEY` | Sim (para Charlie) | Chat do mentor |
| `OPENROUTER_MODEL` | Não | Override do modelo |
| `VITE_SUPABASE_PROJECT_ID` | Opcional | Documentação / checks |

Google OAuth exige provider configurado no painel Supabase.

---

## 13. Fluxo ponta a ponta (usuário novo)

```
Landing (/)
  → Auth (cadastro)
    → Trigger cria profile + attributes + role
    → Welcome + porta
      → /journey (onboarding incompleto → CTA)
        → /onboarding (áreas + metas)
          → setGoals + onboarding_completo = true
            → /journey (dashboard ativo)
              → cria hábitos em /habits
              → completa hábitos (XP, streak, atributo)
              → fala com Charlie em /mentor
              → conclui desafios → XP + histórico em /profile
```

---

## 14. O que já funciona vs. lacunas conhecidas

### Funciona hoje

- Auth e-mail/senha + Google
- Onboarding de metas
- CRUD de hábitos e metas
- Loop diário de XP / streak / atributos
- Dashboard da jornada
- Charlie (chat, presença, memórias, desafios ativos/concluídos)
- Perfil editável + histórico de desafios concluídos
- Notificações in-app (sino, filtros, marcar lida; gatilhos Charlie + jobs de reminder/streak/expiração) — migrations `20260724114700` + `20260724195000`
- Schema SQL completo e idempotente
- Visual cyberpunk consistente (clip-path, paleta, BGs)

### Parcial ou ainda não implementado

| Item | Situação |
| --- | --- |
| Desbloqueio automático de conquistas | Catálogo + UI; sem engine de unlock |
| Avanço automático de capítulo | Campo existe; sem regra por XP |
| Missões (`mission_kind`) | Enum no banco; sem tabela/UI |
| Geração de hábitos por IA a partir de metas | Não existe |
| Upload de avatar | Coluna `avatar_url`; sem UI |
| Tela de histórico de atividade | Só writes |
| Admin / Stripe / MFA | Não construídos |
| Notificações push / e-mail (Fase 3) | Só in-app (Fases 1–2); ver §16 |
| `levels` / `chapters` no DB | Seedados, mas UI usa constantes TS |
| Soft onboarding | Dá para abrir `/habits` sem terminar onboarding |

---

## 15. Arquivos mais importantes (mapa rápido)

| Assunto | Onde ler |
| --- | --- |
| Níveis / categorias / frases | `src/lib/journey.ts` |
| Mutações da jornada | `src/lib/journey.functions.ts` |
| Charlie | `src/mentor/*` |
| Notificações in-app | `src/notifications/*` |
| Auth UI | `src/routes/auth.tsx` |
| Gate autenticado | `src/routes/_authenticated/route.tsx` |
| Schema / RLS | `supabase/migrations/20260717004140_complete_schema.sql` |
| Tema | `src/styles.css` |
| Setup local | `README.md` |
| Ícones / emojis | `RelacaoDeIcones.md` |

---

## 16. Notificações in-app (Fases 1–2)

Centro de avisos **dentro do app** (sem push/e-mail). Plano: `PlanejamentoNotificacoes.md`.

| Peça | Onde |
| --- | --- |
| Schema + RLS (Fase 1) | `supabase/migrations/20260724114700_notifications.sql` |
| Tipos + anti-spam (Fase 2) | `supabase/migrations/20260724195000_notifications_fase2.sql` |
| Create / tipos | `src/notifications/create.ts` |
| Server functions | `src/notifications/functions.ts` (`runNotificationJobs` + CRUD) |
| Jobs / gatilhos | `src/notifications/jobs.ts` |
| Edge Function | `supabase/functions/notification-jobs/` |
| React Query | `src/notifications/queries.ts` |
| UI (sino + filtros) | `src/notifications/NotificationBell.tsx` |

**Tipos:** `mentor_challenge`, `mentor_challenge_done`, `mentor_challenge_expired`, `habit_reminder`, `streak_risk`, `habit_complete`, `system` (+ reservados `mentor_presence`, `achievement`).

**Gatilhos:** Charlie cria/conclui/expira desafio; cron diário (20:00 UTC) envia `habit_reminder` / `streak_risk` (máx. 1/dia; pula se todos hábitos feitos; quiet hours UTC 23–7).

**Cron:** secret `CRON_SECRET`; Edge `POST` com header `x-cron-secret`, ou server fn `runNotificationJobs`.

Fase 3 (settings + push/e-mail) ainda não implementada.

---

## 17. Como subir / aplicar banco (resumo)

1. `npm install`
2. Configurar `.env` (Supabase + OpenRouter)
3. Rodar a migration completa no SQL Editor do Supabase (ou CLI), preferindo `20260717004140_complete_schema.sql`
4. Aplicar também:
   - `20260724114700_notifications.sql` (Fase 1)
   - `20260724195000_notifications_fase2.sql` (Fase 2 — tipos + anti-spam)
5. (Opcional) Deploy do cron: `npx supabase functions deploy notification-jobs` + secret `CRON_SECRET` + schedule `0 20 * * *` UTC
6. `npm run dev`

Detalhes e troubleshooting de auth/projeto: `README.md`.

---

*Este documento descreve o estado real do código, não apenas a visão de produto. Ao implementar features novas, atualize as seções 7, 8, 14 e 15.*
