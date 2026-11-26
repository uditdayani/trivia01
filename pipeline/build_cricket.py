"""Build the Cricket (IPL) pack: players, the ways their names can be typed,
questions with exact answer lists, and per-question tiers.

Reads  pipeline/data/ipl_json.zip, data/cricket_tiers.json, data/cricket_aliases.json
Writes supabase/data/cricket.sql            (run in the Supabase SQL editor; safe to re-run)
       pipeline/out/cricket_prompts.md       (review: every question and its answers)
       pipeline/out/cricket_tiers_review.csv (review in Excel: one row per answer)

Run:  python pipeline/build_cricket.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_geography import norm, q  # noqa: E402
from cricket_prompts import CricketPrompt, build  # noqa: E402
from cricket_stats import Player, compute  # noqa: E402
from tiers import MAX_EVEREST, POINTS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "pipeline" / "data"
SQL_OUT = ROOT / "supabase" / "data" / "cricket.sql"
OUT = ROOT / "pipeline" / "out"
PACK = "cricket"
PACK_NAME = "Cricket (IPL)"
MIN_ANSWERS = 10

# baseline share of each question's answers per tier, most expected first
BASELINE = [("Wycheproof", 0.12), ("Fuji", 0.18), ("Mont Blanc", 0.20), ("Kilimanjaro", 0.20)]  # rest: Aconcagua

INITIALS = re.compile(r"^[A-Z]{1,4}$")


def name_parts(name: str) -> tuple[str, str]:
    """Cricsheet name -> (initials, surname), lowercase.
    'V Kohli' -> ('v', 'kohli'); 'AB de Villiers' -> ('ab', 'de villiers');
    'Yuvraj Singh' -> ('y', 'singh'); 'Rashid Khan' -> ('r', 'khan')."""
    toks = name.split()
    i = 0
    while i < len(toks) - 1 and INITIALS.match(toks[i]):
        i += 1
    if i > 0:
        return "".join(toks[:i]).lower(), norm(" ".join(toks[i:]))
    return "".join(t[0] for t in toks[:-1]).lower(), norm(toks[-1])


def build_aliases(players: list[Player], extra: dict[str, list[str]]) -> dict[str, list[str]]:
    """pid -> aliases. Short forms (surname only, first name only) are added only
    when no other IPL player could be meant."""
    rest_count: Counter = Counter()
    last_count: Counter = Counter()
    first_count: Counter = Counter()
    for p in players:
        ini, sur = name_parts(p.name)
        toks = p.name.split()
        has_initials = bool(INITIALS.match(toks[0])) and len(toks) > 1
        rest = norm(" ".join(toks[1:])) if has_initials else ""
        if rest:
            rest_count[rest] += 1
        last_count[norm(toks[-1])] += 1
        if not has_initials:
            first_count[norm(toks[0])] += 1

    out: dict[str, list[str]] = {}
    for p in players:
        toks = p.name.split()
        has_initials = bool(INITIALS.match(toks[0])) and len(toks) > 1
        names = [p.name]
        rest = " ".join(toks[1:]) if has_initials else ""
        if rest and rest_count[norm(rest)] == 1 and len(norm(rest)) >= 4:
            names.append(rest)
        if len(toks) > 1 and last_count[norm(toks[-1])] == 1 and len(norm(toks[-1])) >= 4:
            names.append(toks[-1])
        if not has_initials and len(toks) > 1 and first_count[norm(toks[0])] == 1 and len(norm(toks[0])) >= 4:
            names.append(toks[0])
        names += extra.get(p.name, [])
        seen, keep = set(), []
        for n in names:
            k = norm(n)
            if k and k not in seen:
                seen.add(k)
                keep.append(n)
        out[p.pid] = keep
    return out


def assign(prompt: CricketPrompt, answers: list[Player], ratings: dict[str, list[str]]) -> dict[str, tuple[str, int]]:
    """pid -> (tier, points): baseline by prominence for this question, then the file's overrides."""
    by_name: dict[str, Player] = {}
    for a in answers:
        if a.name in by_name:
            raise SystemExit(f"{prompt.slug}: two answers share the name '{a.name}'")
        by_name[a.name] = a
    fixed: dict[str, str] = {}
    for tier, names in ratings.items():
        if tier not in POINTS:
            raise SystemExit(f"{prompt.slug}: unknown tier '{tier}'")
        for n in names:
            if n not in by_name:
                raise SystemExit(f"{prompt.slug}: '{n}' is not a correct answer to this question")
            fixed[by_name[n].pid] = tier

    rest = sorted((a for a in answers if a.pid not in fixed), key=lambda a: (-prompt.salience(a), a.name))
    out: dict[str, tuple[str, int]] = {}
    n, i = len(rest), 0
    for tier, share in BASELINE:
        take = max(1, round(share * n)) if i < n else 0
        for a in rest[i : i + take]:
            out[a.pid] = (tier, POINTS[tier])
        i += take
    for a in rest[i:]:
        out[a.pid] = ("Aconcagua", POINTS["Aconcagua"])
    for pid, tier in fixed.items():
        out[pid] = (tier, POINTS[tier])

    n_ev = sum(1 for t, _ in out.values() if t == "Everest")
    if not 1 <= n_ev <= MAX_EVEREST:
        raise SystemExit(f"{prompt.slug}: needs 1 to {MAX_EVEREST} Everest answers in cricket_tiers.json, has {n_ev}")
    return out


