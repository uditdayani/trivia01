# Rare-Answer Trivia

A daily browser trivia game: 7 open-answer prompts, ~30 seconds each, and every
correct answer scores by how few other players gave it. Packs: Geography first,
then Cricket.

Stack: Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, auth) · Vercel.

## Status

- [x] **M0 Foundations:** Next.js + Supabase scaffold, schema, CI
- [x] **M1 Geography data:** Python pipeline, 195 countries, 53 prompts, 765 spellings (`pipeline/`)
- [x] **M2 Playable loop:** daily 7-question game, 30s timer, server-side answer matching, results
- [x] **M3 Rarity scoring and sharing:** answers saved, live tier points, one play per day (cookie), server-kept timer, share card
- [ ] M4 Geography beta launch

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a free project at supabase.com. In **SQL Editor**, run each
   file in `supabase/migrations/` in date order, then `supabase/seed.sql`, then
   `supabase/data/geography.sql`. Optionally run `supabase/tests/match_answer_test.sql`.
   To see how tiers spread, run `python pipeline/simulate_players.py 200 2`.
3. **Env:** copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` (URL: Connect button or Project Settings → Data API; key: Project Settings → API Keys → Secret key).
4. **Run:** `npm run dev`, open http://localhost:3000 and choose Geography.
5. **Deploy:** push to GitHub, import the repo in Vercel, and add the same two
   env vars in Vercel → Settings → Environment Variables.

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
