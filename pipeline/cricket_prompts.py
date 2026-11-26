"""Cricket (IPL) questions. Each test runs on a Player from cricket_stats.py.

Every answer list is computed from Cricsheet data, so it is exact as of the
last match in the data (the "as of" date stored on each question).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from cricket_stats import DEFUNCT, Player, Stats, season_leaders


@dataclass
class CricketPrompt:
    slug: str
    theme: str
    text: str
    test: Callable[[Player], bool]
    # how prominent an answer is FOR THIS QUESTION (higher = more expected)
    salience: Callable[[Player], float] = lambda p: p.matches
    # what makes an answer surprising here: "bowler" (a bowler on a batting question),
    # "batter" (a batter on a bowling question), "team:<name>" (a star with few games there)
    surprise: str = ""


def build(stats: Stats) -> list[CricketPrompt]:
    by_name = {p.name: p for p in stats.players.values()}
    orange = {pid for ids in season_leaders(stats, "runs").values() for pid in ids}
    purple = {pid for ids in season_leaders(stats, "wickets").values() for pid in ids}
    latest = max(stats.finals)
    kohli, dhoni, rohit = by_name["V Kohli"].pid, by_name["MS Dhoni"].pid, by_name["RG Sharma"].pid

    P: list[CricketPrompt] = []

    def add(slug, theme, text, test, salience=None, surprise=""):
        P.append(CricketPrompt(slug, theme, text, test, salience or (lambda p: p.matches), surprise))

    # batting
    add("ipl-century", "batting", "Name a player who has scored an IPL century", lambda p: p.hundreds >= 1,
        lambda p: p.hundreds * 100 + p.runs / 100, "bowler")
    add("runs-4000", "batting", "Name a player with 4,000+ IPL runs", lambda p: p.runs >= 4000, lambda p: p.runs, "bowler")
    add("sixes-150", "batting", "Name a player who has hit 150+ IPL sixes", lambda p: p.sixes >= 150, lambda p: p.sixes, "bowler")
    add("fifty-20-balls", "batting", "Name a player who has made an IPL fifty in 20 balls or fewer",
        lambda p: p.fastest_fifty_balls is not None and p.fastest_fifty_balls <= 20,
        lambda p: p.sixes, "bowler")
    add("season-600", "batting", "Name a player who has scored 600+ runs in one IPL season",
        lambda p: max(p.runs_by_season.values(), default=0) >= 600, lambda p: max(p.runs_by_season.values(), default=0), "bowler")

    # bowling
    add("hat-trick", "bowling", "Name a bowler who has taken an IPL hat-trick", lambda p: p.hat_tricks >= 1,
        lambda p: p.wickets, "batter")
    add("five-for", "bowling", "Name a bowler who has taken 5 wickets in an IPL innings", lambda p: p.five_fors >= 1,
        lambda p: p.wickets, "batter")
    add("wickets-100", "bowling", "Name a bowler with 100+ IPL wickets", lambda p: p.wickets >= 100, lambda p: p.wickets, "batter")
    add("first-ball-wicket", "bowling", "Name a bowler who took a wicket with their first ball in the IPL",
        lambda p: p.wicket_first_ball, lambda p: p.wickets, "batter")
    add("season-25-wickets", "bowling", "Name a bowler who has taken 25+ wickets in one IPL season",
        lambda p: max(p.wickets_by_season.values(), default=0) >= 25, lambda p: max(p.wickets_by_season.values(), default=0), "batter")

    # awards
    add("orange-cap", "awards", "Name a player who has won the IPL Orange Cap (most runs in a season)",
        lambda p: p.pid in orange)
    add("purple-cap", "awards", "Name a player who has won the IPL Purple Cap (most wickets in a season)",
        lambda p: p.pid in purple)
    add("pom-15", "awards", "Name a player with 15+ IPL Player of the Match awards", lambda p: p.pom >= 15, lambda p: p.pom)

    # finals
    add("final-pom", "finals", "Name a player who was Player of the Match in an IPL final", lambda p: p.final_pom >= 1)
    add("final-fifty", "finals", "Name a player who has scored a fifty in an IPL final", lambda p: p.final_fifty)
    add("won-3-titles", "finals", "Name a player who has won the IPL 3+ times (played in the final)",
        lambda p: p.finals_won >= 3)
    add("first-ipl-match", "finals", "Name a player from the very first IPL match (KKR v RCB, 2008)",
        lambda p: p.in_first_ipl_match)
    add("latest-final", "finals", f"Name a player who played in the {latest} IPL final", lambda p: p.in_latest_final)

    # teams
    add("mi-and-csk", "teams", "Name a player who has played for both Mumbai Indians and Chennai Super Kings",
        lambda p: {"Mumbai Indians", "Chennai Super Kings"} <= p.franchises)
    add("franchises-5", "teams", "Name a player who has played for 5+ IPL franchises", lambda p: len(p.franchises) >= 5)
    add("defunct-team", "teams", "Name a player who played for an IPL team that no longer exists",
        lambda p: bool(p.franchises & DEFUNCT))
    add("played-rr", "teams", "Name a player who has played for Rajasthan Royals", lambda p: "Rajasthan Royals" in p.franchises,
        lambda p: p.franchise_matches["Rajasthan Royals"], "team:Rajasthan Royals")
    add("played-kkr", "teams", "Name a player who has played for Kolkata Knight Riders",
        lambda p: "Kolkata Knight Riders" in p.franchises, lambda p: p.franchise_matches["Kolkata Knight Riders"],
        "team:Kolkata Knight Riders")
    add("played-srh", "teams", "Name a player who has played for Sunrisers Hyderabad",
        lambda p: "Sunrisers Hyderabad" in p.franchises, lambda p: p.franchise_matches["Sunrisers Hyderabad"],
        "team:Sunrisers Hyderabad")
    add("played-gt", "teams", "Name a player who has played for Gujarat Titans", lambda p: "Gujarat Titans" in p.franchises,
        lambda p: p.franchise_matches["Gujarat Titans"], "team:Gujarat Titans")

    # milestones
    add("matches-200", "milestones", "Name a player with 200+ IPL matches", lambda p: p.matches >= 200)
    add("seasons-15", "milestones", "Name a player who has played in 15+ IPL seasons", lambda p: len(p.seasons) >= 15)
    add("catches-90", "milestones", "Name a player with 90+ IPL catches (keepers included)", lambda p: p.catches >= 90, lambda p: p.catches, "bowler")
    add("stumping", "milestones", "Name a player who has made a stumping in the IPL", lambda p: p.stumpings >= 1, lambda p: p.stumpings)
    add("allrounder-1000-50", "milestones", "Name a player with 1,000+ IPL runs and 50+ IPL wickets",
        lambda p: p.runs >= 1000 and p.wickets >= 50)

    # match-ups
    add("dismissed-kohli", "matchups", "Name a bowler who has dismissed Virat Kohli in the IPL",
        lambda p: p.dismissed[kohli] >= 1, lambda p: p.dismissed[kohli] * 10 + p.wickets / 10, "batter")
    add("dismissed-dhoni", "matchups", "Name a bowler who has dismissed MS Dhoni in the IPL",
        lambda p: p.dismissed[dhoni] >= 1, lambda p: p.dismissed[dhoni] * 10 + p.wickets / 10, "batter")
    add("dismissed-rohit", "matchups", "Name a bowler who has dismissed Rohit Sharma in the IPL",
        lambda p: p.dismissed[rohit] >= 1, lambda p: p.dismissed[rohit] * 10 + p.wickets / 10, "batter")
    add("dismissed-kohli-3", "matchups", "Name a bowler who has dismissed Virat Kohli 3+ times in the IPL",
        lambda p: p.dismissed[kohli] >= 3, lambda p: p.dismissed[kohli] * 10 + p.wickets / 10)

    return P


if __name__ == "__main__":
    from cricket_stats import compute

    s = compute()
    for p in build(s):
        ans = sorted((pl for pl in s.players.values() if p.test(pl)), key=lambda x: -x.matches)
        print(f"{len(ans):4}  {p.slug:22} {', '.join(a.name for a in ans[:8])}{' ...' if len(ans) > 8 else ''}")
