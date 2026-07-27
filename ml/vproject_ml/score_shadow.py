from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from vproject_ml import MODEL_VERSION
from vproject_ml.db import get_service_client
from vproject_ml.features import FEATURE_COLUMNS, features_to_vector
from vproject_ml.train import load_artifacts


def _row_from_user_features(row: dict[str, Any]) -> dict[str, float]:
    as_of = (row.get("computed_at") or datetime.now(timezone.utc).isoformat())[:10]
    feats = {
        "dias_ativos_7": row.get("dias_ativos_7"),
        "dias_ativos_21": row.get("dias_ativos_21"),
        "dias_sem_habito": row.get("dias_sem_habito"),
        "media_habitos_dia_7": row.get("media_habitos_dia_7"),
        "media_habitos_dia_21": row.get("media_habitos_dia_21"),
        "taxa_conclusao_7": row.get("taxa_conclusao_7"),
        "taxa_conclusao_21": row.get("taxa_conclusao_21"),
        "weekday_rates": row.get("weekday_rates") or {},
        "streak_atual": row.get("streak_atual"),
        "streak_maximo": row.get("streak_maximo"),
        "xp_total": row.get("xp_total"),
        "nivel": row.get("nivel"),
        "desafios_ativos": row.get("desafios_ativos"),
        "desafios_concluidos_21": row.get("desafios_concluidos_21"),
        "desafios_expirados_21": row.get("desafios_expirados_21"),
        "dias_desde_ultima_atividade": row.get("dias_desde_ultima_atividade"),
        "media_xp_dia_21": row.get("media_xp_dia_21"),
    }
    return features_to_vector(feats, as_of)


def predict_probs(vec: dict[str, float], streak_model, abandono_model) -> tuple[float, float]:
    X = pd.DataFrame([vec])[FEATURE_COLUMNS]
    p_s = float(streak_model.predict_proba(X)[:, 1][0])
    p_a = float(abandono_model.predict_proba(X)[:, 1][0])
    return max(0.0, min(1.0, p_s)), max(0.0, min(1.0, p_a))


def run_score_shadow(*, limit: int = 500, dry_run: bool = False) -> dict[str, Any]:
    """
    Lê user_features, prediz com sklearn_v1, upsert em user_ml_scores_shadow.
    NÃO escreve em user_ml_scores (heuristic / Charlie).
    """
    streak_model, abandono_model, meta = load_artifacts()
    client = get_service_client()

    res = (
        client.table("user_features")
        .select("*")
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    now = datetime.now(timezone.utc).isoformat()
    upserts: list[dict[str, Any]] = []

    for row in rows:
        vec = _row_from_user_features(row)
        p_s, p_a = predict_probs(vec, streak_model, abandono_model)
        upserts.append(
            {
                "user_id": row["user_id"],
                "model_version": MODEL_VERSION,
                "computed_at": now,
                "risco_streak": round(p_s, 4),
                "risco_abandono": round(p_a, 4),
                "explicacao": {
                    "shadow": True,
                    "model_streak": meta.get("streak", {}).get("best_model"),
                    "model_abandono": meta.get("abandono", {}).get("best_model"),
                    "auc_streak_train": meta.get("streak", {}).get("auc"),
                    "auc_abandono_train": meta.get("abandono", {}).get("auc"),
                    "note": "Não usado pelo Charlie até promoção humana.",
                },
            }
        )

    if dry_run:
        return {
            "dry_run": True,
            "scored": len(upserts),
            "sample": upserts[:3],
            "touched_user_ml_scores": False,
        }

    if upserts:
        client.table("user_ml_scores_shadow").upsert(
            upserts, on_conflict="user_id,model_version"
        ).execute()

    # Registrar run de scoring (não promove)
    client.table("ml_model_runs").insert(
        {
            "model_version": MODEL_VERSION,
            "trained_at": now,
            "auc_streak": meta.get("streak", {}).get("auc"),
            "auc_abandono": meta.get("abandono", {}).get("auc"),
            "n_train": meta.get("streak", {}).get("n_train") or 0,
            "n_test": meta.get("streak", {}).get("n_test") or 0,
            "metrics": {
                "action": "score_shadow",
                "scored_users": len(upserts),
                "touched_user_ml_scores": False,
            },
            "artifact_path": f"ml/artifacts/{MODEL_VERSION}",
            "promoted": False,
        }
    ).execute()

    return {
        "ok": True,
        "scored": len(upserts),
        "model_version": MODEL_VERSION,
        "touched_user_ml_scores": False,
        "table": "user_ml_scores_shadow",
    }
