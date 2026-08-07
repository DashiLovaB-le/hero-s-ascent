# ML Fase 2 — Preditivo real (shadow mode)

Documento canônico da Fase 2. Complementa [`ML-fase-1.md`](ML-fase-1.md).

**Objetivo:** treinar modelos sklearn (`LogisticRegression` + `HistGradientBoostingClassifier`) para `risco_streak` e `risco_abandono`, avaliar AUC offline e gravar predições em **shadow mode** — sem alterar o Charlie.

**Produção (Charlie):** continua em `user_ml_scores` / `heuristic_v1`.  
**Shadow:** `user_ml_scores_shadow` / `sklearn_v1`.

---

## Labels

| Alvo | Definição (as-of dia D) |
| --- | --- |
| `y_streak` | 1 se `streak_atual > 0` em D **e** existe ≥1 dia sem hábito em D+1..D+3 |
| `y_abandono` | 1 se nos próximos 7 dias houver ≥3 dias **consecutivos** sem atividade |

Features: mesmo vetor da Fase 1 (`features_version = v1`), reconstruído as-of cada dia a partir de `habit_completions` / perfil / desafios.

---

## Shadow mode e promoção

- Scores sklearn **não** sobrescrevem `user_ml_scores`.
- Scores sklearn **não** entram no prompt do Charlie nesta fase.
- Limiar sugerido para **considerar** promoção (decisão humana, Fase 3): AUC real ≥ **0.65** em ambos os alvos, com `n_test` adequado e `promoted = false` até aprovação.
- Registro de cada treino em `ml_model_runs` (`promoted` default `false`).

---

## CLI (`ml/`)

```bash
cd ml
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Treino + AUC (sintético por padrão; use --from-supabase com service role)
python -m vproject_ml train
python -m vproject_ml evaluate

# Predição shadow → user_ml_scores_shadow (requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
python -m vproject_ml score-shadow
```

Variáveis (`.env` na raiz do repo ou em `ml/`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Critério de pronto

- [x] Treino/evaluate locais com report AUC
- [x] `score-shadow` grava só em `user_ml_scores_shadow`
- [x] Charlie permanece em `heuristic_v1`
- [x] Testes sintéticos (padrão sexta → risco)

## Fora de escopo

Promover sklearn para Charlie, desafios adaptativos, sono/estresse, collaborative filtering.
