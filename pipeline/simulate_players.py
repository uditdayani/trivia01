"""Check the fixed tiers two ways.

1. Answer lists: how many accepted answers sit in each tier, the same view
   Krillion's public answer pages give (few obvious answers, a long deep-cut tail).
2. Players: simulated players answer every question. A player is right with
   probability P_CORRECT and picks among correct answers in proportion to
   10 ** (BOLDNESS * familiarity). BOLDNESS 1 = picks track how often names
   appear in writing; below 1 = players dig for rarer answers.

Run:  python pipeline/simulate_players.py [players]
Writes pipeline/out/simulation.md
"""

from __future__ import annotations

import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_geography import MIN_ANSWERS, build_prompts, load, popularity  # noqa: E402
from tiers import TIERS, assign_tiers  # noqa: E402

P_CORRECT = 0.8
BOLDNESS_LEVELS = [1.0, 0.7, 0.4]
OUT = Path(__file__).parent / "out" / "simulation.md"


def questions():
    countries = load()
    for p in build_prompts(countries):
        answers = [c for c in countries if p.test(c)]
        if len(answers) >= MIN_ANSWERS:
            fam = {c.code: popularity(c) for c in answers}
            yield p, fam, assign_tiers(fam)


def simulate_players(qs, players: int, boldness: float, seed: int = 7):
    rng = random.Random(seed)
    tier_hits, game_totals = Counter(), []
    per_q = {p.slug: 0.0 for p, _, _ in qs}
    for _ in range(players):
        total = 0
        for p, fam, tiers in qs:
            if rng.random() >= P_CORRECT:
                continue
            codes = list(fam)
            pick = rng.choices(codes, [10 ** (boldness * fam[c]) for c in codes])[0]
            name, pts = tiers[pick]
            tier_hits[name] += 1
            per_q[p.slug] += pts
            total += pts
        game_totals.append(total * 7 / len(qs))  # scale to a 7-question game
    return tier_hits, sum(game_totals) / len(game_totals)


def main() -> None:
    players = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    qs = list(questions())

    listed = Counter(t for _, _, tiers in qs for t, _ in tiers.values())
    n_listed = sum(listed.values())
    lines = ["# Tier check", "", f"{len(qs)} questions, {n_listed} accepted answers.", "",
             "## 1. Accepted answers per tier", "", "| Tier | Points | Answers | Share |", "| --- | --- | --- | --- |"]
    for name, pts in TIERS:
        lines.append(f"| {name} | {pts} | {listed[name]} | {listed[name] / n_listed:.0%} |")

    lines += ["", f"## 2. {players} simulated players, {P_CORRECT:.0%} correct", "",
              "| Boldness | " + " | ".join(n for n, _ in TIERS) + " | Avg points per correct answer | Avg game score (of 700) |",
              "| --- | " + " | ".join("---" for _ in TIERS) + " | --- | --- |"]
    summary = []
    for b in BOLDNESS_LEVELS:
        hits, avg_game = simulate_players(qs, players, b)
        n = sum(hits.values())
        avg_pts = sum(dict(TIERS)[k] * v for k, v in hits.items()) / n
        lines.append(f"| {b} | " + " | ".join(f"{hits[name] / n:.0%}" for name, _ in TIERS)
                     + f" | {avg_pts:.0f} | {avg_game:.0f} |")
        summary.append(f"boldness {b}: avg {avg_pts:.0f} pts/correct, game {avg_game:.0f}/700, "
                       + ", ".join(f"{name} {hits[name] / n:.0%}" for name, _ in TIERS))

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("answers per tier: " + ", ".join(f"{name} {listed[name]} ({listed[name] / n_listed:.0%})" for name, _ in TIERS))
    print("\n".join(summary))


if __name__ == "__main__":
    main()