def difficulty(n: int) -> int:
    return 1 if n >= 60 else 2 if n >= 30 else 3 if n >= 18 else 4


def main() -> None:
    stats = compute()
    ratings = {k: v for k, v in json.loads((DATA / "cricket_tiers.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
    extra = {k: v for k, v in json.loads((DATA / "cricket_aliases.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}

    players = sorted(stats.players.values(), key=lambda p: p.name)
    unknown = [k for k in extra if k not in {p.name for p in players}]
    if unknown:
        raise SystemExit(f"cricket_aliases.json names not in the data: {unknown}")
    aliases = build_aliases(players, extra)

    kept, dropped = [], []
    for pr in build(stats):
        ans = [p for p in players if pr.test(p)]
        if len(ans) < MIN_ANSWERS:
            dropped.append((pr, len(ans)))
            continue
        if pr.slug not in ratings:
            raise SystemExit(f"cricket_tiers.json has no entry for '{pr.slug}'. Add its Everest answer(s).")
        kept.append((pr, ans, assign(pr, ans, ratings[pr.slug])))

    # ---------- SQL ----------
    L = ["-- Generated by pipeline/build_cricket.py. Do not edit by hand.",
         "-- Match data: Cricsheet (cricsheet.org), Open Data Commons Attribution licence.",
         f"-- IPL matches up to {stats.last_date}.",
         "begin;",
         f"insert into packs (slug, name) values ({q(PACK)}, {q(PACK_NAME)}) on conflict (slug) do update set name = excluded.name;",
         "",
         "insert into entities (pack_id, slug, canonical_name, popularity, initials, surname)",
         "select p.id, v.slug, v.name, v.pop, v.ini, v.sur from packs p, (values"]
    rows = []
    for pl in players:
        ini, sur = name_parts(pl.name)
        rows.append(f"  ({q(pl.pid)}, {q(pl.name)}, {max(pl.matches, 1)}, {q(ini)}, {q(sur)})")
    L.append(",\n".join(rows))
    L += [f") as v(slug, name, pop, ini, sur) where p.slug = {q(PACK)}",
          "on conflict (pack_id, slug) do update set canonical_name = excluded.canonical_name,",
          "  popularity = excluded.popularity, initials = excluded.initials, surname = excluded.surname;",
          "",
          "delete from entity_aliases where entity_id in (",
          f"  select e.id from entities e join packs p on p.id = e.pack_id where p.slug = {q(PACK)});",
          "insert into entity_aliases (entity_id, alias_normalized)",
          "select distinct e.id, normalize_answer(v.alias) from (values"]
    L.append(",\n".join(f"  ({q(pl.pid)}, {q(a)})" for pl in players for a in aliases[pl.pid]))
    L += [f") as v(slug, alias) join entities e on e.slug = v.slug join packs p on p.id = e.pack_id and p.slug = {q(PACK)}",
          "where normalize_answer(v.alias) <> '' on conflict do nothing;",
          "",
          "insert into prompts (pack_id, slug, theme, text, difficulty, time_limit_s, as_of_date)",
          "select p.id, v.slug, v.theme, v.text, v.difficulty, 30, v.as_of::date from packs p, (values"]
    L.append(",\n".join(f"  ({q(pr.slug)}, {q(pr.theme)}, {q(pr.text)}, {difficulty(len(a))}, {q(stats.last_date)})" for pr, a, _ in kept))
    L += [f") as v(slug, theme, text, difficulty, as_of) where p.slug = {q(PACK)}",
          "on conflict (slug) do update set theme = excluded.theme, text = excluded.text,",
          "  difficulty = excluded.difficulty, as_of_date = excluded.as_of_date;",
          "",
          "create temp table _new_answers (prompt_slug text, entity_slug text, w real, tier text, points smallint) on commit drop;",
          "insert into _new_answers values"]
    ans_rows = []
    for pr, a, tiers in kept:
        for pl in a:
            t, pts = tiers[pl.pid]
            ans_rows.append(f"  ({q(pr.slug)}, {q(pl.pid)}, {round(pr.salience(pl) + 1, 3)}, {q(t)}, {pts})")
    L.append(",\n".join(ans_rows) + ";")
    L += ["insert into answers (prompt_id, entity_id, seed_weight, tier, points)",
          "select pr.id, e.id, n.w, n.tier, n.points from _new_answers n",
          "join prompts pr on pr.slug = n.prompt_slug",
          f"join entities e on e.slug = n.entity_slug join packs p on p.id = e.pack_id and p.slug = {q(PACK)}",
          "on conflict (prompt_id, entity_id) do update",
          "  set seed_weight = excluded.seed_weight, tier = excluded.tier, points = excluded.points;",
          "delete from answers a using prompts pr, entities e",
          "where a.prompt_id = pr.id and a.entity_id = e.id",
          f"  and pr.pack_id = (select id from packs where slug = {q(PACK)})",
          "  and not exists (select 1 from _new_answers n where n.prompt_slug = pr.slug and n.entity_slug = e.slug)",
          "  and not exists (select 1 from submissions s where s.answer_id = a.id);",
          "",
          "-- switch the pack on and plan its next 30 days",
          f"update packs set is_active = true where slug = {q(PACK)};",
          "commit;",
          f"select schedule_puzzles({q(PACK)}, current_date, 30) as cricket_days_scheduled;"]
    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    SQL_OUT.write_text("\n".join(L) + "\n", encoding="utf-8")

    # ---------- review files ----------
    OUT.mkdir(exist_ok=True)
    with (OUT / "cricket_tiers_review.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["question", "answer", "tier", "points", "ipl_matches"])
        for pr, a, tiers in kept:
            for pl in sorted(a, key=lambda x: (tiers[x.pid][1], -pr.salience(x))):
                w.writerow([pr.text, pl.name, tiers[pl.pid][0], tiers[pl.pid][1], pl.matches])
    M = [f"# Cricket (IPL) questions (generated)", "",
         f"{len(players)} players, {sum(len(v) for v in aliases.values())} accepted spellings, "
         f"{len(kept)} questions. Data to {stats.last_date}.", "",
         "| Theme | Question | Answers | Wycheproof (20) | Everest (100) |", "| --- | --- | --- | --- | --- |"]
    for pr, a, tiers in kept:
        ob = [pl.name for pl in a if tiers[pl.pid][0] == "Wycheproof"]
        ev = [pl.name for pl in a if tiers[pl.pid][0] == "Everest"]
        M.append(f"| {pr.theme} | {pr.text} | {len(a)} | {', '.join(ob)} | {', '.join(ev)} |")
    if dropped:
        M += ["", "## Dropped (fewer than 10 answers)", ""] + [f"- {pr.text} ({n})" for pr, n in dropped]
    (OUT / "cricket_prompts.md").write_text("\n".join(M) + "\n", encoding="utf-8")

    tier_count = Counter(t for _, _, tiers in kept for t, _ in tiers.values())
    total = sum(tier_count.values())
    print(f"players={len(players)} spellings={sum(len(v) for v in aliases.values())} questions={len(kept)} "
          f"answers={total} dropped={len(dropped)} data_to={stats.last_date}")
    print("tiers: " + ", ".join(f"{t} {tier_count[t] / total:.0%}" for t in ["Wycheproof", "Fuji", "Mont Blanc", "Kilimanjaro", "Aconcagua", "Everest"]))


if __name__ == "__main__":
    main()
