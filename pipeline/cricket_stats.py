"""IPL statistics computed from Cricsheet ball-by-ball data.

Input: pipeline/data/ipl_json.zip (Cricsheet IPL JSON, one file per match).
Super overs are excluded from all career and season figures, as in official stats.

Data: Cricsheet (cricsheet.org), Open Data Commons Attribution licence.
"""

from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

ZIP = Path(__file__).parent / "data" / "ipl_json.zip"

# Franchises that changed name are one franchise. Deccan Chargers (defunct) and
# Sunrisers Hyderabad are different franchises; so are Gujarat Lions and Gujarat Titans.
FRANCHISE = {
    "Delhi Daredevils": "Delhi Capitals",
    "Kings XI Punjab": "Punjab Kings",
    "Royal Challengers Bangalore": "Royal Challengers Bengaluru",
    "Rising Pune Supergiants": "Rising Pune Supergiant",
}
DEFUNCT = {"Deccan Chargers", "Kochi Tuskers Kerala", "Pune Warriors", "Rising Pune Supergiant", "Gujarat Lions"}

NOT_BOWLER_WICKETS = {"run out", "retired hurt", "retired out", "obstructing the field", "retired not out"}


def franchise(team: str) -> str:
    return FRANCHISE.get(team, team)


def season_year(s: str | int) -> int:
    """'2007/08' -> 2008, '2009/10' -> 2010, '2020/21' -> 2020 (IPL 2020 ran Sep-Nov 2020)."""
    s = str(s)
    if s == "2020/21":
        return 2020
    m = re.match(r"(\d{4})/(\d{2})$", s)
    return 2000 + int(m.group(2)) if m else int(s)


@dataclass
class Player:
    pid: str
    name: str
    matches: int = 0
    seasons: set[int] = field(default_factory=set)
    franchises: set[str] = field(default_factory=set)
    franchise_matches: Counter = field(default_factory=Counter)
    runs: int = 0
    balls: int = 0
    sixes: int = 0
    fifties: int = 0
    hundreds: int = 0
    fastest_fifty_balls: int | None = None
    wickets: int = 0
    five_fors: int = 0
    hat_tricks: int = 0
    wicket_first_ball: bool = False
    stumpings: int = 0
    catches: int = 0
    pom: int = 0
    finals_played: int = 0
    finals_won: int = 0
    final_pom: int = 0
    final_fifty: bool = False
    runs_by_season: Counter = field(default_factory=Counter)
    wickets_by_season: Counter = field(default_factory=Counter)
    conceded_by_season: Counter = field(default_factory=Counter)
    dismissed: Counter = field(default_factory=Counter)  # batter pid -> times this bowler got them out
    in_first_ipl_match: bool = False
    in_latest_final: bool = False


@dataclass
class Stats:
    players: dict[str, Player]
    finals: dict[int, dict]       # season -> {"date", "winner", "teams"}
    last_date: str
    matches: int
    name_to_pid: dict[str, str]


def load_matches() -> list[dict]:
    with zipfile.ZipFile(ZIP) as z:
        matches = [json.loads(z.read(n)) for n in z.namelist() if n.endswith(".json")]
    return sorted(matches, key=lambda m: (m["info"]["dates"][0], m["info"].get("event", {}).get("match_number", 0)))


