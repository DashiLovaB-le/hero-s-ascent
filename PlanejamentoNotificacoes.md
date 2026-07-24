# Planejamento — Sistema de Notificações

To-do por fases. Marque `[x]` conforme concluir.  
Fonte da verdade futura: tabela `notifications` (in-app primeiro; push/e-mail depois).

---

## Fase 1 — Núcleo in-app (base)

Objetivo: centro de notificações no app, sem push.

- [x] Criar migration `notifications`
  - [x] Colunas: `id`, `user_id`, `tipo`, `titulo`, `corpo`, `metadata` (JSONB), `lido_em`, `created_at`
  - [x] FK `user_id` → `auth.users` ON DELETE CASCADE
  - [x] Índice `(user_id, created_at DESC)` e `(user_id, lido_em)` para não lidas
- [x] RLS: usuário só SELECT/UPDATE (marcar lida) nas próprias rows
  - [x] Policy SELECT `auth.uid() = user_id`
  - [x] Policy UPDATE `auth.uid() = user_id` (só `lido_em`)
  - [x] INSERT via service role / server function (não pelo cliente direto, se preferir)
- [x] Server functions
  - [x] `listNotifications` (paginado, filtro lidas/não lidas)
  - [x] `markNotificationRead` (por id)
  - [x] `markAllNotificationsRead`
  - [x] `getUnreadNotificationCount`
- [x] React Query
  - [x] Query keys: `["notifications"]`, `["notifications-unread-count"]`
  - [x] `staleTime` alinhado ao resto do app (~15–30s)
- [x] UI
  - [x] Sino no header autenticado (`/_authenticated/route.tsx`)
  - [x] Badge com contagem de não lidas
  - [x] Drawer / painel / página de lista (clip-path `cp-panel` / `cp-modal`)
  - [x] Ação: tocar → marcar lida (+ deep link opcional via `metadata`)
- [x] Tipos iniciais (enum ou text + Zod)
  - [x] `mentor_challenge` — Charlie criou desafio
  - [x] `habit_complete` — feedback opcional (avaliar se vale ou só toast)
  - [x] `system` — genérico
  - [x] `mentor_challenge_done` — desafio concluído (+XP)
- [x] Wire nos fluxos existentes
  - [x] Ao criar desafio do Charlie → insert em `notifications`
  - [x] Ao concluir desafio → insert opcional (“desafio concluído +XP”)
- [x] Atualizar `StatusAplicacao.md` com a seção de notificações

**Critério de pronto (Fase 1):** usuário vê sino, lista notificações, marca como lida; pelo menos 1 evento real (desafio Charlie) gera notificação.

> Migration: `supabase/migrations/20260724114700_notifications.sql` — aplicar no projeto remoto (`supabase db push` ou SQL no dashboard) se ainda não estiver aplicada.

---

## Fase 2 — Gatilhos de produto (valor)

Objetivo: notificações que puxam o loop (streak, hábitos, Charlie), sem spam.

- [ ] Definir catálogo final de tipos
  - [ ] `habit_reminder` — missão do dia incompleta até horário X
  - [ ] `streak_risk` — sem conclusão hoje e tem streak > 0
  - [ ] `mentor_challenge` — (já na fase 1) criar / expirar
  - [ ] `mentor_presence` — opcional (amanhecer/anoitecer); preferir só mensagem no `/mentor` se for barulhento
  - [ ] `achievement` — quando existir engine de unlock
- [ ] Regras anti-spam
  - [ ] Máx. 1 notificação/dia por (`user_id`, `tipo`) nos reminders
  - [ ] Não notificar se usuário já completou todos os hábitos do dia
  - [ ] Quiet hours opcional (ex.: não mandar entre 23h–7h)
- [ ] Jobs / Cron
  - [ ] Edge Function ou `pg_cron` diário (ex.: 20h horário do usuário ou UTC fixo documentado)
  - [ ] Job de expiração de desafios (`ativo` → `expirado` + notificação)
- [ ] Deep links em `metadata`
  - [ ] `{ "href": "/mentor" }` / `{ "href": "/habits" }` / `{ "challenge_id": "..." }`
  - [ ] Navegação ao tocar na notificação
- [ ] UI
  - [ ] Filtros: Todas / Não lidas
  - [ ] Empty state (“Nada por aqui, herói”)
- [ ] Telemetria leve (opcional)
  - [ ] Logar abertura do painel / clique (para saber se a fase 3 vale a pena)

**Critério de pronto (Fase 2):** reminders diários e risco de streak funcionando; desafios expirados avisam; sem flood de toasts duplicados.

---

## Fase 3 — Push / e-mail (alcance)

Objetivo: avisar fora do app, **só depois** do in-app estável.

- [ ] Preferências do usuário
  - [ ] Tabela `notification_settings` **ou** colunas em `profiles`
  - [ ] Toggles por canal: in-app (sempre on), push, e-mail
  - [ ] Toggles por tipo: reminder, streak, mentor, conquistas
  - [ ] Tela em `/profile` (“Notificações”)
- [ ] Web Push
  - [ ] Service worker + VAPID keys
  - [ ] Tabela `push_subscriptions` (`user_id`, `endpoint`, `keys`, `created_at`)
  - [ ] Opt-in explícito (prompt do browser só após ação do usuário)
  - [ ] Envio espelhando rows de `notifications` (mesma fonte da verdade)
- [ ] E-mail (alternativa ou complemento)
  - [ ] Provider (Resend / outro) + templates PT-BR
  - [ ] Só tipos de alto valor (streak risk, desafio novo) — não cada hábito
- [ ] Respeito a preferências em todos os jobs da fase 2
- [ ] Fallback: se push falhar, notificação in-app continua existindo
- [ ] Privacidade / LGPD: texto claro no opt-in; como desativar

**Critério de pronto (Fase 3):** usuário controla canais; push ou e-mail chega para pelo menos 1 tipo; in-app permanece a fonte da verdade.

---

## Fora de escopo (por enquanto)

Não fazer nestas fases:

- [ ] ~~Realtime obrigatório para cada insert~~ (pode ser polling do badge)
- [ ] ~~Notificar absolutamente tudo~~ (hábitos triviais, cada mensagem do chat)
- [ ] ~~MFA / billing hooks como notificação~~
- [ ] ~~App nativo (FCM/APNs)~~ — só Web Push se for web

---

## Ordem de execução (checklist mestre)

1. [x] **Fase 1** — schema + RLS + listar/marcar + sino + wire Charlie
2. [ ] **Fase 2** — tipos de produto + cron + deep links + anti-spam
3. [ ] Validar uso (usuário abre o sino? age nos reminders?)
4. [ ] **Fase 3** — settings + push e/ou e-mail

---

## Notas de implementação (stack atual)

- Banco: migration em `supabase/migrations/`
- API: TanStack `createServerFn` + `requireSupabaseAuth`
- UI: shell em `src/routes/_authenticated/route.tsx`; visual `cp-panel` / paleta V-Project
- Toasts Sonner: manter para feedback **imediato** da ação; notificações = histórico + badge
- Atualizar docs: `StatusAplicacao.md` e, se útil, `RelacaoDeIcones.md` (ícone do sino)
