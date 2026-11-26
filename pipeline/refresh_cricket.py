"""Download the latest IPL ball-by-ball data from Cricsheet.

Run after each IPL season (or whenever you want newer data):
    python pipeline/refresh_cricket.py
    python pipeline/build_cricket.py
Then run supabase/data/cricket.sql in the Supabase SQL editor.

Data: Cricsheet (cricsheet.org), Open Data Commons Attribution licence.
"""

from __future__ import annotations

import urllib.request
import zipfile
from pathlib import Path

URL = "https://cricsheet.org/downloads/ipl_json.zip"
OUT = Path(__file__).parent / "data" / "ipl_json.zip"


def main() -> None:
    tmp = OUT.with_suffix(".download")
    with urllib.request.urlopen(URL, timeout=120) as r:
        tmp.write_bytes(r.read())
    with zipfile.ZipFile(tmp) as z:
        n = sum(1 for name in z.namelist() if name.endswith(".json"))
    if n < 1000:
        tmp.unlink()
        raise SystemExit(f"Only {n} matches in the download; keeping the old file.")
    tmp.replace(OUT)
    print(f"Saved {n} IPL matches to {OUT}")


if __name__ == "__main__":
    main()
