from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

LEVELS = [
    (1, 0),
    (2, 200),
    (3, 600),
    (4, 1400),
    (5, 3000),
    (6, 6000),
    (7, 10000),
    (8, 16000),
    (9, 25000),
    (10, 40000),
    (11, 65000),
    (12, 100000),
]

FEATURE_COLUMNS = [
    "dias_ativos_7",
    "dias_ativos_21",
    "dias_sem_habito",
    "media_habitos_dia_7",
    "media_habitos_dia_21",
    "taxa_conclusao_7",
    "taxa_conclusao_21",
    "wd_0",
    "wd_1",
    "wd_2",
    "wd_3",
    "wd_4",
    "wd_5",
    "wd_6",
    "streak_atual",
    "streak_maximo",
    "xp_total",
    "nivel",
    "desafios_ativos",
    "desafios_concluidos_21",
    "desafios_expirados_21",
    "dias_desde_ultima_atividade",
    "media_xp_dia_21",
    "tomorrow_weekday",
    "tomorrow_rate",
]


def parse_day(iso: str) -> date:
    return date.fromisoformat(iso[:10])


def add_days(iso: str, n: int) -> str:
    return (parse_day(iso) + timedelta(days=n)).isoformat()


def day_diff(a_iso: str, b_iso: str) -> int:
    return (parse_day(b_iso) - parse_day(a_iso)).days


def calcular_nivel(xp: int) -> dict[str, Any]:
    atual = LEVELS[0]
    proximo = LEVELS[1] if len(LEVELS) > 1 else None
    for i, level in enumerate(LEVELS):
        if xp >= level[1]:
            atual = level
            proximo = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
    xp_para = max(0, proximo[1] - xp) if proximo else 0
    return {
        "nivel": atual[0],
        "proximo": proximo[0] if proximo else None,
        "xp_para_proximo": xp_para,
    }


