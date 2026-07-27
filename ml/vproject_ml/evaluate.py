from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from vproject_ml import MODEL_VERSION, PROMOTION_AUC_THRESHOLD
from vproject_ml.dataset import dataframe_xy, generate_synthetic_dataset, time_split
from vproject_ml.train import ARTIFACTS, REPORTS, load_artifacts, run_train

ROOT = Path(__file__).resolve().parents[1]


def evaluate_on_df(df: pd.DataFrame, *, label: str = "holdout") -> dict:
    streak_model, abandono_model, meta = load_artifacts()
    _, test_df = time_split(df)

    results: dict = {
        "model_version": MODEL_VERSION,
        "label": label,
        "n_test": len(test_df),
        "promotion_auc_threshold": PROMOTION_AUC_THRESHOLD,
    }

    for target, model, key in (
        ("y_streak", streak_model, "streak"),
        ("y_abandono", abandono_model, "abandono"),
    ):
        X, y = dataframe_xy(test_df, target)
        if hasattr(model, "predict_proba"):
            prob = model.predict_proba(X)[:, 1]
        else:
            prob = model.decision_function(X)
            prob = 1 / (1 + np.exp(-prob))
        auc = None
        if len(np.unique(y)) >= 2:
            auc = float(roc_auc_score(y, prob))
        results[key] = {
            "auc": auc,
            "trained_best": meta.get(key, {}).get("best_model"),
            "meets_threshold": bool(auc is not None and auc >= PROMOTION_AUC_THRESHOLD),
            "pos_rate": float(y.mean()),
        }

    results["ready_to_consider_promotion"] = bool(
        results["streak"].get("meets_threshold")
        and results["abandono"].get("meets_threshold")
    )
    # Shadow only — never auto-promote
    results["promoted"] = False
    return results


def run_evaluate(*, retrain_if_missing: bool = True) -> dict:
    REPORTS.mkdir(parents=True, exist_ok=True)
    if not (ARTIFACTS / "meta.json").exists():
        if not retrain_if_missing:
            raise FileNotFoundError("Sem artifacts para evaluate")
        run_train()

    df = generate_synthetic_dataset()
    report = evaluate_on_df(df, label="synthetic_holdout")

    md_lines = [
        f"# ML evaluate — {MODEL_VERSION}",
        "",
        f"- n_test: {report['n_test']}",
        f"- AUC streak: {report['streak']['auc']}",
        f"- AUC abandono: {report['abandono']['auc']}",
        f"- Limiar promoção: {PROMOTION_AUC_THRESHOLD}",
        f"- Considerar promoção (humano): {report['ready_to_consider_promotion']}",
        f"- promoted: false (shadow mode)",
        "",
    ]
    (REPORTS / "last_evaluate.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    (REPORTS / "last_evaluate.md").write_text("\n".join(md_lines), encoding="utf-8")
    return report
