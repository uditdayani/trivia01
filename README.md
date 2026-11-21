# Rare-Answer Trivia

A daily browser trivia game: 7 open-answer prompts, ~30 seconds each, and every
correct answer scores by how few other players gave it. Packs: Geography first,
then Cricket.

Stack: Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, auth) · Vercel.

## Status

- [x] **M0 Foundations:** Next.js + Supabase scaffold, schema, CI
- [x] **M1 Geography data:** Python pipeline, 195 countries, 53 prompts, 765 spellings (`pipeline/`)
- [x] **M2 Playable loop:** daily 7-question game, 30s timer, server-side answer matching, results
- [x] **M3 Rarity scoring and sharing:** answers saved, fixed tier points (set in the pipeline), one play per day (cookie), server-kept timer, share card
- [x] **M4 Daily operations:** 30-day puzzle schedule, daily rollover job (Vercel Cron), analytics events, `daily_stats` and `answer_review` views, dark colour-coded UI
- [ ] Public beta: deploy, run 14 days unattended, share

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a free project at supabase.com. In **SQL Editor**, run each
   file in `supabase/migrations/` in date order, then `supabase/seed.sql`, then
   `supabase/data/geography.sql`. Optionally run `supabase/tests/match_answer_test.sql`.
   To check how tiers spread, run `pip install -r pipeline/requirements.txt`, then
   `python pipeline/simulate_players.py`.
3. **Env:** copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` (URL: Connect button or Project Settings → Data API; key: Project Settings → API Keys → Secret key).
4. **Run:** `npm run dev`, open http://localhost:3000 and choose Geography.
5. **Deploy:** push to GitHub, import the repo in Vercel, and add `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY` and `CRON_SECRET` (any long random string) in
   Vercel → Settings → Environment Variables. `vercel.json` runs
   `/api/cron/rollover` once a day; Vercel sends the secret automatically.

## Running it day to day

- **Schedule:** 30 days of puzzles are always planned ahead. After adding or
  editing questions, run `select reschedule_future('geography');` in the SQL editor.
- **Health check:** `select * from daily_stats;` shows players, finishes, average
  score, shares and next-day returns per day.
- **Missing spellings:** `select * from answer_review;` lists answers that weren't
  recognised or real countries players thought were right. Add spellings in
  `pipeline/build_geography.py` and rerun the build.

## Project layout

```
src/app/page.tsx            home: pack choice + tier ladder
src/app/play/[pack]/        today's puzzle (server) + game UI (client)
src/app/api/answer/         answer checking API
src/lib/game.ts             puzzle + matching calls (server-only)
src/lib/tiers.ts            tiers, points, rarity formula
pipeline/                   Python data pipeline (see pipeline/README.md)
supabase/migrations/        database schema
supabase/data/              generated pack content
supabase/tests/             SQL checks for answer matching
```

## Security notes

- The service-role key is only used in server code (`server-only` import guard).
- Answers and aliases are never readable from the browser; validation runs on the server.
