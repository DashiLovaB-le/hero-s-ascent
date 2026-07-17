# Charlie — O que vale implementar agora

Documento de priorização baseado no estado atual do V-Project e na visão de `upgrade-Charlie.md`.

**Objetivo:** aproximar Charlie de um mentor contínuo **sem** inverter ainda o produto para “Charlie é o hub de tudo”.

**Fora de escopo neste ciclo:** planos de 21 dias, Charlie como home/núcleo da UX, estados internos complexos, log de sessão completo.

---

## Princípio

Hoje Charlie já é um bom **conselheiro lateral** (contexto, chat, memórias, desafios, XP).  
O próximo passo não é reinventar o app — é dar a Charlie **direção, memória melhor e desafios mais honestos**.

Isso entrega boa parte da “magia” da visão com esforço controlado.

---

## Fase 1 — Implementar agora (alto valor / baixo–médio esforço)

### 1. Objetivo atual do Charlie (persistente)

**O quê**  
Charlie passa a ter um objetivo explícito por usuário, por exemplo:

- “Levar [nome] até Guerreiro (nível 5)”
- “Recuperar disciplina após quebra de streak”
- “Preparar o Capítulo 2”

**Por quê**  
É a ideia mais barata e mais transformadora do upgrade: conversas deixam de ser genéricas e passam a ter missão.

**Como (orientação)**  
- Campo/tabela simples (`mentor_objective` ou colunas em perfil/mentor): título, motivo, created_at, ativo  
- Incluir no system prompt em toda chamada  
- UI mínima: uma linha no topo do `/mentor` (“Objetivo do mentor: …”)  
- Atualização: manual no início, ou 1 sugestão da IA quando o usuário sobe de nível / completa onboarding  

**Critério de pronto**  
Toda mensagem do Charlie é coerente com o objetivo ativo; o usuário vê o objetivo na tela.

---

### 2. Perguntas estruturadas (e memória da resposta)

**O quê**  
Charlie pergunta de forma deliberada (não só responde), em momentos claros:

- após falha de hábito importante  
- após retorno (≥3 dias)  
- após concluir / recusar desafio  

Exemplos:

- “Foi falta de tempo ou de energia?”  
- “Qual hábito mais trava sua evolução agora?”  

**Por quê**  
É o que mais parece “humano” no documento de upgrade, e o schema de memórias já existe.

**Como (orientação)**  
- Estender o JSON da IA: `question?: { prompt, options? }` ou `ask_user?: string`  
- Persistência: resposta do usuário vira `mentor_memories` (importance ≥ 4)  
- Limitar a 1 pergunta estruturada por presença/dia (evitar interrogatório)  

**Critério de pronto**  
Há pelo menos 3 gatilhos que geram pergunta; respostas alimentam o contexto nas próximas sessões.

---

### 3. Tom por estágio de evolução (calibração)

**O quê**  
Afinar o que já existe (`iniciante` / `intermediario` / `avancado`):

| Estágio | Tom |
| --- | --- |
| Iniciante | Explica mais, celebra pequenas vitórias |
| Intermediário | Direto, cobra consistência, pergunta mais |
| Avançado | Fala menos, provoca, assume que o usuário “já sabe” |

**Por quê**  
Quase só prompt + testes; reforça a sensação de relação que evolui.

**Critério de pronto**  
Mesmo usuário, em níveis diferentes, percebe mudança clara de estilo (teste manual com 2 contas ou XP mock).

---

### 4. Desafios mais honestos (mínimo viável)

**O quê**  
Endurecer o sistema atual de desafios, sem virar plano de 21 dias:

1. **Expirar** desafios com `ends_at` → status `expirado` (hoje o enum existe e ninguém usa)  
2. Opcional: vincular **1 hábito** ao desafio (se o hábito foi concluído N vezes no período, “Concluir” libera; senão, avisa)  
3. Usar ou remover `titulo_recompensa` (hoje é cosmético)

**Por quê**  
Desafio honor-system puro enfraquece a mentoria. Verificação leve aumenta confiança sem redesign grande.

**Critério de pronto**  
Desafios vencidos expiram sozinhos; pelo menos um caminho de conclusão verificável existe (mesmo que simples).

---

### 5. Memória: importance real + limpeza leve

**O quê**  
- Deixar a IA sugerir `importance` (1–5) em vez de hardcode `4`  
- Preferir memórias de respostas a perguntas e de marcos (nível, streak, capítulo)  
- Manter teto (~20), mas ordenar de verdade por importância + recência  

**Por quê**  
Sem isso, objetivo e perguntas perdem força no contexto longo.

**Critério de pronto**  
Memórias importantes sobrevivem; trivia some primeiro.

---

## Ordem sugerida de execução

```text
1. Objetivo persistente + UI mínima
2. Importance nas memórias
3. Perguntas estruturadas + gravar respostas
4. Tom por estágio (prompt)
5. Expirar desafios (+ vínculo opcional a 1 hábito)
```

Essa ordem maximiza percepção de “mentor com plano” antes de tocar em complexidade de verificação.

---

## Explicitamente para depois (não agora)

| Item do upgrade | Motivo para adiar |
| --- | --- |
| Charlie como núcleo / home da UX | Muda produto inteiro; só depois de retenção estável |
| Planos de evolução 21 dias | Alto escopo; depende de desafios/hábitos sólidos |
| Log fino de sessão (minutos, cliques) | Instrumentação + privacidade + custo de contexto |
| Estados internos ricos (sono, espiritualidade…) | Modelo subjetivo difícil de acertar sem dados |
| Narrativa completa por capítulo (capítulos literários) | Bonito, mas depende de memórias + objetivo maduros |

---

## Fora do Charlie, mas que desbloqueia a Fase 1

- Projeto Supabase dedicado estável (já em andamento)  
- Onboarding completo antes do mentor (já existe gate)  
- Usuário precisa ter perfil/atributos (bootstrap da Jornada)  

Sem isso, qualquer upgrade de Charlie falha no primeiro `loadJourneySnapshot`.

---

## Métricas para saber se valeu a pena

Em 2–4 semanas após a Fase 1:

1. % de usuários ativos que abrem `/mentor` ≥ 1×/semana  
2. % de desafios concluídos (não só criados)  
3. Memórias criadas a partir de **respostas a perguntas** (não só chat livre)  
4. Feedback qualitativo: “ele parece me conhecer / ter um plano?”  

Se (1) e (4) subirem sem (2), o próximo investimento é desafios verificáveis — não planos longos.

---

## Resumo executivo

**Vale implementar agora:**

1. Objetivo do mentor  
2. Perguntas + memória da resposta  
3. Tom por nível  
4. Expiração (e leve verificação) de desafios  
5. Importance real nas memórias  

**Não vale implementar agora:**

- Inversão “Charlie é o app”  
- Planos de 21 dias  
- Observação total da sessão  
- Sistema rico de estados emocionais  

Com isso, o V-Project caminha na direção do `upgrade-Charlie.md` sem perder o foco nem inflar o escopo.
