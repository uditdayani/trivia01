"""Fixed rarity tiers, set per question before anyone plays.

Tiers come from pipeline/data/<pack>_tiers.json: for every question, which
answers are expected (Wycheproof) through to logically unexpected (Everest).
The same country can be Wycheproof on one question and Everest on another:
France is obvious for "uses the euro" but surprising for "borders 6+ countries".
Any correct answer not listed is Aconcagua (the long tail).

Keep names and points in sync with src/lib/tiers.ts.
"""

from __future__ import annotations

import json
from pathlib import Path

TIERS = [("Everest", 100), ("Aconcagua", 85), ("Kilimanjaro", 70), ("Mont Blanc", 55), ("Fuji", 40), ("Wycheproof", 20)]
POINTS = dict(TIERS)
DEFAULT_TIER = "Aconcagua"
MAX_EVEREST = 3

DATA = Path(__file__).parent / "data"


class TierFileError(Exception):
    pass


def load_ratings(pack: str) -> dict[str, dict[str, list[str]]]:
    raw = json.loads((DATA / f"{pack}_tiers.json").read_text(encoding="utf-8"))
    return {k: v for k, v in raw.items() if not k.startswith("_")}


def assign_tiers(ratings: dict[str, list[str]], answers: list[str], slug: str) -> dict[str, tuple[str, int]]:
    """answers: canonical names of every correct answer. Returns name -> (tier, points)."""
    valid = set(answers)
    out = {name: (DEFAULT_TIER, POINTS[DEFAULT_TIER]) for name in answers}
    seen: dict[str, str] = {}
    for tier, names in ratings.items():
        if tier not in POINTS:
            raise TierFileError(f"{slug}: unknown tier '{tier}'")
        for name in names:
            if name not in valid:
                raise TierFileError(f"{slug}: '{name}' is not a correct answer to this question")
            if name in seen:
                raise TierFileError(f"{slug}: '{name}' is listed in both {seen[name]} and {tier}")
            seen[name] = tier
            out[name] = (tier, POINTS[tier])
    n_everest = sum(1 for t, _ in out.values() if t == "Everest")
    if n_everest == 0 or n_everest > MAX_EVEREST:
        raise TierFileError(f"{slug}: needs 1 to {MAX_EVEREST} Everest answers, has {n_everest}")
    if not any(t == "Wycheproof" for t, _ in out.values()):
        raise TierFileError(f"{slug}: needs at least one Wycheproof (obvious) answer")
    return out
