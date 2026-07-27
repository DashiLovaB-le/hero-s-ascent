# ML Fase 4 — Agente + check-ins + collaborative filtering

Complementa as fases 1–3. Charlie e scores de produção seguem em `heuristic_v1`.

**Objetivo:** coletar sinais estruturados (sono/energia/humor), permitir **iniciativas do agente** com freios fortes, e gerar recomendações por similaridade quando houver volume mínimo — sem inventar dados.

---

## Peças

| Peça | Entrega |
| --- | --- |
| Check-ins | Tabela `user_checkins` + server fn + card na Jornada |
| Agente | Job diário + tabela `agent_initiatives` + notificação `agent_initiative` |
| Collaborative filtering | Similaridade por `weekday_rates` → `user_cf_recommendations` (só se N ≥ 5 peers) |

---

## Guardrails do agente

1. Máx. **1** iniciativa criada por usuário por dia UTC.
2. Máx. **1** iniciativa `pending` por usuário.
3. Quiet hours: não dispara iniciativas (mesmo padrão dos reminders).
4. **Não** cria `mentor_challenges` sozinho — só notifica e convida a abrir o Charlie.
5. Check-in: Charlie só menciona sono/energia se houver linha no contexto; senão diz ausente.
6. CF: se peers < 5, não grava recomendação (evita “usuários parecidos” inventados).

## Tipos de iniciativa

| `kind` | Quando |
| --- | --- |
| `checkin_nudge` | Sem check-in hoje e (risco ≥ moderado **ou** fim de janela útil) |
| `streak_protect` | `risco_streak` alto |
| `cf_habit_hint` | Há recomendação CF ativa |

---

## Critério de pronto

- [x] Check-in diário persistido e no contexto do Charlie
- [x] Job de iniciativas com cooldown/quiet hours
- [x] CF com limiar de peers; tabela de recomendações
- [x] Testes do motor de agente + similaridade

## Fora de escopo

Promoção sklearn → Charlie, auto-ajuste de XP de hábitos, treino CF profundo (matrix factorization), wearable/sono contínuo.
