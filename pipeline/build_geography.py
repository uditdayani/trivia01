"""Build the Geography pack: countries, their accepted spellings, prompts and answers.

Reads  pipeline/data/countries.json, pipeline/data/population.json
Writes supabase/data/geography.sql   (run it in the Supabase SQL editor; safe to re-run)
       pipeline/out/geography_prompts.md  (human-readable review of every prompt)

Run:  python pipeline/build_geography.py
"""

from __future__ import annotations

import json
import math
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "pipeline" / "data"
SQL_OUT = ROOT / "supabase" / "data" / "geography.sql"
MD_OUT = ROOT / "pipeline" / "out" / "geography_prompts.md"

MIN_ANSWERS = 10  # a prompt needs room for rarity to spread
PACK = "geography"

# Countries in scope: UN members plus the two UN observer states.
OBSERVERS = {"VAT", "PSE"}

# Well-known English names that the data doesn't carry. Also used by name-based
# prompts ("starts with C" accepts Cote d'Ivoire as well as Ivory Coast).
ENGLISH_ALT_NAMES: dict[str, list[str]] = {
    "CIV": ["Cote d'Ivoire"],
    "TUR": ["Turkey"],
    "CZE": ["Czech Republic"],
    "MMR": ["Burma"],
    "TLS": ["East Timor"],
    "CPV": ["Cabo Verde"],
    "SWZ": ["Swaziland"],
    # "Congo" and "Korea" go on both countries; matching prefers whichever answers the prompt
    "COD": ["Democratic Republic of the Congo", "Congo-Kinshasa", "Congo"],
    "COG": ["Congo-Brazzaville", "Congo"],
    "VAT": ["Holy See", "Vatican"],
    "MKD": ["Macedonia"],
    "NLD": ["Holland"],
    "GBR": ["Great Britain", "Britain"],
    "USA": ["America", "United States of America"],
    "ARE": ["Emirates"],
    "PRK": ["DPRK", "Korea"],
    "KOR": ["Republic of Korea", "Korea"],
    "FSM": ["Federated States of Micronesia"],
    "STP": ["Sao Tome"],
    "VCT": ["St Vincent", "Saint Vincent"],
    "KNA": ["St Kitts", "Saint Kitts", "St Kitts and Nevis"],
    "LCA": ["St Lucia"],
    "BIH": ["Bosnia"],
    "TTO": ["Trinidad"],
    "ATG": ["Antigua"],
    "GNB": ["Guinea Bissau"],
    "PNG": ["Papua"],
    "LAO": ["Lao"],
    "BRN": ["Brunei Darussalam"],
    "RUS": ["Russian Federation"],
    "SYR": ["Syrian Arab Republic"],
}

# Aliases from the data that are too ambiguous or misleading to accept.
BLOCKED_ALIASES = {"guinea republic", "car", "us", "uk"}
# ...but these short forms are fine and common:
EXTRA_SHORT = {"USA": ["USA", "US"], "GBR": ["UK"], "ARE": ["UAE"], "COD": ["DRC"]}


def strip_accents(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch))


def norm(s: str) -> str:
    """Mirror of normalize_answer() in SQL, used only for dedupe here."""
    s = strip_accents(s).lower()
    s = "".join(ch if ch.isalnum() and ch.isascii() else " " for ch in s)
    s = " ".join(s.split())
    return s[4:] if s.startswith("the ") else s


def is_latin(s: str) -> bool:
    return all(ord(ch) < 0x250 or not ch.isalpha() for ch in s)


@dataclass
class Country:
    code: str
    name: str
    raw: dict
    population: int

    @property
    def english_names(self) -> list[str]:
        return [self.name, *ENGLISH_ALT_NAMES.get(self.code, [])]

    def any_name(self, test: Callable[[str], bool]) -> bool:
        return any(test(norm(n)) for n in self.english_names)

    @property
    def borders(self) -> list[str]:
        return self.raw.get("borders", [])

    @property
    def capital(self) -> str:
        return (self.raw.get("capital") or [""])[0]

    @property
    def currency_names(self) -> list[str]:
        return [c["name"].lower() for c in self.raw.get("currencies", {}).values()]

    @property
    def languages(self) -> list[str]:
        return list(self.raw.get("languages", {}).values())