def compute() -> Stats:
    matches = load_matches()
    players: dict[str, Player] = {}
    name_to_pid: dict[str, str] = {}

    # the final of each season = that season's last match
    by_season: dict[int, list[dict]] = defaultdict(list)
    for m in matches:
        by_season[season_year(m["info"]["season"])].append(m)
    finals = {}
    final_ids = set()
    for yr, ms in by_season.items():
        f = max(ms, key=lambda m: m["info"]["dates"][-1])
        stage = f["info"].get("event", {}).get("stage")
        if stage and stage.lower() != "final":
            raise SystemExit(f"{yr}: last match is '{stage}', not the final")
        finals[yr] = {"date": f["info"]["dates"][0], "winner": f["info"].get("outcome", {}).get("winner"),
                      "teams": f["info"]["teams"]}
        final_ids.add(id(f))
    latest_final = max(finals)

    bowler_seen: set[str] = set()

    for mi, m in enumerate(matches):
        info = m["info"]
        yr = season_year(info["season"])
        reg = info["registry"]["people"]
        is_final = id(m) in final_ids

        def P(name: str) -> Player:
            pid = reg[name]
            name_to_pid[name] = pid
            p = players.get(pid)
            if p is None:
                p = players[pid] = Player(pid, name)
            p.name = name  # latest spelling wins
            return p

        winner = info.get("outcome", {}).get("winner")
        for team, names in info["players"].items():
            for n in names:
                p = P(n)
                p.matches += 1
                p.seasons.add(yr)
                p.franchises.add(franchise(team))
                p.franchise_matches[franchise(team)] += 1
                if mi == 0:
                    p.in_first_ipl_match = True
                if is_final:
                    p.finals_played += 1
                    if team == winner:
                        p.finals_won += 1
                    if yr == latest_final:
                        p.in_latest_final = True
        for n in info.get("player_of_match", []):
            p = P(n)
            p.pom += 1
            if is_final:
                p.final_pom += 1

        legal_seq: dict[str, list[bool]] = defaultdict(list)  # bowler -> wicket? per legal ball, whole match
        for inn in m["innings"]:
            if inn.get("super_over"):
                continue
            bat_runs: Counter = Counter()
            bat_balls: Counter = Counter()
            fifty_at: dict[str, int] = {}
            bowl_wkts: Counter = Counter()
            for over in inn["overs"]:
                for d in over["deliveries"]:
                    batter, bowler = P(d["batter"]), P(d["bowler"])
                    extras = d.get("extras", {})
                    r = d["runs"]["batter"]
                    batter.runs += r
                    batter.runs_by_season[yr] += r
                    bat_runs[batter.pid] += r
                    if "wides" not in extras:
                        batter.balls += 1
                        bat_balls[batter.pid] += 1
                    if r == 6 and not d["runs"].get("non_boundary"):
                        batter.sixes += 1
                    if bat_runs[batter.pid] >= 50 and batter.pid not in fifty_at:
                        fifty_at[batter.pid] = bat_balls[batter.pid]
                    conceded = r + extras.get("wides", 0) + extras.get("noballs", 0)
                    bowler.conceded_by_season[yr] += conceded

                    credited = False
                    for w in d.get("wickets", []):
                        kind = w["kind"]
                        if kind not in NOT_BOWLER_WICKETS:
                            credited = True
                            bowler.wickets += 1
                            bowler.wickets_by_season[yr] += 1
                            bowl_wkts[bowler.pid] += 1
                            bowler.dismissed[reg[w["player_out"]]] += 1
                        if kind == "stumped":
                            for f in w.get("fielders", []):
                                if not f.get("substitute") and "name" in f:
                                    P(f["name"]).stumpings += 1
                        elif kind == "caught":
                            for f in w.get("fielders", []):
                                if "name" in f:
                                    P(f["name"]).catches += 1
                        elif kind == "caught and bowled":
                            bowler.catches += 1
                    legal = "wides" not in extras and "noballs" not in extras
                    if legal and bowler.pid not in bowler_seen:
                        bowler_seen.add(bowler.pid)
                        bowler.wicket_first_ball = credited
                    # hat-trick sequence: legal balls, plus a wide or no-ball that took a wicket
                    # (e.g. stumped off a wide counts towards a hat-trick)
                    if legal or credited:
                        legal_seq[bowler.pid].append(credited)

            for pid, runs in bat_runs.items():
                p = players[pid]
                if runs >= 100:
                    p.hundreds += 1
                elif runs >= 50:
                    p.fifties += 1
                if runs >= 50 and is_final:
                    p.final_fifty = True
                if pid in fifty_at:
                    b = fifty_at[pid]
                    if p.fastest_fifty_balls is None or b < p.fastest_fifty_balls:
                        p.fastest_fifty_balls = b
            for pid, w in bowl_wkts.items():
                if w >= 5:
                    players[pid].five_fors += 1

        for pid, seq in legal_seq.items():
            streak, counted = 0, False
            for wk in seq:
                streak = streak + 1 if wk else 0
                if streak >= 3 and not counted:
                    players[pid].hat_tricks += 1
                    counted = True
                if streak == 0:
                    counted = False

    last_date = max(m["info"]["dates"][-1] for m in matches)
    return Stats(players, finals, last_date, len(matches), name_to_pid)


def season_leaders(stats: Stats, key: str) -> dict[int, list[str]]:
    """Orange Cap (runs) or Purple Cap (wickets) winners per season. Ties broken
    officially: Purple Cap by fewer runs conceded; a remaining tie keeps both."""
    out: dict[int, list[str]] = {}
    seasons = sorted({s for p in stats.players.values() for s in p.seasons})
    for yr in seasons:
        if key == "runs":
            best = max(p.runs_by_season[yr] for p in stats.players.values())
            out[yr] = [p.pid for p in stats.players.values() if p.runs_by_season[yr] == best]
        else:
            best = max(p.wickets_by_season[yr] for p in stats.players.values())
            tied = [p for p in stats.players.values() if p.wickets_by_season[yr] == best]
            low = min(p.conceded_by_season[yr] for p in tied)
            out[yr] = [p.pid for p in tied if p.conceded_by_season[yr] == low]
    return out


if __name__ == "__main__":
    s = compute()
    by = {p.name: p for p in s.players.values()}
    print(f"{s.matches} matches, {len(s.players)} players, last match {s.last_date}")
    print("finals:", {y: f["winner"] for y, f in sorted(s.finals.items())})
    for n in ["V Kohli", "RG Sharma", "MS Dhoni", "CH Gayle", "AB de Villiers", "DA Warner", "YS Chahal", "JC Buttler", "A Mishra", "Yuvraj Singh", "SL Malinga"]:
        p = by.get(n)
        if p:
            print(f"{n:15} m={p.matches:3} runs={p.runs:5} 100s={p.hundreds} 6s={p.sixes:3} wkts={p.wickets:3} hat={p.hat_tricks} st={p.stumpings} ct={p.catches} pom={p.pom} finals_won={p.finals_won}")
    oc = season_leaders(s, "runs"); pc = season_leaders(s, "wickets")
    names = {p.pid: p.name for p in s.players.values()}
    print("orange:", {y: [names[i] for i in v] for y, v in oc.items()})
    print("purple:", {y: [names[i] for i in v] for y, v in pc.items()})
    print("hat-tricks:", sorted((p.name, p.hat_tricks) for p in s.players.values() if p.hat_tricks))
