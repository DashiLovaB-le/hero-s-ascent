# 02 — Proxy OpenRouter (e o modelo `openrouter/free`)

## Por que “proxy”

A OpenRouter exige uma **API key**. Se essa key for parar no JavaScript do browser (`VITE_*`, Next public env, etc.), qualquer usuário extrai e gasta a sua cota.

**Método usado aqui:**

```
Client  ──(auth)──►  Seu backend  ──(Bearer OPENROUTER_API_KEY)──►  OpenRouter
                         ▲
                         │
              process.env / secrets
              (nunca no bundle client)
```

Na V-Project isso é feito com **TanStack Start `createServerFn`** + middleware `requireSupabaseAuth`.  
No app do seu amigo pode ser: Route Handler, Edge Function, Express, Nest, Hono — o padrão é o mesmo.

### Regras de ouro

1. `OPENROUTER_API_KEY` **só** no servidor  
2. Client só manda: texto da mensagem (+ sessão autenticada)  
3. Server monta o prompt e chama `https://openrouter.ai/api/v1/chat/completions`  
4. Server valida/parseia a resposta antes de confiar em side effects  

---

## Chamada HTTP (formato)

Endpoint:

```http
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json
HTTP-Referer: <url-do-seu-app>     # recomendado pela OpenRouter
X-Title: <nome-do-seu-app>
```

Body (essência):

```json
{
  "model": "openrouter/free",
  "messages": [
    { "role": "system", "content": "…persona + regras…" },
    { "role": "system", "content": "CONTEXTO ATUAL…\n…" },
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…" },
    { "role": "user", "content": "mensagem deste turno" }
  ],
  "temperature": 0.8,
  "max_tokens": 1200,
  "response_format": { "type": "json_object" }
}
```

`response_format: json_object` força o modelo a devolver JSON (quando o modelo suporte).  
O Charlie do produto usa isso sempre no chat.

Referência no repo: `src/mentor/openrouter.ts`.

---

## Variáveis de ambiente

| Variável | Onde | Função |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | servidor | Obrigatória — Bearer |
| `OPENROUTER_MODEL` | servidor | Fallback do id do modelo |
| (no produto) `mentor_settings.openrouter_model` | banco | Preferência do control room |

**Não existe** `VITE_OPENROUTER_API_KEY` de propósito.

---

## Como o modelo é escolhido (ordem)

No código da V-Project:

1. Cache em memória (~30s)  
2. Valor em `mentor_settings` (`key = openrouter_model`) — setado no admin `/dashitecnology/tokens`  
3. `process.env.OPENROUTER_MODEL`  
4. Default hardcoded: `anthropic/claude-sonnet-4`  

Arquivo: `src/lib/openrouter-model.server.ts`.

Para o app do amigo, basta:

```ts
const model =
  process.env.OPENROUTER_MODEL?.trim() ||
  "openrouter/free"; // ou outro id da OpenRouter
```

---

## Usando `openrouter/free`

### O que é

Na OpenRouter, **`openrouter/free`** (e outros ids `*:free`) são rotas de modelos **gratuitos / com cota free**.  
O id exato pode evoluir; confira sempre em:  
https://openrouter.ai/models (filtre por Free).

### Como plugar no método Charlie

É **só trocar o campo `model`** da mesma chamada. Não precisa de client diferente.

**Opção A — env**

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/free
```

**Opção B — admin / settings (como no produto)**  
Salvar `openrouter_model = openrouter/free` na tabela de settings e ler isso no `resolveModel()`.

### Limitações práticas do free (importante explicar)

| Ponto | Impacto no mentor |
| --- | --- |
| Rate limit / fila | Mais 429; trate com retry curto + mensagem amigável |
| Qualidade / JSON | Modelos free às vezes quebram o JSON; tenha parse defensivo + retry |
| `response_format` | Nem todo modelo free honra `json_object` tão bem — valide e faça fallback |
| Latência | Pode oscilar mais que Claude/GPT pagos |
| Disponibilidade | Rotas free mudam; não hardcode cegamente sem fallback |

### Padrão robusto (recomendado para o amigo)

```text
1. Tentar model = openrouter/free (ou OPENROUTER_MODEL)
2. Se JSON inválido ou finish_reason = length → 1 retry com temp menor / max_tokens ajustado
3. Se 429 → backoff + mensagem "mentor sobrecarregado"
4. Opcional: fallback para um modelo pago barato se free falhar N vezes
```

Na V-Project já existe retry quando a resposta vem truncada ou o JSON quebra (`callMentor` em `functions.ts`).

### Exemplo mínimo (Node)

```ts
async function chatCompletion(messages: { role: string; content: string }[]) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
      "X-Title": "Meu Mentor",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages,
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content as string;
}
```

---

## Telemetria de custo (opcional mas útil)

A V-Project grava em `ai_usage_events`:

- `prompt_tokens`, `completion_tokens`  
- `source` (ex.: `mentor:chat`, `mentor:morning`)  
- estimativa de custo via tabela `ai_cost_rates`  

Com `openrouter/free`, o custo tende a ~0; ainda assim vale logar tokens para achar loops e abuso.

---

## Rate limit no produto

Além dos limites da OpenRouter, o chat limita **20 mensagens de usuário / hora / conta** (contagem em `mentor_messages`).  
Reproduza algo parecido no app do amigo — free models sem teto local viram abuso fácil.

---

## Checklist rápido do proxy

- [ ] Key só no server  
- [ ] Endpoint único (`chatCompletion`) reutilizado (chat, presença, outras features)  
- [ ] Modelo configurável (`OPENROUTER_MODEL` / settings)  
- [ ] Headers `HTTP-Referer` + `X-Title`  
- [ ] Tratamento 401 / 429 / vazio  
- [ ] JSON mode + parse defensivo  
- [ ] Log de usage  
- [ ] Testado com `openrouter/free` **e** com um modelo pago (fallback)