def load() -> list[Country]:
    raw = json.loads((DATA / "countries.json").read_text(encoding="utf-8"))
    pops = json.loads((DATA / "population.json").read_text(encoding="utf-8"))
    chosen = [c for c in raw if c.get("unMember") or c["cca3"] in OBSERVERS]
    codes = {c["cca3"] for c in chosen}
    out = []
    for c in chosen:
        c = dict(c)
        c["borders"] = [b for b in c.get("borders", []) if b in codes]  # drop non-sovereign neighbours
        out.append(Country(c["cca3"], c["name"]["common"], c, int(pops.get(c["cca3"], 100_000))))
    return sorted(out, key=lambda c: c.name)


def aliases_for(c: Country) -> list[str]:
    names = [c.name, c.raw["name"]["official"], *ENGLISH_ALT_NAMES.get(c.code, [])]
    names += [a for a in c.raw.get("altSpellings", []) if len(a) > 3]
    for native in c.raw["name"].get("native", {}).values():
        for key in ("common", "official"):
            if is_latin(native[key]) and len(native[key]) > 3:
                names.append(native[key])
    seen, out = set(), []
    for n in names:
        k = norm(n)
        if k and k not in seen and k not in BLOCKED_ALIASES:
            seen.add(k)
            out.append(n)
    # hand-picked short forms are allowed even if a generic block list would catch them
    for n in EXTRA_SHORT.get(c.code, []):
        if norm(n) not in seen:
            seen.add(norm(n))
            out.append(n)
    return out


@dataclass
class PromptDef:
    slug: str
    theme: str
    text: str
    test: Callable[[Country], bool]


