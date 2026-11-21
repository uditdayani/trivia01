# Data pipeline

Builds pack content and writes SQL you run in the Supabase SQL editor.

| Step | Command | Output |
| --- | --- | --- |
| Refresh raw data (optional) | `python pipeline/refresh_sources.py` | `pipeline/data/*.json` |
| Build Geography | `python pipeline/build_geography.py` | `supabase/data/geography.sql`, `pipeline/out/geography_prompts.md` |
| Check tiers | `python pipeline/simulate_players.py` | `pipeline/out/simulation.md` |

Python 3.10+. `pip install -r pipeline/requirements.txt` (wordfreq).

## Rules

- Countries in scope: 193 UN members + Vatican City + Palestine (195).
- A prompt needs at least 10 correct answers, otherwise it's dropped.
- Accepted spellings live on the country, not the prompt, so "Nigeria" on a
  "landlocked" prompt is recognised as a real country that doesn't fit.
- Name-based prompts ("starts with C") accept any common English name:
  Cote d'Ivoire counts for C, Turkey for T.
- **Points are fixed before anyone plays.** `familiarity.py` scores how common each
  country's name is in written English (wordfreq), with hand-checked overrides for
  names that are also ordinary words (Jordan, Chad, Georgia, Turkey). `tiers.py` then
  ranks each question's answers against its most familiar answer: the obvious few
  get Wycheproof (20), the long tail Aconcagua (85), and only the one or two most
  obscure get Everest (100). Tier and points are stored on each answer.
- Real player data never changes points during a day. It can be used later to
  adjust `OVERRIDES` or the tier gaps before a question is reused.

## Sources and licences

- Country data: [mledoze/countries](https://github.com/mledoze/countries) via the
  `world-countries` npm package, ODbL 1.0. Attribution is shown in the app footer.
- Familiarity: [wordfreq](https://github.com/rspeer/wordfreq) by Robyn Speer,
  code Apache-2.0, data CC BY-SA 4.0.

## Tests

`supabase/tests/match_answer_test.sql` checks typos, alternative names and
wrong-country cases against the loaded data. Run it in the SQL editor; it ends
with "all N cases passed" or stops at the first failure.