def compute_user_features(
    *,
    as_of_date: str,
    habit_count_ativo: int,
    completions: list[dict[str, Any]],
    challenges: list[dict[str, Any]],
    streak_atual: int,
    streak_maximo: int,
    xp_total: int,
    ultimo_dia_completo: str | None,
) -> dict[str, Any]:
    """Espelho de src/lib/ml/features.ts computeUserFeatures."""
    habit_n = max(0, habit_count_ativo)
    from7 = add_days(as_of_date, -6)
    from21 = add_days(as_of_date, -20)

    by_day: dict[str, int] = {}
    xp_by_day: dict[str, float] = {}
    for c in completions:
        dia = c["dia"][:10]
        if dia < from21 or dia > as_of_date:
            continue
        by_day[dia] = by_day.get(dia, 0) + 1
        xp = c.get("xp_ganho") or 0
        xp_by_day[dia] = xp_by_day.get(dia, 0) + float(xp)

    dias_ativos_7 = dias_ativos_21 = 0
    sum_habits_7 = sum_habits_21 = 0.0
    sum_xp_21 = 0.0
    dias_completos_7 = dias_completos_21 = 0

    for i in range(21):
        dia = add_days(from21, i)
        count = by_day.get(dia, 0)
        in7 = dia >= from7
        if count > 0:
            dias_ativos_21 += 1
            if in7:
                dias_ativos_7 += 1
        sum_habits_21 += count
        sum_xp_21 += xp_by_day.get(dia, 0)
        if in7:
            sum_habits_7 += count
        if habit_n > 0 and count >= habit_n:
            dias_completos_21 += 1
            if in7:
                dias_completos_7 += 1

    weekday_done = [0] * 7
    weekday_total = [0] * 7
    for i in range(21):
        dia = add_days(from21, i)
        wd = parse_day(dia).weekday()  # Mon=0 .. Sun=6 in Python
        # Align with JS getUTCDay: Sun=0 .. Sat=6
        wd_js = (wd + 1) % 7
        weekday_total[wd_js] += 1
        count = by_day.get(dia, 0)
        ok = count >= max(1, (habit_n + 1) // 2) if habit_n > 0 else count > 0
        if ok:
            weekday_done[wd_js] += 1

    weekday_rates = {
        str(wd): round(weekday_done[wd] / (weekday_total[wd] or 1), 4) for wd in range(7)
    }

    last_activity = None
    for dia in sorted(by_day.keys()):
        if by_day.get(dia, 0) > 0:
            last_activity = dia
    if ultimo_dia_completo:
        ud = ultimo_dia_completo[:10]
        if not last_activity or ud > last_activity:
            last_activity = ud

    dias_desde = day_diff(last_activity, as_of_date) if last_activity else None
    if dias_desde is not None:
        dias_desde = max(0, dias_desde)

    dias_sem_habito = 0
    for i in range(21):
        dia = add_days(as_of_date, -i)
        if by_day.get(dia, 0) == 0:
            dias_sem_habito += 1
        else:
            break

    from21_chal = f"{from21}T00:00:00.000Z"
    desafios_ativos = desafios_concluidos_21 = desafios_expirados_21 = 0
    for ch in challenges:
        status = ch.get("status")
        if status == "ativo":
            desafios_ativos += 1
        if status == "concluido":
            completed = ch.get("completed_at")
            if completed and completed >= from21_chal:
                desafios_concluidos_21 += 1
        if status == "expirado":
            ref = ch.get("ends_at") or ch.get("created_at")
            if ref and ref >= from21_chal:
                desafios_expirados_21 += 1

    level = calcular_nivel(xp_total)

    return {
        "features_version": "v1",
        "dias_ativos_7": dias_ativos_7,
        "dias_ativos_21": dias_ativos_21,
        "dias_sem_habito": dias_sem_habito,
        "media_habitos_dia_7": round(sum_habits_7 / 7, 3),
        "media_habitos_dia_21": round(sum_habits_21 / 21, 3),
        "taxa_conclusao_7": round(
            (dias_completos_7 / 7) if habit_n > 0 else (dias_ativos_7 / 7), 4
        ),
        "taxa_conclusao_21": round(
            (dias_completos_21 / 21) if habit_n > 0 else (dias_ativos_21 / 21), 4
        ),
        "weekday_rates": weekday_rates,
        "streak_atual": streak_atual,
        "streak_maximo": streak_maximo,
        "xp_total": xp_total,
        "nivel": level["nivel"],
        "desafios_ativos": desafios_ativos,
        "desafios_concluidos_21": desafios_concluidos_21,
        "desafios_expirados_21": desafios_expirados_21,
        "ultimo_dia_completo": ultimo_dia_completo[:10] if ultimo_dia_completo else None,
        "dias_desde_ultima_atividade": dias_desde,
        "media_xp_dia_21": round(sum_xp_21 / 21, 3),
    }


def features_to_vector(features: dict[str, Any], as_of_date: str) -> dict[str, float]:
    tomorrow = add_days(as_of_date, 1)
    tomorrow_wd = parse_day(tomorrow).weekday()
    tomorrow_wd_js = (tomorrow_wd + 1) % 7
    rates = features.get("weekday_rates") or {}
    row: dict[str, float] = {
        "dias_ativos_7": float(features.get("dias_ativos_7") or 0),
        "dias_ativos_21": float(features.get("dias_ativos_21") or 0),
        "dias_sem_habito": float(features.get("dias_sem_habito") or 0),
        "media_habitos_dia_7": float(features.get("media_habitos_dia_7") or 0),
        "media_habitos_dia_21": float(features.get("media_habitos_dia_21") or 0),
        "taxa_conclusao_7": float(features.get("taxa_conclusao_7") or 0),
        "taxa_conclusao_21": float(features.get("taxa_conclusao_21") or 0),
        "streak_atual": float(features.get("streak_atual") or 0),
        "streak_maximo": float(features.get("streak_maximo") or 0),
        "xp_total": float(features.get("xp_total") or 0),
        "nivel": float(features.get("nivel") or 1),
        "desafios_ativos": float(features.get("desafios_ativos") or 0),
        "desafios_concluidos_21": float(features.get("desafios_concluidos_21") or 0),
        "desafios_expirados_21": float(features.get("desafios_expirados_21") or 0),
        "dias_desde_ultima_atividade": float(
            features.get("dias_desde_ultima_atividade")
            if features.get("dias_desde_ultima_atividade") is not None
            else features.get("dias_sem_habito") or 0
        ),
        "media_xp_dia_21": float(features.get("media_xp_dia_21") or 0),
        "tomorrow_weekday": float(tomorrow_wd_js),
        "tomorrow_rate": float(rates.get(str(tomorrow_wd_js), rates.get(tomorrow_wd_js, 1)) or 1),
    }
    for wd in range(7):
        row[f"wd_{wd}"] = float(rates.get(str(wd), rates.get(wd, 0)) or 0)
    return row


def activity_set(completions: list[dict[str, Any]]) -> set[str]:
    return {c["dia"][:10] for c in completions if c.get("dia")}


def label_y_streak(
    *,
    as_of_date: str,
    streak_atual: int,
    activity_days: set[str],
) -> int | None:
    """1 se streak ativo e gap em D+1..D+3. None se horizonte incompleto."""
    if streak_atual <= 0:
        return 0
    horizon = [add_days(as_of_date, i) for i in range(1, 4)]
    # caller must ensure horizon days exist in dataset window
    for d in horizon:
        if d not in activity_days:
            return 1
    return 0


def label_y_abandono(*, as_of_date: str, activity_days: set[str]) -> int:
    """1 se ≥3 dias consecutivos sem atividade em D+1..D+7."""
    run = 0
    for i in range(1, 8):
        d = add_days(as_of_date, i)
        if d not in activity_days:
            run += 1
            if run >= 3:
                return 1
        else:
            run = 0
    return 0


def estimate_streak_as_of(activity_days: set[str], as_of: str) -> int:
    """Streak aproximado: dias consecutivos com atividade terminando em as_of ou ontem."""
    if as_of in activity_days:
        end = as_of
    elif add_days(as_of, -1) in activity_days:
        end = add_days(as_of, -1)
    else:
        return 0
    streak = 0
    d = end
    while d in activity_days:
        streak += 1
        d = add_days(d, -1)
    return streak


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
