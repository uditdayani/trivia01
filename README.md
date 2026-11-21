# Rare-Answer Trivia

A daily browser trivia game: 7 open-answer prompts, ~30 seconds each, and every
correct answer scores by how few other players gave it. Packs: Geography first,
then Cricket.

Stack: Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, auth) · Vercel.

## Status: M0 (Foundations)

- [x] Next.js + TypeScript + Tailwind scaffold
- [x] Schema migration for all 7 tables, `pg_trgm` fuzzy matching, row-level security
- [x] Seed: Geography + Cricket packs, one test prompt with 16 answers
- [x] Rarity tiers + blended-share formula (`src/lib/tiers.ts`)
- [x] Home page reads a prompt from Supabase (connection check)
- [x] CI: lint, type-check, build
- [ ] Supabase project created and migration run (manual, see below)
- [ ] Deployed on Vercel (manual, see below)

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a free project at supabase.com. In **SQL Editor**, run
   `supabase/migrations/20261119000000_init.sql`, then `supabase/seed.sql`.
3. **Env:** copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` (URL: Connect button or Project Settings → Data API; key: Project Settings → API Keys → Secret key).
4. **Run:** `npm run dev` and open http://localhost:3000. You should see
   "Name a landlocked country" with a green "Read from Supabase" line.
5. **Deploy:** push to GitHub, import the repo in Vercel, and add the same two
   env vars in Vercel → Settings → Environment Variables.

## Project layout

```
src/app/page.tsx            M0 connection-check page
src/lib/supabase/server.ts  server-only Supabase client (service role)
src/lib/tiers.ts            tiers, points, rarity formula
supabase/migrations/        database schema
supabase/seed.sql           test data
```

## Security notes

- The service-role key is only used in server code (`server-only` import guard).
- Answers and aliases are never readable from the browser; validation runs on the server.
