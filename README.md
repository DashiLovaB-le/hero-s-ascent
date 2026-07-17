<p align="center">
  <img src="public/logo.png" alt="V-Project" width="280" />
</p>

<h1 align="center">V-Project</h1>

<p align="center">
  <strong>Desenvolvimento masculino gamificado pela Jornada do Herói.</strong><br />
  Hábitos, metas, XP, atributos e mentor com IA — do Homem Comum à Lenda.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactquery&logoColor=white" alt="TanStack" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

---

## Sobre

O **V-Project** transforma autodisciplina em uma jornada. O usuário define metas, cria hábitos diários e ganha XP a cada conclusão — subindo de nível, mantendo streak e fortalecendo 8 atributos.

Inspirado na **Jornada do Herói**, o app guia o progresso em capítulos, com visual dark cyberpunk (painéis chanfrados, accent laranja `#FC6E20`).

O mentor **Charlie** acompanha a jornada com chat, memórias e desafios.

---

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Landing** (`/`) | Hero full-bleed, pilares e CTA |
| **Auth** (`/auth`) | Login / cadastro (e-mail + senha) e Google OAuth |
| **Onboarding** | Áreas de foco e primeiras metas |
| **Jornada** (`/journey`) | Dashboard: nível, XP, streak, hábitos do dia, atributos |
| **Hábitos** (`/habits`) | CRUD de hábitos e check-off diário com XP |
| **Metas** (`/goals`) | Gestão das metas por categoria |
| **Charlie** (`/mentor`) | Mentor com IA: chat, insights e desafios |
| **Perfil** (`/profile`) | Nome, bio e conquistas |

### Gamificação

- **12 níveis** — Homem Comum → Lenda
- **8 atributos** — Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento, Liderança
- **Streak** — dias consecutivos de hábitos concluídos
- **Capítulos** da jornada e **conquistas**
- Categorias: Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito

---

## Stack

- **Frontend:** React 19, TanStack Start / Router / Query, Vite 8
- **UI:** Tailwind CSS v4, shadcn/ui, Lucide, Sonner
- **Backend:** Supabase (Auth, Postgres, RLS)
- **Validação:** Zod
- **Idioma:** PT-BR

---

## Pré-requisitos

- Node.js 20+
- Conta [Supabase](https://supabase.com) — **projeto dedicado** (não compartilhe o banco com outros apps)
- npm

---

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Crie um `.env` na raiz. **Cliente e servidor devem apontar para o mesmo projeto:**

```env
SUPABASE_PROJECT_ID=seu_project_id
SUPABASE_URL=https://seu_project_id.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

VITE_SUPABASE_PROJECT_ID=seu_project_id
VITE_SUPABASE_URL=https://seu_project_id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

> `VITE_*` e `SUPABASE_*` (URL / publishable) precisam ser **iguais**.  
> `SERVICE_ROLE_KEY` só no servidor — nunca no client.  
> Após trocar de projeto: faça **redeploy**, limpe a sessão do browser e entre de novo.

### 3. Banco de dados

O schema completo (jornada + mentor + RLS + trigger de signup) está em:

```text
supabase/migrations/20260717004140_complete_schema.sql
```

No SQL Editor do projeto Supabase, execute esse arquivo (é suficiente para um banco novo).

As demais migrations da pasta são no-ops históricos (`SELECT 1`).

Opcional via CLI (com o projeto linkado):

```bash
npx supabase db push
```

### 4. Auth Google (opcional)

No dashboard do **mesmo** projeto Supabase, ative o provider Google.  
O app usa `supabase.auth.signInWithOAuth` nesse projeto (não Lovable Cloud Auth).

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

---

## Estrutura

```text
src/
  routes/
    index.tsx                 # Landing
    auth.tsx                  # Login / cadastro
    _authenticated/           # Área logada
      journey.tsx
      habits.tsx
      goals.tsx
      mentor.tsx              # Charlie
      profile.tsx
      onboarding.tsx
  mentor/                     # UI + server functions do mentor
  integrations/supabase/      # Client, auth middleware, env unificado
  lib/                        # XP, níveis, journey server functions
  styles.css                  # Tokens + utilitários cp-*
public/
  logo.png
  porta-login.png             # BG da /auth
  images/hero-section-lp.jpg  # Hero da landing
  fonts/                      # Ethnocentric
  animate-icons/              # GIFs do navbar mobile
supabase/
  migrations/                 # Schema Postgres + RLS
```

---

## Rotas

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `/` | Público | Landing |
| `/auth` | Público | Autenticação |
| `/onboarding` | Autenticado | Primeira configuração |
| `/journey` | Autenticado | Dashboard principal |
| `/habits` | Autenticado | Hábitos |
| `/goals` | Autenticado | Metas |
| `/mentor` | Autenticado | Charlie (mentor) |
| `/profile` | Autenticado | Perfil |

---

## Design

- Tema **dark** com accent **laranja herói** (`#FC6E20`)
- Tipografia: **Ethnocentric** (títulos) + **Chakra Petch** (corpo)
- Painéis com `clip-path` cyberpunk (`cp-panel`, `cp-modal`, `cp-brackets`, `cp-toast`)
- Navbar mobile: 5 colunas com botão elevado do **Charlie** no centro

---

## Auth e projeto Supabase

- Use um **projeto Supabase exclusivo** para o V-Project.
- Tokens de outro projeto geram `Unauthorized: Token from a different Supabase project`.
- O client limpa sessões antigas (`sb-*-auth`) automaticamente quando detecta mismatch.

---

## Licença

Projeto privado. Todos os direitos reservados.
