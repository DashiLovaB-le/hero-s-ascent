# 04 — Prompt, contexto e contrato JSON

O Charlie funciona porque a LLM não “adivinha” o estado do app: o servidor **injeta** o estado a cada turno.

## Camada 1 — System prompt (persona + protocolo)

Duas ideias juntas:

1. **Identidade / tom** (Clássico, Militar, Estoico…)  
2. **Protocolo compartilhado** — ciclo interno, regras de desafio vs hábito, formato JSON, “nunca quebre o personagem”

No repo:

- Default longo: `MENTOR_SYSTEM_PROMPT_DEFAULT` em `src/mentor/context.ts`  
- Protocolo compartilhado: `MENTOR_SHARED_PROTOCOL` em `src/mentor/personalities.seed.ts`  
- Resolução por usuário: `getMentorSystemPromptForUser` (`prompt.server.ts`) lê `profiles.charlie_personality` → `mentor_personalities.system_prompt`

### Ciclo interno (não narrar ao usuário)

1. Observar  
2. Pensar  
3. Planejar  
4. Executar  
5. Verificar  
6. Aprender  

Há uma linha `FASE DO CICLO` no contexto; o modelo prioriza essa fase **sem** falar “fase” ou “algoritmo” para o herói.

---

## Camada 2 — Contexto da jornada

Segundo `system` message, prefixo tipicamente:

```text
CONTEXTO ATUAL DA JORNADA
…
```

Conteúdo típico (V-Project):

- Nome do herói, dias na jornada, nível/XP, capítulo, streak  
- Personalidade ativa do Charlie  
- Fase do ciclo do mentor  
- Objetivo atual do mentor  
- Atributos, metas, hábitos (com ids)  
- Feitos / pendentes de hoje  
- Memórias (top por importância)  
- Desafios ativos  
- Sinais ML (risco streak/abandono/identidade)  
- Check-ins, clima, resumo de xadrez, alter ego / provas de identidade  
- Flags: “pode fazer pergunta estruturada?”, política adaptativa de desafios  

Função: `buildMentorContextBlock` em `src/mentor/context.ts`.

### Por que isso importa para reproduzir

No app do amigo, o contexto pode ser menor no início:

```text
Nome:
Streak:
Hábitos de hoje (feitos / faltam):
Últimas 5 memórias:
Desafio ativo:
```

O padrão é: **dados reais do DB → texto determinístico → system #2**.

---

## Camada 3 — Histórico

Últimas N mensagens (no produto: ordem de grandeza ~14–16).  
Evita estourar contexto/custo — especialmente no `openrouter/free`.

---

## Camada 4 — Contrato JSON (obrigatório)

O modelo deve responder **apenas** com JSON válido, no espírito de:

```json
{
  "message": "texto falado ao herói",
  "memory": null,
  "memory_importance": 1,
  "question": null,
  "objective": null,
  "challenge": null,
  "habit_suggestion": null
}
```

### Regras de produto (servidor reforça)

| Regra | Motivo |
| --- | --- |
| `challenge` XOR `habit_suggestion` | Missão com prazo ≠ rotina permanente |
| `message` curto | UX + caber no `max_tokens` |
| Sem emojis / sem “Como posso ajudar?” | Manter personagem |
| `habit_id` só se existir no contexto | Evitar UUID inventado |
| Memória só em marcos reais | Não poluir long-term memory |

Parse: `parseMentorAiPayload` em `context.ts`.

---

## Sabedoria (opcional)

Cartas curtas (`charlie_wisdom_cards`) podem ser anexadas ao contexto.  
Útil como “temperos” narrativos — não são obrigatórias para o método mínimo.

---

## Template mínimo para o amigo

**System 1**

```text
Você é <NomeDoMentor>, mentor firme e humano.
Responda SEMPRE em JSON válido com as chaves:
message, memory, memory_importance, challenge.
Português do Brasil. Sem emojis. Sem quebrar personagem.
```

**System 2**

```text
CONTEXTO
nome: …
streak: …
habitos_hoje: …
memórias: …
```

**User**

```text
(texto do usuário)
```

**Server**

```ts
const raw = await chatCompletion(...);
const data = JSON.parse(raw);
await saveAssistant(data.message);
if (data.memory) await saveMemory(data.memory, data.memory_importance);
if (data.challenge) await createChallenge(validate(data.challenge));
```

Escale o contrato depois (perguntas, objetivos, hábitos, ML).
