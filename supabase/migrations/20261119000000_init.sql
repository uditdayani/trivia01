-- M0 schema for the rare-answer trivia game.
-- Run in the Supabase SQL editor, or with `supabase db push`.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Packs: one per niche (geography, cricket, ...)
create table packs (
  id         smallint generated always as identity primary key,
  slug       text unique not null,
  name       text not null,
  is_active  boolean not null default true
);

-- Prompts: the open-answer questions
create table prompts (
  id            bigint generated always as identity primary key,
  pack_id       smallint not null references packs(id),
  text          text not null,
  time_limit_s  smallint not null default 30 check (time_limit_s between 10 and 60),
  difficulty    smallint check (difficulty between 1 and 5),
  as_of_date    date,                      -- for answer sets that change (cricket stats)
  created_at    timestamptz not null default now()
);
create index on prompts (pack_id);

-- Canonical correct answers per prompt
create table answers (
  id              bigint generated always as identity primary key,
  prompt_id       bigint not null references prompts(id) on delete cascade,
  canonical_name  text not null,
  seed_weight     real not null default 1 check (seed_weight > 0),  -- prior popularity for cold start
  unique (prompt_id, canonical_name)
);
create index on answers (prompt_id);

-- Accepted spellings per answer, stored already normalised
create table aliases (
  id                bigint generated always as identity primary key,
  answer_id         bigint not null references answers(id) on delete cascade,
  alias_normalized  text not null,
  unique (answer_id, alias_normalized)
);
create index aliases_trgm_idx on aliases using gin (alias_normalized gin_trgm_ops);

-- One puzzle per pack per day (players choose which pack to play)
create table daily_puzzles (
  puzzle_date  date not null,
  pack_id      smallint not null references packs(id),
  prompt_ids   bigint[] not null check (cardinality(prompt_ids) = 7),
  status       text not null default 'scheduled' check (status in ('scheduled', 'live', 'final')),
  primary key (puzzle_date, pack_id)
);

-- Players: one row per Supabase auth user (anonymous sign-in for v1)
create table players (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- Every answer a player gives
create table submissions (
  id           bigint generated always as identity primary key,
  player_id    uuid not null references players(id) on delete cascade,
  puzzle_date  date not null,
  pack_id      smallint not null references packs(id),
  prompt_id    bigint not null references prompts(id),
  raw_input    text not null,
  answer_id    bigint references answers(id),   -- null = wrong / unmatched
  points       smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (player_id, puzzle_date, prompt_id)     -- one answer per prompt per day
);
create index on submissions (prompt_id, puzzle_date, answer_id);

-- How many players gave each answer, per prompt per day
create view answer_counts as
select prompt_id, puzzle_date, answer_id, count(*)::int as n
from submissions
where answer_id is not null
group by prompt_id, puzzle_date, answer_id;

-- Normalise player input the same way the pipeline normalises aliases
create or replace function normalize_answer(raw text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(lower(public.unaccent(raw)), '[^a-z0-9 ]', ' ', 'g'),
             '^\s*the\s+', ''),
           '\s+', ' ', 'g'))
$$;

-- Row-level security: the browser may read packs only.
-- Prompts are read through the server; answers, aliases and submissions
-- are only touched by server code using the service-role key.
alter table packs          enable row level security;
alter table prompts        enable row level security;
alter table answers        enable row level security;
alter table aliases        enable row level security;
alter table daily_puzzles  enable row level security;
alter table players        enable row level security;
alter table submissions    enable row level security;

create policy "packs are public" on packs for select using (true);
create policy "players read own row" on players for select using (auth.uid() = id);
create policy "players read own submissions" on submissions for select using (auth.uid() = player_id);
