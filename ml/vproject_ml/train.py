from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from vproject_ml import MODEL_VERSION
from vproject_ml.dataset import dataframe_xy, generate_synthetic_dataset, time_split
from vproject_ml.features import FEATURE_COLUMNS

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts" / MODEL_VERSION
REPORTS = ROOT / "reports"


def _make_models() -> dict[str, Any]:
    return {
        "logistic": Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        ),
        "gbm": HistGradientBoostingClassifier(
            max_depth=4,
            learning_rate=0.08,
            max_iter=150,
            random_state=42,
        ),
    }


def _safe_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float | None:
    if len(np.unique(y_true)) < 2:
        return None
    return float(roc_auc_score(y_true, y_prob))


def train_target(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    target: str,
) -> dict[str, Any]:
    X_train, y_train = dataframe_xy(train_df, target)
    X_test, y_test = dataframe_xy(test_df, target)

    best_name = None
    best_auc = -1.0
    best_model = None
    candidates: dict[str, float | None] = {}

    for name, model in _make_models().items():
        model.fit(X_train, y_train)
        if hasattr(model, "predict_proba"):
            prob = model.predict_proba(X_test)[:, 1]
        else:
            prob = model.decision_function(X_test)
            prob = 1 / (1 + np.exp(-prob))
        auc = _safe_auc(y_test.to_numpy(), prob)
        candidates[name] = auc
        score = auc if auc is not None else -1.0
        if score > best_auc:
            best_auc = score
            best_name = name
            best_model = model

    assert best_model is not None and best_name is not None
    return {
        "target": target,
        "best_model": best_name,
        "auc": None if best_auc < 0 else best_auc,
        "candidates": candidates,
        "model": best_model,
        "n_train": len(train_df),
        "n_test": len(test_df),
        "pos_rate_train": float(y_train.mean()),
        "pos_rate_test": float(y_test.mean()),
    }


def run_train(
    *,
    df: pd.DataFrame | None = None,
    source: str = "synthetic",
) -> dict[str, Any]:
    if df is None:
        df = generate_synthetic_dataset()
        source = "synthetic"

    train_df, test_df = time_split(df)
    streak = train_target(train_df, test_df, "y_streak")
    abandono = train_target(train_df, test_df, "y_abandono")

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    streak_path = ARTIFACTS / "model_streak.joblib"
    abandono_path = ARTIFACTS / "model_abandono.joblib"
    meta_path = ARTIFACTS / "meta.json"

    joblib.dump(streak["model"], streak_path)
    joblib.dump(abandono["model"], abandono_path)

    meta = {
        "model_version": MODEL_VERSION,
        "source": source,
        "feature_columns": FEATURE_COLUMNS,
        "streak": {
            "best_model": streak["best_model"],
            "auc": streak["auc"],
            "candidates": streak["candidates"],
            "n_train": streak["n_train"],
            "n_test": streak["n_test"],
            "pos_rate_train": streak["pos_rate_train"],
            "pos_rate_test": streak["pos_rate_test"],
            "artifact": str(streak_path.relative_to(ROOT)),
        },
        "abandono": {
            "best_model": abandono["best_model"],
            "auc": abandono["auc"],
            "candidates": abandono["candidates"],
            "n_train": abandono["n_train"],
            "n_test": abandono["n_test"],
            "pos_rate_train": abandono["pos_rate_train"],
            "pos_rate_test": abandono["pos_rate_test"],
            "artifact": str(abandono_path.relative_to(ROOT)),
        },
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (REPORTS / "last_train.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def load_artifacts() -> tuple[Any, Any, dict[str, Any]]:
    meta_path = ARTIFACTS / "meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(
            f"Artifacts ausentes em {ARTIFACTS}. Rode: python -m vproject_ml train"
        )
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    streak = joblib.load(ARTIFACTS / "model_streak.joblib")
    abandono = joblib.load(ARTIFACTS / "model_abandono.joblib")
    return streak, abandono, meta
