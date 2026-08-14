# 06 — Checklist de reprodução (app do amigo)

Use este roteiro para montar o método Charlie do zero.

---

## Fase 0 — Contas e secrets

- [ ] Conta OpenRouter  
- [ ] Criar API key  
- [ ] Colocar no backend: `OPENROUTER_API_KEY`  
- [ ] Definir `OPENROUTER_MODEL=openrouter/free` (protótipo) **ou** um modelo pago estável  
- [ ] Confirmar que **nenhuma** env `VITE_` / `NEXT_PUBLIC_` carrega a key  

Ver: [02 — Proxy OpenRouter](./02-proxy-openrouter.md).

---

## Fase 1 — Proxy mínimo

- [ ] Endpoint autenticado `POST /api/mentor/chat`  
- [ ] Função `chatCompletion(messages)` → OpenRouter  
- [ ] Headers: Authorization, Content-Type, HTTP-Referer, X-Title  
- [ ] Tratar 401 / 429 / body vazio  
- [ ] Logar `usage.prompt_tokens` / `completion_tokens`  

Teste manual com curl/Postman até receber JSON.

---

## Fase 2 — Contrato do mentor

- [ ] System prompt de personagem + “responda só JSON”  
- [ ] System #2 com contexto fake (nome, streak, hábitos)  
- [ ] `response_format: { type: "json_object" }`  
- [ ] Parse + fallback se JSON quebrar (1 retry)  
- [ ] Persistir `message` como resposta do mentor  

Ver: [04 — Prompt, contexto e JSON](./04-prompt-contexto-json.md).

---

## Fase 3 — Dados reais

- [ ] Tabela de mensagens (user/assistant)  
- [ ] Montar histórico das últimas N msgs  
- [ ] Contexto gerado do DB do produto dele (não inventar no prompt)  
- [ ] Rate limit local (ex.: 20 msgs/hora/usuário)  

Ver: [03 — Turno de conversa](./03-turno-de-conversa.md).

---

## Fase 4 — Side effects

- [ ] Memórias com importância + teto  
- [ ] Desafios com prazo (validar no server)  
- [ ] (Opcional) sugestão de hábito com aceite na UI  
- [ ] Metadata na mensagem do assistente (model, ids)  

Ver: [05 — Dados e personalidades](./05-dados-personalidades.md).

---

## Fase 5 — Produto

- [ ] UI de chat  
- [ ] Presença ao abrir (manhã/retorno) — opcional  
- [ ] 2+ personalidades (mesmo protocolo, tons diferentes)  
- [ ] Tela admin para trocar modelo (`openrouter/free` ↔ pago)  
- [ ] Alertas se OpenRouter cair / 429 constante  

---

## Fase 6 — Endurecer free → produção

Se começar em `openrouter/free`:

- [ ] Medir taxa de JSON inválido  
- [ ] Definir fallback pago barato  
- [ ] Cap de gasto / alertas  
- [ ] Não depender de um único id free sem monitoramento  

---

## Mapa “V-Project → app dele”

| Peça V-Project | Equivalente genérico |
| --- | --- |
| `createServerFn` + Supabase auth | Route handler + sua auth |
| `src/mentor/openrouter.ts` | `lib/openrouter.ts` server-only |
| `resolveOpenRouterModel` | env + settings table |
| `buildMentorContextBlock` | `buildUserContext(userId)` |
| `parseMentorAiPayload` | zod schema do JSON |
| `mentor_*` tables | tabelas do domínio dele |
| Control room Tokens | painel admin / `.env` |

---

## Pitch de 60 segundos (para explicar oralmente)

> A gente não coloca a OpenRouter no front. O app chama o nosso servidor; o servidor monta a personalidade do mentor e um bloco com o estado real do usuário, pede JSON, e a OpenRouter (pode ser `openrouter/free` no começo) devolve a fala + ações. O servidor valida e grava. Assim o mentor fica acoplado ao produto, a chave fica segura, e trocar de modelo é só mudar um id.

---

## Onde está no repo

Pasta: `docs/charlie-metodo/`  
Código: `src/mentor/` + `src/lib/openrouter-model.server.ts`
