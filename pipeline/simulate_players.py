"""Simulate a day of players to check how correct answers spread across tiers.

Each simulated player answers every Geography prompt. A player is right with
probability P_CORRECT; when right, they pick a country with probability
proportional to popularity ** CONCENTRATION (higher = players cluster more on
famous countries). Shares use the same blended formula as answer_share() in SQL.

Run:  python pipeline/simulate_players.py [players] [concentration]
Writes pipeline/out/simulation.md
"""

from __future__ import annotations

import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_geography import MIN_ANSWERS, build_prompts, load, popularity  # noqa: E402

# Keep in sync with supabase/migrations/*_m3_scoring.sql and src/lib/tiers.ts
PRIOR_STRENGTH = 50
TIERS = [("Everest", 100, 0.02), ("Aconcagua", 85, 0.10), ("Kilimanjaro", 70, 0.25),
         ("Mont Blanc", 55, 0.40), ("Fuji", 40, 0.50), ("Wycheproof", 20, float("inf"))]
P_CORRECT = 0.8
OUT = Path(__file__).parent / "out" / "simulation.md"


def tier(share: float) -> tuple[str, int]:
    for name, pts, hi in TIERS:
        if share < hi:
            return name, pts
    return TIERS[-1][0], TIERS[-1][1]


def simulate(players: int, concentration: float, seed: int = 7):
    rng = random.Random(seed)
    countries = load()
    results = []
    for p in build_prompts(countries):
        answers = [c for c in countries if p.test(c)]
        if len(answers) < MIN_ANSWERS:
            continue
        pops = [popularity(c) for c in answers]
        prior = {c.code: w / sum(pops) for c, w in zip(answers, pops)}
        pick_w = [w ** concentration for w in pops]
        picks = [rng.choices(answers, pick_w)[0].code for _ in range(players) if rng.random() < P_CORRECT]
        counts = Counter(picks)
        n_total = len(picks)
        tiers = Counter()
        for code in picks:
            share = (counts[code] + PRIOR_STRENGTH * prior[code]) / (n_total + PRIOR_STRENGTH)
            tiers[tier(share)[0]] += 1
        results.append((p, len(answers), n_total, counts, tiers))
    return results


def main() -> None:
    players = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    concentration = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
    res = simulate(players, concentration)

    overall = Counter()
    for *_, tiers in res:
        overall.update(tiers)
    total = sum(overall.values())

    lines = [f"# Simulation: {players} players, concentration {concentration}", "",
             f"{len(res)} prompts, {P_CORRECT:.0%} of answers correct, prior strength {PRIOR_STRENGTH}.", "",
             "## Share of correct answers landing in each tier", "", "| Tier | Points | Share of correct answers |", "| --- | --- | --- |"]
    for name, pts, _ in TIERS:
        lines.append(f"| {name} | {pts} | {overall[name] / total:.1%} |")
    avg = sum(dict((n, p) for n, p, _ in TIERS)[k] * v for k, v in overall.items()) / total
    lines += ["", f"Average points per correct answer: {avg:.1f}", "",
              "## Per prompt", "", "| Prompt | Answers | Distinct given | " + " | ".join(n for n, _, _ in TIERS) + " |",
              "| --- | --- | --- | " + " | ".join("---" for _ in TIERS) + " |"]
    for p, n_ans, n_total, counts, tiers in sorted(res, key=lambda r: r[0].slug):
        lines.append(f"| {p.text} | {n_ans} | {len(counts)} | " + " | ".join(
            f"{tiers[n] / n_total:.0%}" if n_total else "-" for n, _, _ in TIERS) + " |")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"{players} players, concentration {concentration}: " + ", ".join(
        f"{name} {overall[name] / total:.0%}" for name, _, _ in TIERS) + f"  (avg {avg:.1f} pts)")


if __name__ == "__main__":
    main()
