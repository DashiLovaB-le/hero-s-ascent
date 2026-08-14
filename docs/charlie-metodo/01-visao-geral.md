# 01 — Visão geral do Charlie

## O que é

O **Charlie** é o mentor de IA da jornada do herói. Ele:

- conversa em português, em personagem (nunca como “assistente genérico”);
- recebe **contexto vivo** da jornada (hábitos, streak, XP, metas, ML, identidade/alter ego, clima…);
- responde em **JSON estruturado** (não só texto solto);
- pode gravar **memória**, definir **objetivo**, criar **desafio** com prazo, sugerir **hábito novo** ou fazer **pergunta estruturada**.

## O que ele não é

| Não é | Por quê |
| --- | --- |
| ChatGPT embutido no front | A chave OpenRouter **nunca** vai para o browser |
| O alter ego do herói | Alter ego = identidade do usuário; Charlie = guardião dessa identidade |
| Um bot Discord/Telegram | Discord/Telegram só **espelham notificações**; o chat vive no app |
| Um modelo “fixado” no código | O modelo é configurável (env / control room) |

## Peças do produto (mapa mental)

```
┌─────────────────────────────────────────────────────────┐
│  APP (UI)                                               │
│  /mentor  · card na Jornada  · nav Charlie              │
└───────────────────────────┬─────────────────────────────┘
                            │ server function + JWT
┌───────────────────────────▼─────────────────────────────┐
│  SERVIDOR                                               │
│  1. Auth + rate limit                                   │
│  2. Salva msg do usuário                                │
│  3. Monta system prompt (personalidade)                 │
│  4. Monta CONTEXTO DA JORNADA                           │
│  5. Chama OpenRouter (proxy)                            │
│  6. Parse JSON → side effects no DB                     │
│  7. Salva msg do assistente + notifica se preciso       │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS + Bearer
┌───────────────────────────▼─────────────────────────────┐
│  OPENROUTER                                             │
│  /api/v1/chat/completions                               │
│  model = o que estiver configurado                      │
│  (ex.: anthropic/claude-sonnet-4  ou  openrouter/free)  │
└─────────────────────────────────────────────────────────┘
```

## Ideia que vale reproduzir

O “truque” do Charlie não é um modelo mágico. É o **pipeline**:

1. **Proxy** (chave segura)  
2. **Contexto rico e atualizado** injetado a cada turno  
3. **Contrato JSON** com side effects validados no servidor  
4. **Personagem + protocolo** (ciclo observar→…→aprender, sem narrar isso ao usuário)

Sem o item 2 e 3, vira só um chatbot. Com eles, vira um mentor acoplado ao produto.

## Personalidades (tom)

O usuário escolhe um “Charlie”:

- Clássico, Militar, Estoico, Empresarial, Cristão, Fitness, Financeiro  

O **protocolo JSON e as mecânicas** são compartilhados; muda a **voz/identidade**.  
Detalhes em [05 — Dados e personalidades](./05-dados-personalidades.md).

## Presença proativa

Além do chat manual, ao abrir o mentor o servidor pode disparar mensagens de:

- boas-vindas / manhã / noite / retorno após ausência  

Isso usa o **mesmo** `callMentor` + OpenRouter, com `kind` diferente (`welcome`, `morning`, `evening`, `return`).
