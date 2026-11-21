# Data pipeline

Builds pack content and writes SQL you run in the Supabase SQL editor.

| Step | Command | Output |
| --- | --- | --- |
| Refresh raw data (optional) | `python pipeline/refresh_sources.py` | `pipeline/data/*.json` |
| Build Geography | `python pipeline/build_geography.py` | `supabase/data/geography.sql`, `pipeline/out/geography_prompts.md` |

Python 3.10+, standard library only.

## Rules

- Countries in scope: 193 UN members + Vatican City + Palestine (195).
- A prompt needs at least 10 correct answers, otherwise it's dropped.
- Accepted spellings live on the country, not the prompt, so "Nigeria" on a
  "landlocked" prompt is recognised as a real country that doesn't fit.
- Name-based prompts ("starts with C") accept any common English name:
  Cote d'Ivoire counts for C, Turkey for T.
- `seed_weight` / `popularity` is an interim fame prior (square root of population).
  Swap for Wikipedia pageviews later.

## Sources and licences

- Country data: [mledoze/countries](https://github.com/mledoze/countries) via the
  `world-countries` npm package, ODbL 1.0. Attribution is shown in the app footer.
- Population (prior only): `countryinfo` PyPI package, MIT.

## Tests

`supabase/tests/match_answer_test.sql` checks typos, alternative names and
wrong-country cases against the loaded data. Run it in the SQL editor; it ends
with "all N cases passed" or stops at the first failure.
