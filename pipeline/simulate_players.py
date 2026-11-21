"""Check the per-question tiers.

1. Answer lists: how many correct answers sit in each tier.
2. Repeat offenders: countries that are Everest in many questions (a "go-to" risk).
3. Players: simulated players pick among correct answers, weighted by how
   expected each tier is (an obvious answer is far more likely to be said).
   BOLD players dig deeper. Reports average points.

Run:  python pipeline/simulate_players.py [players]
Writes pipeline/out/simulation.md
"""

from __future__ import annotations

import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_geography import MIN_ANSWERS, build_prompts, load, tiers_for  # noqa: E402
from tiers import TIERS  # noqa: E402

P_CORRECT = 0.8
# relative chance a player says an answer of each tier
STYLES = {
    "typical": {"Wycheproof": 30, "Fuji": 10, "Mont Blanc": 4, "Kilimanjaro": 1.5, "Aconcagua": 1, "Everest": 0.7},
    "bold": {"Wycheproof": 6, "Fuji": 5, "Mont Blanc": 4, "Kilimanjaro": 3, "Aconcagua": 2, "Everest": 2},
}
OUT = Path(__file__).parent / "out" / "simulation.md"


def questions():
    countries = load()
    for p in build_prompts(countries):
        answers = [c for c in countries if p.test(c)]
        if len(answers) >= MIN_ANSWERS:
            yield p, tiers_for(p, answers)


def simulate(qs, players: int, weights: dict[str, float], seed: int = 7):
    rng = random.Random(seed)
    hits: Counter[str] = Counter()
    for _ in range(players):
        for _, tiers in qs:
            if rng.random() >= P_CORRECT:
                continue
            names = list(tiers)
            pick = rng.choices(names, [weights[tiers[n][0]] for n in names])[0]
            hits[tiers[pick][0]] += 1
    n = sum(hits.values())
    avg = sum(dict(TIERS)[k] * v for k, v in hits.items()) / n
    return hits, n, avg


def main() -> None:
    players = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    qs = list(questions())
    listed = Counter(t for _, tiers in qs for t, _ in tiers.values())
    n_listed = sum(listed.values())
    everest = Counter(name for _, tiers in qs for name, (t, _) in tiers.items() if t == "Everest")

    lines = ["# Tier check", "", f"{len(qs)} questions, {n_listed} correct answers.", "",
             "## Correct answers per tier", "", "| Tier | Points | Answers | Share |", "| --- | --- | --- | --- |"]
    lines += [f"| {name} | {pts} | {listed[name]} | {listed[name] / n_listed:.0%} |" for name, pts in TIERS]
    lines += ["", "## Countries that are Everest most often", ""]
    lines += [f"- {name}: {n} questions" for name, n in everest.most_common(8)]
    lines += ["", f"## {players} simulated players, {P_CORRECT:.0%} correct", "",
              "| Style | " + " | ".join(n for n, _ in TIERS) + " | Avg points per correct answer | Avg game (of 700) |",
              "| --- | " + " | ".join("---" for _ in TIERS) + " | --- | --- |"]
    summary = []
    for style, weights in STYLES.items():
        hits, n, avg = simulate(qs, players, weights)
        game = avg * 7 * P_CORRECT
        lines.append(f"| {style} | " + " | ".join(f"{hits[t] / n:.0%}" for t, _ in TIERS) + f" | {avg:.0f} | {game:.0f} |")
        summary.append(f"{style}: {avg:.0f} pts per correct answer, ~{game:.0f}/700 per game, Everest {hits['Everest'] / n:.0%} of answers")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("answers per tier: " + ", ".join(f"{t} {listed[t] / n_listed:.0%}" for t, _ in TIERS))
    print("most-Everest countries: " + ", ".join(f"{k} ({v})" for k, v in everest.most_common(4)))
    print("\n".join(summary))


if __name__ == "__main__":
    main()
