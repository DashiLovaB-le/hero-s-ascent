from __future__ import annotations

import argparse
import json
import sys

from vproject_ml.dataset import (
    build_dataset_from_supabase_rows,
    generate_synthetic_dataset,
)
from vproject_ml.db import get_service_client
from vproject_ml.evaluate import run_evaluate
from vproject_ml.score_shadow import run_score_shadow
from vproject_ml.train import run_train


def _fetch_supabase_dataset():
    client = get_service_client()
    profiles = (
        client.table("profiles")
        .select("id, xp_total, streak_atual, streak_maximo, ultimo_dia_completo")
        .eq("onboarding_completo", True)
        .limit(500)
        .execute()
        .data
        or []
    )
    completions = (
        client.table("habit_completions")
        .select("user_id, habit_id, dia, xp_ganho")
        .limit(20000)
        .execute()
        .data
        or []
    )
    challenges = (
        client.table("mentor_challenges")
        .select("user_id, status, completed_at, ends_at, created_at")
        .limit(5000)
        .execute()
        .data
        or []
    )
    habits = (
        client.table("habits")
        .select("user_id, ativo")
        .eq("ativo", True)
        .limit(5000)
        .execute()
        .data
        or []
    )
    return build_dataset_from_supabase_rows(
        profiles=profiles,
        completions=completions,
        challenges=challenges,
        habits=habits,
    )


def cmd_train(args: argparse.Namespace) -> int:
    if args.from_supabase:
        df = _fetch_supabase_dataset()
        if df.empty or len(df) < 40:
            print(
                "Dados reais insuficientes — treinando com sintético + aviso.",
                file=sys.stderr,
            )
            meta = run_train()
            meta["warning"] = "fallback_synthetic"
        else:
            meta = run_train(df=df, source="supabase")
    else:
        meta = run_train()
    print(json.dumps(meta, indent=2))
    return 0


def cmd_evaluate(_: argparse.Namespace) -> int:
    report = run_evaluate()
    print(json.dumps(report, indent=2))
    return 0


def cmd_score_shadow(args: argparse.Namespace) -> int:
    result = run_score_shadow(limit=args.limit, dry_run=args.dry_run)
    print(json.dumps(result, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vproject_ml", description="ML Fase 2 CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_train = sub.add_parser("train", help="Treina logistic/GBM e salva artifacts")
    p_train.add_argument(
        "--from-supabase",
        action="store_true",
        help="Usa histórico real (fallback sintético se N pequeno)",
    )
    p_train.set_defaults(func=cmd_train)

    p_eval = sub.add_parser("evaluate", help="AUC offline + report")
    p_eval.set_defaults(func=cmd_evaluate)

    p_score = sub.add_parser(
        "score-shadow", help="Escreve predições em user_ml_scores_shadow"
    )
    p_score.add_argument("--limit", type=int, default=500)
    p_score.add_argument("--dry-run", action="store_true")
    p_score.set_defaults(func=cmd_score_shadow)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
