# ML Fase 3 — Adaptativo (desafios + notificações com guardrails)

Complementa [`ML-fase-1.md`](ML-fase-1.md) e [`ML-fase-2.md`](ML-fase-2.md).

**Objetivo:** usar scores de produção (`user_ml_scores` / `heuristic_v1`) para **ajustar** lembretes e desafios — com tetos e freios — sem promover sklearn shadow e sem auto-ajustar XP de hábitos.

**Fonte de verdade:** só `user_ml_scores` (não `user_ml_scores_shadow`).

---

## Faixas de risco

| Faixa | Score |
| --- | --- |
| baixo | `< 0.35` |
| moderado | `≥ 0.35` e `< 0.55` |
| alto | `≥ 0.55` |

---

## Guardrails (obrigatórios)

### Notificações
1. Quiet hours e once-per-day **permanecem**.
2. `habit_reminder`: se risco baixo em streak **e** abandono **e** só 1 hábito pendente → **não enviar** (anti-spam).
3. `streak_risk`: manter regra clássica; se `risco_streak` alto, **escalar** o texto (padrão weekday se houver).
4. Se `risco_streak` alto e streak > 0 com hábitos pendentes, garantir `streak_risk` mesmo quando a heurística clássica for borderline (já coberta pela regra clássica na prática).
5. Metadata: `ml_guided`, `risco_streak`, `risco_abandono`.

### Desafios (Charlie)
1. Máx. **2** ativos (já existia).
2. Com risco alto: preferir desafio **leve** — `duracao_dias ≤ 2`, `xp_recompensa ≤ 120`, `completions_required ≤ 2`.
3. Cooldown: se já criou desafio nas últimas **48h** e risco alto → só permitir novo se `ativos === 0`.
4. Clamp server-side em `callMentor` (não confiar só no LLM).
5. Sem inventar sono/estresse; sem mudar XP de hábitos do app.

---

## Onde vive a lógica

- Motor puro: [`src/lib/ml/adaptive.ts`](../src/lib/ml/adaptive.ts) (testável)
- Notificações: [`src/notifications/jobs.ts`](../src/notifications/jobs.ts) + Edge `notification-jobs`
- Desafios: [`src/mentor/functions.ts`](../src/mentor/functions.ts) + prompt em `context.ts`

---

## Critério de pronto

- [x] Lembretes respeitam anti-spam por risco baixo
- [x] Streak risk escala com score alto / weekday fraco
- [x] Desafios clampados por política adaptativa
- [x] Charlie continua em `heuristic_v1` (sem shadow)
- [x] Testes unitários das decisões

## Fora de escopo

Promoção sklearn → Charlie, collaborative filtering avançado, wearable contínuo, auto-ajuste de XP de hábitos.
