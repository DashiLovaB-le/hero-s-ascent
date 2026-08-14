# Charlie — método para outro desenvolvedor

Documentação **reproduzível** de como o mentor Charlie funciona na V-Project / Hero’s Ascent.

Objetivo: um amigo dev conseguir entender a arquitetura e montar o **mesmo padrão** no app dele (proxy server → OpenRouter → JSON estruturado → efeitos no banco).

---

## Índice

| Doc | Conteúdo |
| --- | --- |
| [01 — Visão geral](./01-visao-geral.md) | O que é o Charlie, o que ele **não** é, peças do produto |
| [02 — Proxy OpenRouter](./02-proxy-openrouter.md) | Chave no servidor, chamada HTTP, modelo, **`openrouter/free`** |
| [03 — Turno de conversa](./03-turno-de-conversa.md) | Fluxo ponta a ponta de uma mensagem |
| [04 — Prompt, contexto e JSON](./04-prompt-contexto-json.md) | System prompt, bloco de contexto, contrato JSON |
| [05 — Dados e personalidades](./05-dados-personalidades.md) | Tabelas, memórias, desafios, variantes do Charlie |
| [06 — Checklist de reprodução](./06-checklist-reproducao.md) | Passo a passo mínimo para copiar o método |

---

## Em uma frase

> O Charlie **não roda no browser**. O client chama uma **server function autenticada**; o servidor monta prompt + contexto da jornada, chama a **OpenRouter** com a chave secreta, exige **JSON**, interpreta a resposta e grava efeitos (mensagem, memória, desafio, hábito pendente, objetivo).

---

## Código de referência neste repo

| Pasta / arquivo | Papel |
| --- | --- |
| `src/mentor/openrouter.ts` | Client HTTP OpenRouter (server-only) |
| `src/lib/openrouter-model.server.ts` | Resolução do modelo ativo |
| `src/mentor/functions.ts` | Chat, presença, desafios, rate limit |
| `src/mentor/context.ts` | Prompt default, contexto, parse JSON |
| `src/mentor/personalities.seed.ts` | Variantes + protocolo compartilhado |
| `src/mentor/prompt.server.ts` | Prompt por personalidade do usuário |
| `src/routes/dashitecnology/tokens.tsx` | Admin: trocar modelo / ver uso |
| `src/routes/dashitecnology/charlie.tsx` | Admin: editar prompts |

---

## Pré-requisito para o amigo

1. Conta em [openrouter.ai](https://openrouter.ai)  
2. API key (nunca no front)  
3. Backend qualquer (Node, Edge, serverless) que possa guardar secrets  
4. Banco para histórico / memórias / desafios (Postgres recomendado)

Quando for usar modelo free, ver seção dedicada em [02 — Proxy OpenRouter](./02-proxy-openrouter.md).