def build_prompts(countries: list[Country]) -> list[PromptDef]:
    by_code = {c.code: c for c in countries}
    P: list[PromptDef] = []

    def add(slug, theme, text, test):
        P.append(PromptDef(slug, theme, text, test))

    # physical
    add("landlocked", "physical", "Name a landlocked country", lambda c: c.raw.get("landlocked", False))
    add("no-land-borders", "physical", "Name a country with no land borders", lambda c: not c.borders)
    add("area-over-1m", "physical", "Name a country larger than 1,000,000 km²", lambda c: c.raw.get("area", 0) > 1_000_000)
    add("area-under-1k", "physical", "Name a country smaller than 1,000 km²", lambda c: c.raw.get("area", 0) < 1_000)

    # region
    regions = [
        ("africa", "Name a country in Africa", lambda c: c.raw["region"] == "Africa"),
        ("asia", "Name a country in Asia", lambda c: c.raw["region"] == "Asia"),
        ("europe", "Name a country in Europe", lambda c: c.raw["region"] == "Europe"),
        ("oceania", "Name a country in Oceania", lambda c: c.raw["region"] == "Oceania"),
        ("south-america", "Name a country in South America", lambda c: c.raw.get("subregion") == "South America"),
        ("north-central-america", "Name a country in North or Central America, or the Caribbean",
         lambda c: c.raw.get("subregion") in ("North America", "Central America", "Caribbean")),
        ("caribbean", "Name a country in the Caribbean", lambda c: c.raw.get("subregion") == "Caribbean"),
        ("west-africa", "Name a country in West Africa", lambda c: c.raw.get("subregion") == "Western Africa"),
        ("east-africa", "Name a country in East Africa", lambda c: c.raw.get("subregion") == "Eastern Africa"),
        ("central-africa", "Name a country in Central Africa", lambda c: c.raw.get("subregion") == "Middle Africa"),
        ("western-asia", "Name a country in Western Asia (Middle East and Caucasus)", lambda c: c.raw.get("subregion") == "Western Asia"),
        ("southeast-asia", "Name a country in Southeast Asia", lambda c: c.raw.get("subregion") == "South-Eastern Asia"),
        ("northern-europe", "Name a country in Northern Europe", lambda c: c.raw.get("subregion") == "Northern Europe"),
    ]
    for slug, text, test in regions:
        add(f"region-{slug}", "region", text, test)

    # borders
    add("borders-china", "borders", "Name a country that borders China", lambda c: "CHN" in c.borders)
    add("borders-russia", "borders", "Name a country that borders Russia", lambda c: "RUS" in c.borders)
    add("borders-germany-france", "borders", "Name a country that borders Germany or France",
        lambda c: "DEU" in c.borders or "FRA" in c.borders)
    add("borders-6-plus", "borders", "Name a country that borders at least 6 other countries", lambda c: len(c.borders) >= 6)
    add("borders-exactly-1", "borders", "Name a country that borders exactly one other country", lambda c: len(c.borders) == 1)

    # language (official languages)
    for lang in ("English", "French", "Arabic", "Spanish", "Portuguese"):
        add(f"language-{lang.lower()}", "language", f"Name a country where {lang} is an official language",
            lambda c, lang=lang: lang in c.languages)

    # currency
    add("currency-euro", "currency", "Name a country that uses the euro", lambda c: any(n == "euro" for n in c.currency_names))
    add("currency-dollar", "currency", "Name a country whose currency is called a dollar",
        lambda c: any("dollar" in n for n in c.currency_names))
    add("currency-franc", "currency", "Name a country whose currency is called a franc",
        lambda c: any("franc" in n for n in c.currency_names))

    # letters (country names; any common English name counts)
    for letter in "SMBCAGNTP":
        add(f"starts-{letter.lower()}", "letters", f"Name a country that starts with {letter}",
            lambda c, l=letter.lower(): c.any_name(lambda n: n.startswith(l)))
    add("ends-ia", "letters", "Name a country whose name ends in -ia", lambda c: c.any_name(lambda n: n.endswith("ia")))
    add("two-words", "letters", "Name a country with two or more words in its name",
        lambda c: " " in norm(c.name))
    add("contains-z", "letters", "Name a country with a Z in its name", lambda c: c.any_name(lambda n: "z" in n))
    add("contains-k", "letters", "Name a country with a K in its name", lambda c: c.any_name(lambda n: "k" in n))
    add("same-first-last", "letters", "Name a country whose name starts and ends with the same letter",
        lambda c: c.any_name(lambda n: n.replace(" ", "")[0] == n.replace(" ", "")[-1]))
    add("five-letters-or-fewer", "letters", "Name a country with 5 letters or fewer in its name",
        lambda c: c.any_name(lambda n: len(n.replace(" ", "")) <= 5))

    # capitals
    for letter in "BMSAPKLTN":
        add(f"capital-starts-{letter.lower()}", "capital", f"Name a country whose capital starts with {letter}",
            lambda c, l=letter.lower(): norm(c.capital).startswith(l))

    _ = by_code
    return P


def popularity(c: Country) -> float:
    """Interim fame prior: sqrt(population). Replace with Wikipedia pageviews later."""
    return round(math.sqrt(max(c.population, 1_000)) / 100, 3)


