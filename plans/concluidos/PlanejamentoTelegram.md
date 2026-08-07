# Planejamento — Notificações no Telegram

Canal complementar ao in-app (Fases 1–2). Sem n8n. Envio na mesma Edge Function `notification-jobs` + vínculo seguro no app.

---

## O que você precisa enviar / preparar (checklist)

Preencha e mande no chat (ou confirme “já está no Supabase Secrets”):

| # | Item | Onde pegar / como | Exemplo / status |
| --- | --- | --- | --- |
| 1 | **Bot username** | [@BotFather](https://t.me/BotFather) → `/newbot` | `@DashiVProject_bot` ✅ |
| 2 | **Bot token** | BotFather → token | Secrets / `.env` ✅ (rotacionado) |
| 3 | **URL pública do app** (produção) | Deploy do V-Project | `https://v-projectdashi.lovable.app` ✅ |
| 4 | Confirmar secrets | Supabase → Edge Functions → Secrets | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_PUBLIC_URL` |
| 5 | Preferência de tipos no Whats… Telegram | Quais tipos enviam | Padrão: `habit_reminder`, `streak_risk`, `mentor_challenge`, `mentor_challenge_expired` (não cada chat) |

Opcional depois:
- Foto/descrição do bot no BotFather  
- Link do app nas mensagens (deep link web)

---

## Arquitetura (segura)

```
Usuário (Profile)
  → gera código one-time (TTL curto)
  → abre t.me/Bot?start=<codigo>
  → Bot recebe /start
  → Edge Function telegram-webhook (secret)
      → valida código, salva chat_id no perfil
      → invalida código

Cron 22:00 BRT (já existe)
  → notification-jobs
      → cria row em `notifications` (in-app)
      → se telegram_chat_id + opt-in → sendMessage
```

**Regras de segurança**
- Token do bot **só** em secret de servidor / Edge (nunca `VITE_*`)
- Webhook com `secret_token` (header `X-Telegram-Bot-Api-Secret-Token`)
- Código de vínculo: aleatório, **não** é o `user_id`; expira em ~10 min; uso único
- RLS: usuário só lê/atualiza o próprio opt-in; `chat_id` só escrito pelo service role / webhook
- Opt-in explícito no Profile (toggle)
- Se Telegram falhar → in-app permanece (sem quebrar o job)
- Mesmo anti-spam do in-app (1 reminder/streak por dia)

---

## Schema (mínimo)

**Opção A — colunas em `profiles` (rápido)**  
- `telegram_chat_id TEXT NULL`  
- `telegram_opt_in BOOLEAN NOT NULL DEFAULT false`  
- `telegram_linked_at TIMESTAMPTZ NULL`

**Tabela auxiliar `telegram_link_codes`**  
- `code TEXT PRIMARY KEY`  
- `user_id UUID NOT NULL REFERENCES auth.users`  
- `expires_at TIMESTAMPTZ NOT NULL`  
- `used_at TIMESTAMPTZ NULL`

---

## Fases de implementação

### T1 — Banco + Profile (vínculo)
- [x] Migration colunas + `telegram_link_codes` + RLS
- [x] Server fns: `createTelegramLinkCode`, `unlinkTelegram`, `setTelegramOptIn`
- [x] UI em `/profile`: status, botão “Conectar Telegram”, toggle opt-in, “Desconectar”
- [x] Atualizar `plans/ResumoAplicacao.md`

### T2 — Webhook do bot
- [x] Edge Function `telegram-webhook` (`verify_jwt = false` + secret header)
- [x] Handler `/start <code>` → associa `chat_id`, marca código usado, responde no Telegram
- [x] Script/docs: `setWebhook` com `secret_token` (você no painel)
- [x] Redeploy + teste com `/start` real

### T3 — Envio no cron
- [x] Helper `sendTelegramMessage` / `maybeSendTelegramNotification`
- [x] Em `notification-jobs` + `createNotification`: envia se opt-in
- [x] Texto PT-BR + link do app
- [x] Log de falha sem abortar o job
- [x] Redeploy `notification-jobs` + secrets `APP_PUBLIC_URL`

### T4 — Hardening (rápido)
- [ ] Não reenviar se já mandou o mesmo tipo hoje no Telegram (opcional: flag em metadata ou confiar no anti-spam in-app)
- [ ] Mensagem de boas-vindas no `/start`
- [ ] Empty/erro states na UI (código expirado, bot não iniciado)

**Critério de pronto:** usuário conecta o bot no Profile, liga opt-in, e às 22:00 (ou teste manual) recebe no Telegram a mesma classe de aviso do sino — sem token no client e sem vazamento de `user_id` no deep link.

---

## Ordem de execução

1. Você: cria bot + coloca `TELEGRAM_BOT_TOKEN` nos Secrets + manda username + URL do app  
2. Nós: T1 (schema + Profile)  
3. Nós: T2 (webhook) + você: `setWebhook`  
4. Nós: T3 (envio no cron) + redeploy  
5. Teste ponta a ponta  

---

## Fora de escopo (agora)

- WhatsApp / e-mail / Web Push  
- Encaminhar **todas** as mensagens do Charlie  
- Grupos Telegram / canal broadcast  
- n8n ou automações externas  
