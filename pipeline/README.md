# Data pipeline

Builds pack content and writes SQL you run in the Supabase SQL editor.

| Step | Command | Output |
| --- | --- | --- |
| Refresh raw data (optional) | `python pipeline/refresh_sources.py` | `pipeline/data/*.json` |
| Build Geography | `python pipeline/build_geography.py` | `supabase/data/geography.sql`, `pipeline/out/geography_prompts.md` |
| Refresh IPL data (after a season) | `python pipeline/refresh_cricket.py` | `pipeline/data/ipl_json.zip` |
| Build Cricket (IPL) | `python pipeline/build_cricket.py` | `supabase/data/cricket.sql`, `pipeline/out/cricket_prompts.md`, `pipeline/out/cricket_tiers_review.csv` |
| Check tiers | `python pipeline/simulate_players.py` | `pipeline/out/simulation.md` |
| Review tiers | open `pipeline/out/geography_tiers_review.csv` in Excel | one row per question and answer |

Python 3.10+. `pip install -r pipeline/requirements.txt` (wordfreq).

## Rules

- Countries in scope: 193 UN members + Vatican City + Palestine (195).
- A prompt needs at least 10 correct answers, otherwise it's dropped.
- Accepted spellings live on the country, not the prompt, so "Nigeria" on a
  "landlocked" prompt is recognised as a real country that doesn't fit.
- Name-based prompts ("starts with C") accept any common English name:
  Cote d'Ivoire counts for C, Turkey for T.
- **Points are fixed per question, before anyone plays.** `data/geography_tiers.json`
  lists, for every question, which answers players are expected to say (Wycheproof)
  through to correct-but-unexpected answers (Everest). The same country scores
  differently by question: France is Wycheproof for "uses the euro" but Everest for
  "borders 6+ countries". Answers not listed are Aconcagua. Predictable "clever"
  picks (Vatican City, Andorra, Liechtenstein) are rated as such, so they're never
  an easy 100. The file was drafted with an AI model and is meant to be reviewed:
  edit it, rerun the build, and check `out/geography_tiers_review.csv`.
- The build refuses a tiers file with a misspelt or wrong country, a country listed
  twice, a question with no obvious answer, or a question without 1 to 3 Everest answers.
- Real player data never changes points during a day. It can be used later to
  adjust `OVERRIDES` or the tier gaps before a question is reused.

## Sources and licences

- Country data: [mledoze/countries](https://github.com/mledoze/countries) via the
  `world-countries` npm package, ODbL 1.0. Attribution is shown in the app footer.
- Tie-break familiarity: [wordfreq](https://github.com/rspeer/wordfreq) by Robyn Speer,
  code Apache-2.0, data CC BY-SA 4.0.

## Tests

`supabase/tests/match_answer_test.sql` checks typos, alternative names and
wrong-country cases against the loaded data. Run it in the SQL editor; it ends
with "all N cases passed" or stops at the first failure.

## Cricket (IPL)

- Every answer list is computed from Cricsheet ball-by-ball data for every IPL
  match (2008 to the 2026 final), so it is exact as of the date on each question.
  Super overs are left out, as in official stats. Checked against known records:
  every Orange and Purple Cap winner, every champion, and career figures such as
  Gayle's 357 sixes and Mishra's 3 hat-tricks.
- Questions live in `cricket_prompts.py`. A question needs at least 10 answers.
- Tiers: a baseline from how prominent each answer is for that question
  (centuries for the century question, times dismissing Kohli for the Kohli one),
  plus `data/cricket_tiers.json`, which names each question's Everest answers
  (correct but logically unexpected) and any overrides.
- Names: players type "Virat Kohli", Cricsheet says "V Kohli". Matching handles
  first names (initials + surname), a surname alone when one player clearly owns
  it ("Kohli" yes, "Sharma" no: Rohit and Sandeep both have long careers), typos
  ("Virat Kholi"), and nicknames from `data/cricket_aliases.json` ("Mahi", "Bhuvi").
  Tests: `supabase/tests/cricket_names_test.sql`.
- Sources: IPL data from [Cricsheet](https://cricsheet.org) (ODC Attribution), via the
  [ritesh-ojha/IPL-DATASET](https://github.com/ritesh-ojha/IPL-DATASET) mirror (MIT).
