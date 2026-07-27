from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from vproject_ml.features import (
    FEATURE_COLUMNS,
    activity_set,
    add_days,
    compute_user_features,
    estimate_streak_as_of,
    features_to_vector,
    label_y_abandono,
    label_y_streak,
    parse_day,
)


def _completions_for_user(
    user_id: str,
    days: list[str],
    skip_weekdays_js: set[int] | None = None,
    skip_prob: float = 0.0,
    rng: np.random.Generator | None = None,
) -> list[dict[str, Any]]:
    rng = rng or np.random.default_rng(0)
    skip_weekdays_js = skip_weekdays_js or set()
    out: list[dict[str, Any]] = []
    for dia in days:
        wd_js = (parse_day(dia).weekday() + 1) % 7
        if wd_js in skip_weekdays_js:
            continue
        if skip_prob > 0 and rng.random() < skip_prob:
            continue
        out.append({"user_id": user_id, "habit_id": "h1", "dia": dia, "xp_ganho": 10})
    return out


def generate_synthetic_dataset(
    *,
    n_users: int = 80,
    days_span: int = 60,
    end_date: str = "2026-07-20",
    seed: int = 42,
) -> pd.DataFrame:
    """
    Usuários mistos:
    - strong: raramente falha
    - friday_weak: pula sextas (wd_js=5) → y_streak alto em quintas
    - dropout: para de fazer hábitos no fim
    """
    rng = np.random.default_rng(seed)
    start = add_days(end_date, -(days_span - 1))
    calendar = [add_days(start, i) for i in range(days_span)]

    rows: list[dict[str, Any]] = []
    for i in range(n_users):
        uid = f"synthetic-{i:04d}"
        kind = str(rng.choice(["strong", "friday_weak", "dropout"], p=[0.35, 0.4, 0.25]))

        if kind == "strong":
            comps = _completions_for_user(uid, calendar, skip_prob=0.05, rng=rng)
        elif kind == "friday_weak":
            comps = _completions_for_user(
                uid, calendar, skip_weekdays_js={5}, skip_prob=0.02, rng=rng
            )
        else:
            cutoff = calendar[int(days_span * 0.65)]
            early = [d for d in calendar if d < cutoff]
            comps = _completions_for_user(uid, early, skip_prob=0.1, rng=rng)

        acts = activity_set(comps)
        for as_of in calendar[:-7]:
            streak = estimate_streak_as_of(acts, as_of)
            feats = compute_user_features(
                as_of_date=as_of,
                habit_count_ativo=1,
                completions=comps,
                challenges=[],
                streak_atual=streak,
                streak_maximo=max(streak, 5),
                xp_total=100 + len([d for d in acts if d <= as_of]) * 10,
                ultimo_dia_completo=max((d for d in acts if d <= as_of), default=None),
            )
            vec = features_to_vector(feats, as_of)
            y_s = label_y_streak(as_of_date=as_of, streak_atual=streak, activity_days=acts)
            y_a = label_y_abandono(as_of_date=as_of, activity_days=acts)
            if y_s is None:
                continue
            rows.append(
                {
                    "user_id": uid,
                    "as_of_date": as_of,
                    "kind": kind,
                    "y_streak": int(y_s),
                    "y_abandono": int(y_a),
                    **vec,
                }
            )

    return pd.DataFrame(rows)


def dataframe_xy(df: pd.DataFrame, target: str) -> tuple[pd.DataFrame, pd.Series]:
    X = df[FEATURE_COLUMNS].astype(float)
    y = df[target].astype(int)
    return X, y


def time_split(
    df: pd.DataFrame, *, test_frac: float = 0.25
) -> tuple[pd.DataFrame, pd.DataFrame]:
    ordered = df.sort_values("as_of_date")
    cut = int(len(ordered) * (1 - test_frac))
    cut = max(1, min(len(ordered) - 1, cut))
    return ordered.iloc[:cut].copy(), ordered.iloc[cut:].copy()


def build_dataset_from_supabase_rows(
    *,
    profiles: list[dict[str, Any]],
    completions: list[dict[str, Any]],
    challenges: list[dict[str, Any]],
    habits: list[dict[str, Any]],
    min_as_of: str | None = None,
) -> pd.DataFrame:
    """Constrói amostras as-of a partir de dumps Supabase."""
    comps_by_user: dict[str, list[dict[str, Any]]] = {}
    for c in completions:
        comps_by_user.setdefault(c["user_id"], []).append(c)

    chal_by_user: dict[str, list[dict[str, Any]]] = {}
    for ch in challenges:
        chal_by_user.setdefault(ch["user_id"], []).append(ch)

    habit_count: dict[str, int] = {}
    for h in habits:
        if h.get("ativo", True):
            habit_count[h["user_id"]] = habit_count.get(h["user_id"], 0) + 1

    rows: list[dict[str, Any]] = []
    for prof in profiles:
        uid = prof["id"]
        comps = comps_by_user.get(uid, [])
        if len(comps) < 5:
            continue
        acts = activity_set(comps)
        if not acts:
            continue
        days_sorted = sorted(acts)
        first, last = days_sorted[0], days_sorted[-1]
        # calendar from first to last
        span = []
        d = first
        while d <= last:
            span.append(d)
            d = add_days(d, 1)
        if len(span) < 14:
            continue
        for as_of in span[:-7]:
            if min_as_of and as_of < min_as_of:
                continue
            streak = estimate_streak_as_of(acts, as_of)
            feats = compute_user_features(
                as_of_date=as_of,
                habit_count_ativo=habit_count.get(uid, 1),
                completions=comps,
                challenges=chal_by_user.get(uid, []),
                streak_atual=streak,
                streak_maximo=int(prof.get("streak_maximo") or streak),
                xp_total=int(prof.get("xp_total") or 0),
                ultimo_dia_completo=max((x for x in acts if x <= as_of), default=None),
            )
            vec = features_to_vector(feats, as_of)
            y_s = label_y_streak(as_of_date=as_of, streak_atual=streak, activity_days=acts)
            y_a = label_y_abandono(as_of_date=as_of, activity_days=acts)
            rows.append(
                {
                    "user_id": uid,
                    "as_of_date": as_of,
                    "kind": "real",
                    "y_streak": int(y_s or 0),
                    "y_abandono": int(y_a),
                    **vec,
                }
            )
    return pd.DataFrame(rows)