def difficulty(n_answers: int) -> int:
    return 1 if n_answers >= 40 else 2 if n_answers >= 25 else 3 if n_answers >= 15 else 4


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    countries = load()
    prompts = build_prompts(countries)

    kept, dropped = [], []
    for p in prompts:
        answers = [c for c in countries if p.test(c)]
        (kept if len(answers) >= MIN_ANSWERS else dropped).append((p, answers))

    # ---------- SQL ----------
    L: list[str] = []
    L.append("-- Generated by pipeline/build_geography.py. Do not edit by hand.")
    L.append("-- Country data: mledoze/countries (world-countries npm), ODbL 1.0.")
    L.append("begin;")
    L.append(f"insert into packs (slug, name) values ({q(PACK)}, 'Geography') on conflict (slug) do nothing;")
    L.append("")
    L.append("insert into entities (pack_id, slug, canonical_name, popularity)")
    L.append(f"select p.id, v.slug, v.name, v.pop from packs p, (values")
    L.append(",\n".join(f"  ({q(c.code.lower())}, {q(c.name)}, {popularity(c)})" for c in countries))
    L.append(f") as v(slug, name, pop) where p.slug = {q(PACK)}")
    L.append("on conflict (pack_id, slug) do update set canonical_name = excluded.canonical_name, popularity = excluded.popularity;")
    L.append("")
    L.append("delete from entity_aliases where entity_id in (")
    L.append(f"  select e.id from entities e join packs p on p.id = e.pack_id where p.slug = {q(PACK)});")
    L.append("insert into entity_aliases (entity_id, alias_normalized)")
    L.append("select distinct e.id, normalize_answer(v.alias) from (values")
    L.append(",\n".join(f"  ({q(c.code.lower())}, {q(a)})" for c in countries for a in aliases_for(c)))
    L.append(f") as v(slug, alias) join entities e on e.slug = v.slug join packs p on p.id = e.pack_id and p.slug = {q(PACK)}")
    L.append("where normalize_answer(v.alias) <> '' on conflict do nothing;")
    L.append("")
    L.append("insert into prompts (pack_id, slug, theme, text, difficulty, time_limit_s)")
    L.append("select p.id, v.slug, v.theme, v.text, v.difficulty, 30 from packs p, (values")
    L.append(",\n".join(f"  ({q(p.slug)}, {q(p.theme)}, {q(p.text)}, {difficulty(len(a))})" for p, a in kept))
    L.append(f") as v(slug, theme, text, difficulty) where p.slug = {q(PACK)}")
    L.append("on conflict (slug) do update set theme = excluded.theme, text = excluded.text, difficulty = excluded.difficulty;")
    L.append("")
    L.append("create temp table _new_answers (prompt_slug text, entity_slug text, w real) on commit drop;")
    L.append("insert into _new_answers values")
    L.append(",\n".join(f"  ({q(p.slug)}, {q(c.code.lower())}, {popularity(c)})" for p, a in kept for c in a) + ";")
    L.append("insert into answers (prompt_id, entity_id, seed_weight)")
    L.append("select pr.id, e.id, n.w from _new_answers n")
    L.append("join prompts pr on pr.slug = n.prompt_slug")
    L.append(f"join entities e on e.slug = n.entity_slug join packs p on p.id = e.pack_id and p.slug = {q(PACK)}")
    L.append("on conflict (prompt_id, entity_id) do update set seed_weight = excluded.seed_weight;")
    L.append("-- remove answers that no longer qualify (unless a player already gave them)")
    L.append("delete from answers a using prompts pr, entities e")
    L.append("where a.prompt_id = pr.id and a.entity_id = e.id")
    L.append(f"  and pr.pack_id = (select id from packs where slug = {q(PACK)})")
    L.append("  and not exists (select 1 from _new_answers n where n.prompt_slug = pr.slug and n.entity_slug = e.slug)")
    L.append("  and not exists (select 1 from submissions s where s.answer_id = a.id);")
    L.append("commit;")
    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    SQL_OUT.write_text("\n".join(L) + "\n", encoding="utf-8")

    # ---------- review report ----------
    M = ["# Geography prompts (generated)", "",
         f"{len(countries)} countries, {sum(len(aliases_for(c)) for c in countries)} accepted spellings, "
         f"{len(kept)} prompts kept, {len(dropped)} dropped (< {MIN_ANSWERS} answers).", ""]
    M.append("| Theme | Prompt | Answers | Most likely (prior) | Rarest (prior) |")
    M.append("| --- | --- | --- | --- | --- |")
    for p, a in sorted(kept, key=lambda t: (t[0].theme, t[0].slug)):
        ranked = sorted(a, key=popularity, reverse=True)
        M.append(f"| {p.theme} | {p.text} | {len(a)} | {', '.join(c.name for c in ranked[:3])} | "
                 f"{', '.join(c.name for c in ranked[-3:])} |")
    if dropped:
        M += ["", "## Dropped", ""] + [f"- {p.text} ({len(a)} answers)" for p, a in dropped]
    M += ["", "## Full answer lists", ""]
    for p, a in kept:
        M.append(f"**{p.text}** ({len(a)}): {', '.join(c.name for c in a)}")
        M.append("")
    MD_OUT.parent.mkdir(parents=True, exist_ok=True)
    MD_OUT.write_text("\n".join(M), encoding="utf-8")

    themes = sorted({p.theme for p, _ in kept})
    print(f"countries={len(countries)} prompts kept={len(kept)} dropped={len(dropped)} themes={themes}")
    for p, a in dropped:
        print(f"  dropped: {p.slug} ({len(a)})")


if __name__ == "__main__":
    main()
