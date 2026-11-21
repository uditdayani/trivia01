"""Download the raw country data and save trimmed copies in pipeline/data/.

Sources
- world-countries (npm, mledoze/countries) - ODbL 1.0. Same data REST Countries is built on.

Run:  python pipeline/refresh_sources.py
Only needed when you want newer data; the trimmed files are committed.
"""

from __future__ import annotations

import io
import json
import tarfile
import urllib.request
from pathlib import Path

WORLD_COUNTRIES_VERSION = "5.1.0"

DATA = Path(__file__).parent / "data"

KEEP = (
    "name", "cca3", "altSpellings", "unMember", "independent", "region", "subregion",
    "languages", "currencies", "landlocked", "borders", "area", "capital",
)


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def world_countries() -> list[dict]:
    url = f"https://registry.npmjs.org/world-countries/-/world-countries-{WORLD_COUNTRIES_VERSION}.tgz"
    with tarfile.open(fileobj=io.BytesIO(fetch(url)), mode="r:gz") as tar:
        member = tar.extractfile("package/countries.json")
        assert member is not None
        raw = json.load(member)
    return [{k: c[k] for k in KEEP if k in c} for c in raw]


def main() -> None:
    DATA.mkdir(exist_ok=True)
    countries = world_countries()
    (DATA / "countries.json").write_text(json.dumps(countries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"countries: {len(countries)}")


if __name__ == "__main__":
    main()
