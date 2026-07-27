# ML Fase 2 — sklearn shadow pipeline

## Setup

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

## Commands

```bash
python -m vproject_ml train
python -m vproject_ml evaluate
python -m vproject_ml score-shadow          # needs SUPABASE_SERVICE_ROLE_KEY
python -m vproject_ml score-shadow --dry-run
pytest
```

Artifacts: `ml/artifacts/sklearn_v1/`  
Reports: `ml/reports/`

Charlie continues on `heuristic_v1` until human promotion (see `plans/ML-fase-2.md`).
