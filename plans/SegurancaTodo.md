# To-do de segurança — V-Project (pré-teste Vercel)

Ordem: **mais crítico → menos crítico**.  
Marque `[x]` conforme concluir. Base: panorama de segurança (jul/2026).

---

## P0 — Bloqueantes (antes de abrir o teste)

- [x] **1.** Criar trigger em `profiles` que impeça o client de alterar: `xp_total`, `streak_atual`, `streak_maximo`, `capitulo_atual`, `onboarding_completo`, `ultimo_dia_completo` (e reforçar Telegram) — só service role / caminhos server
- [x] **2.** Restringir RLS/grants: client não deve INSERT/UPDATE livremente `habit_completions`, `user_achievements`, conclusões de `mentor_challenges`, progresso/status de `missions`, nem maxar `attributes` sem passar por server fn / RPC
- [x] **3.** Adicionar `CHECK` no banco em `habits.xp_recompensa` (ex.: `BETWEEN 5 AND 50`) alinhado à API
- [ ] **4.** (Opcional P0+) `REVOKE`/`GRANT` por coluna nas sensíveis de `profiles` se o time preferir grants em vez de só trigger
- [ ] **5.** Conferir env na **Vercel Production**: `VITE_SUPABASE_*` = público; `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_*`, `CRON_SECRET`, Telegram **sem** prefixo `VITE_`
- [ ] **6.** Alinhar `VITE_SUPABASE_*` e `SUPABASE_*` ao **mesmo** projeto Supabase
- [ ] **7.** Supabase Auth: Site URL + Redirect URLs com domínio Vercel (e previews se usados)
- [ ] **8.** Bootstrap admin: setar `DASHI_BOOTSTRAP_EMAIL` → reivindicar `dashi` → **remover** o env do servidor
- [x] **9.** Pós-`npm run build`: grepar bundle client por `service_role`, JWT de service, `OPENROUTER`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`
- [ ] **10.** Rotacionar secrets que já tenham vazado (git/chat/histórico): service role, OpenRouter, Telegram, `CRON_SECRET`, tokens `sbp_` se existirem

---

## P1 — Alto (logo no início do teste)

- [x] **11.** Rate limit **durável** (DB/contador) em `suggestHabitsFromGoals` — não usar só `Map` em memória (Vercel)
- [x] **12.** Teto diário de tokens/custo OpenRouter (habit-suggest + mentor) + `usageContext` / kill switch
- [x] **13.** Proteger `runNotificationJobs`: preferir só Edge + header `x-cron-secret`; não expor server fn ampla com secret no body; usar `crypto.timingSafeEqual`
- [x] **14.** Timing-safe em todos os compares de secret (cron Edge, telegram-webhook, jobs ML/agent se houver)
- [x] **15.** Headers de segurança na Vercel (`vercel.json` / Nitro): CSP (começar Report-Only), HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`
- [x] **16.** Subir senha mínima (8–12) no formulário de auth + ativar proteção de senha vazada no Supabase Auth se disponível
- [x] **17.** Edge cron: aceitar **somente POST**; rotacionar `CRON_SECRET` (teste → prod)
- [ ] **18.** Documentar no `.env.example`: `DASHI_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_EMAIL` e aviso para remover após bootstrap

---

## P2 — Médio / endurecimento do produto

- [x] **19.** Baixar teto de XP de hábito na API (`createHabit` / `updateHabit`) para alinhar ao CHECK do DB (ex. 10–30)
- [x] **20.** Impedir INSERT client de `mentor_messages` com `role = 'assistant'` (só server/service role)
- [ ] **21.** Sanitizar / allowlist `image_url` de wallpapers (rejeitar `"`, schemes estranhos, hosts não confiáveis)
- [ ] **22.** Revisar race do código Telegram (`used_at`) — update atômico / unique parcial
- [x] **23.** Revisar RLS de `activity_history` e demais tabelas “só write server”
- [ ] **24.** Cap de payload/timeout em server fns e chamadas OpenRouter
- [ ] **25.** Logging/alerta de abuso: picos de XP, picos OpenRouter, falhas repetidas de secret
- [ ] **26.** (Opcional) ocultar UI `/dashitecnology` de não-dashi (API já deve bloquear)
- [ ] **27.** Política de Preview Deployments: env separados + Auth URLs de preview

---

## P3 — Baixo / higiene

- [ ] **28.** Confirmar que nenhum componente client importa `client.server` / service role
- [ ] **29.** Auditar `dangerouslySetInnerHTML` (hoje charts) — manter sem HTML de usuário/IA
- [ ] **30.** Reduzir info disclosure do bootstrap/admins totais para usuários logados comuns
- [ ] **31.** Atualizar `plans/ResumoAplicacao.md` / este to-do quando P0–P1 fecharem

---

## Ordem sugerida de execução (resumo)

```text
1–4   Economia / RLS / CHECKs
5–10  Vercel env + Auth URLs + bootstrap + grep + rotação
11–18 Rate limit IA + cron + headers + senha
19–27 Endurecimento produto
28–31 Higiene / docs
```

---

## Critério “ok para teste fechado”

- [ ] Itens **1–3** e **5–9** concluídos  
- [ ] Pelo menos **11**, **13** e **15** em andamento ou feitos  
- [ ] Smoke: conta tester não consegue mudar `xp_total` via REST com JWT próprio

### Notas (2026-07-29)

- Migration aplicada no remoto: `20260729164910_harden_progression_rls.sql` (via `db query --linked`; `db push` completo falha por histórico dessincronizado / `auth.users`).
- Server fns de progresso/missões/mentor usam `supabaseAdmin` para writes sensíveis.
- API + UI de hábitos: `xp_recompensa` max **50**.
- Item **20** (`mentor_messages` role): RLS `WITH CHECK (role = 'user')`; insert assistant via `supabaseAdmin`.
- **11–17, 20 (2026-08-14):** rate limit DB `user_rate_limits` + teto OpenRouter/`OPENROUTER_KILL_SWITCH`; cron só POST + timing-safe; headers CSP Report-Only; senha mín. 12 no cadastro/troca (login ainda aceita senhas antigas ≥6). HaveIBeenPwned e rotação de `CRON_SECRET` são no painel (Auth + secrets), não no código.
- **9 (2026-08-14):** `npm run check:bundle` (depois de `npm run build`) varre `.vercel/output/static` por nomes de secret, JWT `service_role` e valores do `.env`. Também: `npm run build:check`.
- **Rotacionar** o token `sbp_` usado neste deploy (item 10).

---

*Arquivo vivo. Ao implementar, preferir migrations + PRs pequenos por bloco (economia → deploy → IA/cron → headers).*
