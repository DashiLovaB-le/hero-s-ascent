<p align="center">
  <img src="public/logo.png" alt="V-Project" width="280" />
</p>

<h1 align="center">V-Project</h1>

<p align="center">
  <strong>Desenvolvimento masculino gamificado pela Jornada do Herói.</strong><br />
  Hábitos, metas, XP e evolução de atributos — do Homem Comum à Lenda.
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

---

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Landing** (`/`) | Apresentação da jornada e CTA para entrar |
| **Auth** (`/auth`) | Login / cadastro (e-mail + senha) e Google OAuth |
| **Onboarding** | Escolha de áreas de foco e primeiras metas |
| **Jornada** (`/journey`) | Dashboard: nível, XP, streak, hábitos do dia, atributos |
| **Hábitos** (`/habits`) | CRUD de hábitos e check-off diário com XP |
| **Metas** (`/goals`) | Gestão das metas por categoria |
| **Perfil** (`/profile`) | Nome, bio e conquistas |

### Gamificação

- **12 níveis** — Homem Comum → Lenda  
- **8 atributos** — Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento, Liderança  
- **Streak** — dias consecutivos de hábitos concluídos  
- **Capítulos** da jornada e **conquistas**  
- Categorias de meta: Corpo, Mente, Espírito, Prosperidade, Relacionamentos, Propósito  

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
- Conta [Supabase](https://supabase.com) (ou projeto já provisionado)  
- npm  

---

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Crie um arquivo `.env` na raiz (com base no seu projeto Supabase):

```env
SUPABASE_PROJECT_ID=seu_project_id
SUPABASE_URL=https://seu_project_id.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

VITE_SUPABASE_PROJECT_ID=seu_project_id
VITE_SUPABASE_URL=https://seu_project_id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key
```

> A `SERVICE_ROLE_KEY` é só para o servidor — nunca exponha no client.

### 3. Banco de dados

As migrations ficam em `supabase/migrations/`. Aplique o schema no seu projeto Supabase (CLI ou SQL Editor), por exemplo:

```bash
npx supabase db push
```

Ou rode o SQL de `supabase/migrations/20260717004140_complete_schema.sql` no dashboard.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

Abra o endereço indicado no terminal (em geral `http://localhost:3000` ou a porta do Vite).

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

```
src/
  routes/                 # Rotas (file-based, TanStack Router)
    index.tsx             # Landing
    auth.tsx              # Login / cadastro
    _authenticated/       # Área logada (gate de sessão)
      journey.tsx
      habits.tsx
      goals.tsx
      profile.tsx
      onboarding.tsx
  components/ui/          # Componentes shadcn + estilo cyberpunk
  integrations/supabase/  # Client Auth / server
  lib/                    # Regras de XP, níveis, server functions
  styles.css              # Design tokens + utilitários cp-*
public/
  logo.png                # Logo do projeto
supabase/
  migrations/             # Schema Postgres + RLS
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
| `/profile` | Autenticado | Perfil |

---

## Design

- Tema **dark** com accent **laranja herói** (`#FC6E20`)  
- Tipografia display **Ethnocentric** + corpo **Chakra Petch**  
- Painéis com `clip-path` cyberpunk (`cp-panel`, `cp-modal`, `cp-toast`)  
- Navbar com glow no ícone da rota ativa  

---

## Licença

Projeto privado. Todos os direitos reservados.
