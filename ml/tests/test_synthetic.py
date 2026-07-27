from __future__ import annotations

from pathlib import Path

from vproject_ml.dataset import generate_synthetic_dataset
from vproject_ml.evaluate import run_evaluate
from vproject_ml.features import (
    add_days,
    estimate_streak_as_of,
    label_y_abandono,
    label_y_streak,
)
from vproject_ml.train import ARTIFACTS, run_train


def test_label_y_streak_friday_gap():
    as_of = "2026-07-23"  # Thursday
    acts = {add_days(as_of, -i) for i in range(5)}
    y = label_y_streak(as_of_date=as_of, streak_atual=5, activity_days=acts)
    assert y == 1


def test_label_y_streak_clean_horizon():
    as_of = "2026-07-20"
    acts = {add_days(as_of, i) for i in range(-5, 5)}
    y = label_y_streak(as_of_date=as_of, streak_atual=3, activity_days=acts)
    assert y == 0


def test_label_y_abandono_three_day_gap():
    as_of = "2026-07-01"
    acts = {as_of}
    assert label_y_abandono(as_of_date=as_of, activity_days=acts) == 1


def test_estimate_streak():
    as_of = "2026-07-10"
    acts = {add_days(as_of, -i) for i in range(4)}
    assert estimate_streak_as_of(acts, as_of) == 4


def test_synthetic_friday_weak_has_higher_streak_rate():
    df = generate_synthetic_dataset(n_users=60, seed=7)
    weak = df[df["kind"] == "friday_weak"]["y_streak"].mean()
    strong = df[df["kind"] == "strong"]["y_streak"].mean()
    assert weak > strong


def test_train_and_evaluate_auc_above_chance():
    meta = run_train()
    assert (ARTIFACTS / "meta.json").exists()
    assert meta["streak"]["auc"] is not None
    assert meta["streak"]["auc"] > 0.55
    assert meta["abandono"]["auc"] is not None
    assert meta["abandono"]["auc"] > 0.55

    report = run_evaluate(retrain_if_missing=False)
    assert report["promoted"] is False
    assert report["streak"]["auc"] > 0.5
    assert report["abandono"]["auc"] > 0.5


def test_score_shadow_contract_does_not_touch_heuristic():
    from vproject_ml import score_shadow as ss

    src = Path(ss.__file__).read_text(encoding="utf-8")
    assert "user_ml_scores_shadow" in src
    assert '.table("user_ml_scores")' not in src
    assert "touched_user_ml_scores" in src
