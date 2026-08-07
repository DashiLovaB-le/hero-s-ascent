# ML Fase 1 — Feature Store + scores preditivos → Charlie

Documento de implementação baseado no feedback de ML/IA Generativa e no plano aprovado.

**Objetivo:** transformar histórico (hábitos, streak, desafios, XP) em **features + scores persistidos** e injetá-los no Charlie — sem inventar sinais que o app não coleta.

**Fora de escopo neste ciclo:** sono, estresse, personalidade tipológica, collaborative filtering (“usuários parecidos”), auto-ajuste de XP/dificuldade, treino Python/sklearn.

---

## Princípio

Hoje o Charlie é IA generativa com contexto consultado.  
O próximo passo não é mais prompt — é uma **camada de dados preditivos** (nível 2 mínimo) que o LLM passa a usar.

| Tecnologia | Antes | Após Fase 1 |
| --- | --- | --- |
| IA Generativa | ~75% | continua (enriquecida) |
| Machine Learning | ~5% | feature store + scores versionados (`heuristic_v1`) |

---

## O que entregamos

1. Tabelas `user_features` e `user_ml_scores` (RLS: usuário lê o próprio)
2. Funções puras TS: `computeUserFeatures` + `scoreUserHeuristicV1` (testáveis)
3. Job diário (Edge Function `ml-features-job`) + recompute após concluir hábito
4. Bloco `SINAIS ML` no contexto do Charlie + presença proativa se risco alto
5. Fixtures: weekday fraco (ex. sexta) eleva `risco_streak`

---

## Scores (model_version = `heuristic_v1`)

| Score | Fonte | Uso |
| --- | --- | --- |
| `risco_streak` (0–1) | taxa_7, dias_sem_habito, weekday fraco de amanhã | Charlie antecipa quebra de ritmo |
| `risco_abandono` (0–1) | dias sem atividade, queda taxa_21→7, desafios expirados | Tom / urgência |
| `projecao_dias_proximo_nivel` | xp_para_proximo / média XP/dia 21 | Contexto de evolução |
| `weekday_weakest` | `weekday_rates` | “sextas caem” sem programar o dia à mão |

Quando houver volume de usuários, trocar o corpo do scorer por sklearn **sem mudar o contrato das tabelas**.

---

## Critério de pronto

- [x] Features recalculáveis diariamente para usuários ativos
- [x] Charlie recebe scores no contexto em toda chamada
- [x] Cenário fixture: weekday fraco → risco de streak sobe
- [x] Nenhuma feature inventada sem coluna/fonte de dados

---

## Fases seguintes (não agora)

| Fase | Conteúdo |
| --- | --- |
| 2 — Preditivo real | Ver [`ML-fase-2.md`](ML-fase-2.md) (sklearn + shadow + AUC) |
| 3 — Adaptativo | Ver [`ML-fase-3.md`](ML-fase-3.md) (notificações/desafios + guardrails) |
| 4 — Agente | Ver [`ML-fase-4.md`](ML-fase-4.md) (check-ins + iniciativas + CF) |
