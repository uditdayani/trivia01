"""Fixed rarity tiers, assigned per question before anyone plays.

Within a question, each answer is compared with the question's most familiar
answer. The gap is in Zipf points (1 point = 10x less common in written English):

  gap < 0.35  Wycheproof   20   the obvious answers
  gap < 0.60  Fuji         40
  gap < 0.90  Mont Blanc   55
  gap < 1.30  Kilimanjaro  70
  otherwise   Aconcagua    85   the long tail
  Everest 100: the single most obscure answer (two if the question has 25+
  answers), and only if it is at least 1.3 below the most familiar.

Keep names and points in sync with src/lib/tiers.ts.
"""

from __future__ import annotations

TIERS = [("Everest", 100), ("Aconcagua", 85), ("Kilimanjaro", 70), ("Mont Blanc", 55), ("Fuji", 40), ("Wycheproof", 20)]
POINTS = dict(TIERS)

GAPS = [(0.35, "Wycheproof"), (0.60, "Fuji"), (0.90, "Mont Blanc"), (1.30, "Kilimanjaro")]
EVEREST_MIN_GAP = 1.30


def assign_tiers(familiarity: dict[str, float]) -> dict[str, tuple[str, int]]:
    """familiarity: answer key -> score. Returns answer key -> (tier, points)."""
    ranked = sorted(familiarity, key=lambda k: (-familiarity[k], k))
    top = familiarity[ranked[0]]
    out: dict[str, tuple[str, int]] = {}
    for k in ranked:
        gap = top - familiarity[k]
        name = next((t for limit, t in GAPS if gap < limit), "Aconcagua")
        out[k] = (name, POINTS[name])
    n_everest = 1 if len(ranked) < 25 else 2
    for k in ranked[-n_everest:]:
        if top - familiarity[k] >= EVEREST_MIN_GAP:
            out[k] = ("Everest", 100)
    return out
