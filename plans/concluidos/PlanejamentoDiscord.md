# Planejamento — Notificações no Discord

Canal complementar ao in-app e ao Telegram, com a **mesma função**: vínculo seguro da conta + espelho de notificações (hábitos, streak, desafios do Charlie) via DM do bot.

Espelha o fluxo de `plans/concluidos/PlanejamentoTelegram.md`.  
Servidor Discord inicial (sem configs avançadas) **ajuda** como casa do bot / suporte, mas o envio principal é por **DM privada** (como no Telegram), não por canal do servidor.

**Status:** código D1–D4 implementado (2026-08-11) — falta deploy (migration + Edge + slash + Interactions URL).

---

## O que eu preciso que você informe / prepare

Sem esses itens não dá para fechar o fluxo ponta a ponta. Preencha a coluna **Status / valor** e mande no chat (ou confirme “já está nos Secrets”).

### Bloqueantes (preciso de você)

| # | Item | Onde pegar / como | Status / valor |
| --- | --- | --- | --- |
| 1 | **Application ID** | [Discord Developer Portal](https://discord.com/developers/applications) → Application ID | ✅ `1536763424292212846` |
| 2 | **Bot token** | Portal → Bot → Reset Token / Copy | ✅ no `.env` (`DISCORD_BOT_TOKEN`) — não versionar |
| 3 | **Public Key** | Portal → General Information → Public Key | ✅ no `.env` (`DISCORD_PUBLIC_KEY`) |
| 4 | **Bot username / invite** | Portal → Bot → username | ✅ `Charlie` |
| 5 | **URL pública do app** (produção) | Mesma `APP_PUBLIC_URL` do Telegram / URL do deploy | ✅ mesma do Telegram |
| 6 | **Preferência de envio** | Mesmos tipos do Telegram ou lista diferente? | ✅ mesmas do Telegram |
| 7 | **DM vs canal do servidor** | DM 1:1 (recomendado, espelha Telegram) **ou** também postar em um canal? | ✅ só DM |

### Útil (você já tem servidor — confirma)

| # | Item | Por quê | Status / valor |
| --- | --- | --- | --- |
| 8 | **Invite do servidor** (ou “só bot sem servidor”) | Casa oficial, onboarding, suporte; bot precisa estar no servidor se usarmos slash commands / roles | ⏳ |
| 9 | **Channel ID** (se quiser avisos no servidor) | Só se a opção 7 incluir canal | opcional |
| 10 | **Permissões mínimas do bot** | DM: bot + intent Message Content / Direct Messages conforme docs atuais; servidor: `Send Messages` no canal escolhido | confirmar após criar o bot |
| 11 | **Nome/avatar do bot** | Branding (ex.: Charlie / V-Project) | opcional |

### Secrets a criar (depois do token)

| Secret | Onde | Notas |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | Supabase Edge Secrets + `.env` servidor | Nunca `VITE_*` |
| `DISCORD_PUBLIC_KEY` | Edge Secrets | Verificação de assinatura do webhook |
| `DISCORD_APPLICATION_ID` | Edge / server | Deep links / invite |
| `DISCORD_WEBHOOK_SECRET` ou validação Ed25519 | Edge | Discord usa assinatura `X-Signature-*` + Public Key (preferir o padrão oficial) |
| `APP_PUBLIC_URL` | Já existe | Links nas mensagens |

> **Nota:** não cole o bot token neste arquivo nem em PRs. No chat, diga só “token nos Secrets” ou envie por canal seguro.

---

## Arquitetura (espelho do Telegram)

```
Usuário (Profile)
  → gera código one-time (TTL ~10 min)
  → abre link Discord (DM do bot / deep link com código)
     OU usa slash command /start <codigo> no servidor
  → Bot / Edge Function discord-webhook
      → valida código, salva discord_user_id no perfil
      → invalida código, confirma na DM

createNotification / notification-jobs
  → cria row in-app
  → se discord_user_id + opt-in → create DM / sendMessage
  → falha Discord NÃO quebra in-app nem Telegram
```

**Regras de segurança (iguais ao Telegram)**
- Token só em secret de servidor / Edge
- Código de vínculo aleatório (não é `user_id`); TTL curto; uso único
- `discord_user_id` escrito só por service role / webhook
- Opt-in explícito no Profile
- Anti-spam: reutilizar o mesmo do in-app
- Discord e Telegram independentes (usuário pode ter um, outro, ou os dois)

**Diferença importante Discord vs Telegram**
- Discord exige bot criado no Developer Portal + intents corretas
- DMs: o usuário precisa “abrir” o bot (comando / link) — fluxo de vínculo cobre isso
- Slash commands pedem registro de commands + bot no servidor (seu servidor inicial serve bem)
- Rate limits e política de DM são mais rígidos que Telegram — tratar erro sem abortar o job

---

## Schema (mínimo)

**Colunas em `profiles`**
- `discord_user_id TEXT NULL`
- `discord_opt_in BOOLEAN NOT NULL DEFAULT false`
- `discord_linked_at TIMESTAMPTZ NULL`

**Tabela `discord_link_codes`** (espelho de `telegram_link_codes`)
- `code TEXT PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES auth.users`
- `expires_at TIMESTAMPTZ NOT NULL`
- `used_at TIMESTAMPTZ NULL`

**RLS / guard**
- Usuário: insert/select dos próprios link codes; toggle opt-in; unlink (limpa id)
- Trigger/guard: usuário autenticado **não** seta `discord_user_id` arbitrário (como `guard_telegram_profile_cols`)

---

## Todo de implementação

### D0 — Decisões + credenciais (você)
- [x] Criar Application + Bot no Discord Developer Portal
- [x] Enviar/preencher a tabela **Bloqueantes** acima
- [x] Confirmar: **só DM** (recomendado) ou DM + canal do servidor
- [ ] Convidar o bot para o servidor inicial (opcional para DM; útil p/ testar slash)
- [x] Colocar `DISCORD_BOT_TOKEN` (+ public key / app id) no `.env`
- [x] Espelhar secrets no **Supabase Edge Secrets** (produção)

### D1 — Banco + Profile
- [x] Migration: colunas em `profiles` + `discord_link_codes` + RLS + guard
- [x] Server fns: `createDiscordLinkCode`, `unlinkDiscord`, `setDiscordOptIn`, `getDiscordSettings`
- [x] UI em `/profile`: card Discord (status, conectar, opt-in, desconectar) — ao lado do Telegram
- [x] Atualizar tipos Supabase + `plans/ResumoAplicacao.md`
- [x] **Você:** `npx supabase db push` (aplicar migration) → aplicada via Management API (histórico local desalinhado)

### D2 — Webhook / interactions do bot
- [x] Edge Function `discord-webhook` (verify_jwt off + validação de assinatura Discord)
- [x] Handler de vínculo: slash `/vincular` com option `codigo`
- [x] Resposta de sucesso/erro (ephemeral)
- [x] Script: `scripts/register-discord-commands.mjs`
- [x] **Você:** registrar commands + setar Interactions Endpoint URL + deploy da function  
  - commands ✅ · deploy ✅ · **Interactions URL ainda no Portal Discord**

### D3 — Envio espelhando notificações
- [x] Helper `sendDiscordDm` / `maybeSendDiscordNotification`
- [x] Hook em `createNotification` (e `notification-jobs`) junto do Telegram/push
- [x] Mesmos tipos padrão do Telegram
- [x] Texto PT-BR + link `APP_PUBLIC_URL`
- [x] Log de falha sem abortar o job
- [x] **Você:** redeploy `notification-jobs` + secrets Discord no Edge

### D4 — Admin + hardening
- [x] Página `/dashitecnology/discord` (overview: linked, opt-in, unlink)
- [x] UI com código copiável + instruções `/vincular`
- [x] Mensagem de boas-vindas no vínculo
- [ ] (Opcional) não reenviar o mesmo tipo no mesmo dia no Discord

**Critério de pronto:** usuário conecta Discord no Profile, liga opt-in, e recebe na DM a mesma classe de aviso do sino/Telegram — sem token no client e sem `user_id` no deep link.

---

## Deploy checklist (você — agora)

1. `npx supabase db push`
2. Supabase → Edge Secrets: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `APP_PUBLIC_URL`
3. Deploy:
   ```bash
   npx supabase functions deploy discord-webhook notification-jobs \
     --project-ref gmzddccyikpxbiozsiue --no-verify-jwt --use-api
   ```
4. `node --env-file=.env scripts/register-discord-commands.mjs`
5. Portal Discord → General Information → **Interactions Endpoint URL**:
   `https://gmzddccyikpxbiozsiue.supabase.co/functions/v1/discord-webhook`
   (salvar; Discord envia PING — a function deve responder `type: 1`)
6. Bot → ligar **Allow users to message / use commands in DMs** (se disponível)
7. Teste: Perfil → Conectar Discord → `/vincular` com o código

Opcional no `.env` local: `DISCORD_BOT_USERNAME=Charlie` (já é o default no código).

---

## Ordem de execução

1. **Você:** D0 (criar bot + secrets + responder a tabela bloqueante)
2. **Nós:** D1 (schema + Profile)
3. **Nós:** D2 (webhook) + **você:** Interactions Endpoint / invite no servidor
4. **Nós:** D3 (envio) + redeploy
5. **Nós:** D4 (admin) + teste ponta a ponta
6. Ajustes finos (avatar, texto, canal opcional)

---

## Papel do servidor Discord (o que você já tem)

Serve bem como:
- Lugar para o bot viver e usuários usarem `/vincular`
- Canal `#avisos` / `#suporte` (fase posterior, se quiser)
- Comunidade da V-Project

**Não é obrigatório** para o MVP de “mesma função do Telegram”: o MVP é **vínculo + DM de notificação**. Servidor sem configs avançadas é suficiente para começar.

---

## Fora de escopo (agora)

- Substituir o Telegram (os dois convivem)
- Encaminhar **todas** as mensagens do chat do Charlie
- Moderação, tickets, roles complexos, economia do servidor
- Voice / Discord Activities
- n8n ou automações externas
- Broadcast em massa para todos os membros do servidor

---

## Resumo do pedido a você (copiar e responder)

```
1. Application ID:
2. Bot username:
3. Public Key: (ok nos Secrets? sim/não)
4. Bot token: (ok nos Secrets? sim/não)  ← não cole o token aqui
5. APP_PUBLIC_URL confirma:
6. Tipos de notificação: padrão Telegram / lista:
7. Canal de envio: só DM / DM + canal do servidor
8. Invite do servidor (ou “só DM sem servidor”):
9. Channel ID (se canal): 
```
