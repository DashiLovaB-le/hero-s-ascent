# V-Project — Plano de Construção

App de desenvolvimento masculino gamificado baseado na Jornada do Herói. Escopo grande, então vou construir em **fases entregáveis**, começando pelo MVP funcional e evoluindo.

---

## Design System (base de tudo)

- **Tema**: dark mode premium, minimalista
- **Cores** (tokens semânticos em `src/styles.css`, oklch):
  - Base: preto/grafite profundo
  - Accents: dourado (herói/XP), azul (sabedoria), vermelho (desafio/força)
- **Tipografia**: Space Grotesk (títulos) + Inter (corpo), via `<link>` no `__root.tsx`
- **Ícones**: Lucide React
- **Animações**: `tw-animate-css` (já instalado) — fade, slide-up, zoom
- Componentes shadcn customizados com variantes (hero, gold, quest)

---

## Fase 1 — Fundação e Autenticação

1. Ativar **Lovable Cloud** (Postgres + Auth + Storage + Realtime)
2. Design system completo em `src/styles.css` + fontes
3. Landing pública com CTA (`/`) — apresentação da Jornada
4. Auth: email/senha + Google (`/auth`), tabela `profiles` com avatar, nome, bio
5. Layout `_authenticated/` com gate gerenciado
6. Rota `/journey` — dashboard principal pós-login

## Fase 2 — Núcleo de Gamificação

Schema (migração única com GRANTs + RLS):
- `profiles` (avatar, nome, nível, xp_total, streak_atual, capitulo_atual, frase_motivacional)
- `attributes` (user_id, forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca)
- `levels` (nivel, titulo, xp_necessario) — seed: Aprendiz → Lenda
- `chapters` (numero, nome, descricao, xp_desbloqueio)
- `achievements` + `user_achievements`
- `activity_history` (log de ações)

Tela **Journey** (inicial): avatar, nome, nível, barra XP, streak, capítulo atual, missão principal, missões secundárias, frase motivacional, botão "Continuar Jornada".

## Fase 3 — Metas, Hábitos e Missões

- `goals` (metas escolhidas pelo usuário)
- `habits` (hábito, xp_recompensa, atributo_afetado, frequencia)
- `habit_completions` (log diário → alimenta streak e XP)
- `missions` (principal/secundária, capítulo, xp)
- Onboarding: seleção de metas → geração de rotina inicial de hábitos (regras + IA)
- Tela de hábitos diários com check-off, animação de XP ganho, atualização de atributos

## Fase 4 — Progresso Visual

- **Dashboard**: gráficos (Recharts) de XP, hábitos, disciplina, sono, treino, peso
- **Calendário**: heatmap de dias completos/incompletos
- **Perfil**: avatar, nível, títulos, conquistas desbloqueadas
- **Streak**: animações motivacionais em marcos (7, 30, 100 dias)

## Fase 5 — IA Mentor e Geração de Hábitos

- Integração com **Lovable AI Gateway** (openai/gpt-5.5)
- Server function `generateHabits` — recebe metas, retorna plano de hábitos personalizado
- Chat "Mentor" persistente com histórico em `mentor_messages`
- Sugestões contextuais baseadas em performance recente

## Fase 6 — Customização e Avatar

- Sistema de avatar evolutivo por nível (silhuetas/ilustrações geradas)
- Itens desbloqueáveis por conquistas
- Storage para upload de foto opcional

## Fase 7 — Extras

- Notificações motivacionais (in-app + web push)
- Admin dashboard (rota gated por role `admin` via tabela `user_roles`)
- Stripe (Lovable Payments) para tier premium
- MFA no Supabase Auth
- Audit logs

---

## Detalhes técnicos

- **Stack**: TanStack Start + React 19 + Vite 7 + Tailwind v4 + shadcn
- **Backend**: Lovable Cloud (Supabase gerenciado)
- **RLS**: todas as tabelas com policies `auth.uid() = user_id`; roles em tabela separada `user_roles` + função `has_role()` SECURITY DEFINER
- **Validação**: Zod em todos os formulários e server functions
- **Data**: TanStack Query com `ensureQueryData` em loaders + `useSuspenseQuery`
- **Server functions**: `createServerFn` com `requireSupabaseAuth` para tudo protegido
- **PT-BR**: toda UI, mensagens, seeds e conteúdo em português

---

## O que preciso confirmar antes de começar

Escopo enorme — sugiro começar pelas **Fases 1–3 (MVP jogável)** neste primeiro ciclo, e evoluir depois. Confirma?

Se sim, executo:
1. Ativar Lovable Cloud
2. Design system + landing + auth
3. Schema completo do núcleo de gamificação
4. Tela Journey funcional com metas → hábitos → XP → nível

Perguntas rápidas antes de codar:
- **Login social**: só Google + email/senha no MVP? (Apple pode vir depois)
- **Metas iniciais**: quais categorias oferecer? (ex: Corpo, Mente, Espírito, Prosperidade, Relacionamentos) — ou deixo eu propor?
- **Estética do avatar**: silhueta guerreiro/herói clássico, ou algo mais moderno/minimalista?
