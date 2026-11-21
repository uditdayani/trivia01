-- M3: players identified by a server-issued cookie, server-kept question timers,
-- saved answers, and live rarity shares.

-- 1. Players: our own random id (set in an httpOnly cookie by the server).
--    auth_user_id is kept for linking real accounts later.
alter table players drop constraint players_id_fkey;
alter table players alter column id set default gen_random_uuid();
alter table players add column auth_user_id uuid unique references auth.users(id) on delete set null;

-- 2. When each player first saw each question. The server's clock is the only clock.
create table prompt_views (
  player_id    uuid not null references players(id) on delete cascade,
  puzzle_date  date not null,
  prompt_id    bigint not null references prompts(id),
  started_at   timestamptz not null default now(),
  primary key (player_id, puzzle_date, prompt_id)
);
alter table prompt_views enable row level security;
grant select, insert, update, delete on prompt_views to service_role;

-- 3. Submissions record how the answer arrived.
alter table submissions
  add column status text not null default 'answered' check (status in ('answered', 'late'));

-- Seconds allowed after the visible timer hits zero (network delay).
create or replace function answer_grace() returns interval language sql immutable as $$ select interval '3 seconds' $$;

-- 4. Rarity share of one answer on one day, blended with the seeded prior:
--    share = (n_a + k * p_a) / (N + k), k = 50 virtual players (design doc, Core logic).
create or replace function answer_share(p_prompt_id bigint, p_date date, p_answer_id bigint)
returns table (share real, n_answer int, n_correct int)
language sql stable
set search_path = public
as $$
  with w as (
    select id, seed_weight, sum(seed_weight) over () as total
    from answers where prompt_id = p_prompt_id
  ), c as (
    select count(*) filter (where answer_id = p_answer_id) as na,
           count(*) filter (where answer_id is not null)   as nt
    from submissions
    where prompt_id = p_prompt_id and puzzle_date = p_date
  )
  select ((c.na + 50 * w.seed_weight / w.total) / (c.nt + 50))::real, c.na::int, c.nt::int
  from w, c
  where w.id = p_answer_id;
$$;

-- 5. A player's whole day: one row per question, in puzzle order.
--    Question text is only returned once the player has opened that question.
create or replace function player_day(p_player_id uuid, p_pack_slug text, p_date date)
returns table (
  ord             int,
  prompt_id       bigint,
  time_limit_s    smallint,
  status          text,      -- unseen | in_progress | expired | answered | late
  prompt_text     text,
  remaining_ms    int,
  raw_input       text,
  canonical_name  text,
  is_correct      boolean,
  share           real,
  n_answer        int,
  n_correct       int
)
language sql stable
set search_path = public
as $$
  select
    t.ord::int,
    t.id,
    t.time_limit_s,
    case
      when s.id is not null then s.status
      when v.started_at is null then 'unseen'
      when now() > v.started_at + make_interval(secs => t.time_limit_s) + answer_grace() then 'expired'
      else 'in_progress'
    end,
    case when v.started_at is not null then t.text end,
    case when v.started_at is not null and s.id is null then
      greatest(0, extract(epoch from (v.started_at + make_interval(secs => t.time_limit_s) - now())) * 1000)::int
    end,
    s.raw_input,
    e.canonical_name,
    s.answer_id is not null,
    sh.share,
    sh.n_answer,
    sh.n_correct
  from todays_prompts(p_pack_slug, p_date) with ordinality as t(id, text, time_limit_s, theme, difficulty, ord)
  left join prompt_views v on v.player_id = p_player_id and v.puzzle_date = p_date and v.prompt_id = t.id
  left join submissions s  on s.player_id = p_player_id and s.puzzle_date = p_date and s.prompt_id = t.id
  left join entities e     on e.id = s.matched_entity_id
  left join lateral answer_share(t.id, p_date, s.answer_id) sh on s.answer_id is not null
  order by t.ord;
$$;

-- 6. Open a question: only the next one in order, once. Returns its text and time left.
create or replace function start_prompt(p_player_id uuid, p_pack_slug text, p_date date, p_prompt_id bigint)
returns table (prompt_text text, time_limit_s smallint, remaining_ms int)
language plpgsql
set search_path = public
as $$
declare
  v_next bigint;
begin
  insert into players (id) values (p_player_id) on conflict (id) do nothing;

  select d.prompt_id into v_next
  from player_day(p_player_id, p_pack_slug, p_date) d
  where d.status in ('unseen', 'in_progress')
  order by d.ord
  limit 1;

  if v_next is null then
    raise exception 'puzzle already finished' using errcode = 'P0002';
  end if;
  if v_next <> p_prompt_id then
    raise exception 'answer the current question first' using errcode = 'P0003';
  end if;

  insert into prompt_views (player_id, puzzle_date, prompt_id)
  values (p_player_id, p_date, p_prompt_id)
  on conflict do nothing;

  return query
    select d.prompt_text, d.time_limit_s, d.remaining_ms
    from player_day(p_player_id, p_pack_slug, p_date) d
    where d.prompt_id = p_prompt_id;
end;
$$;

-- 7. Submit an answer: checks the server timer, matches, saves, and returns the live share.
create or replace function submit_answer(p_player_id uuid, p_date date, p_prompt_id bigint, p_input text)
returns table (
  status          text,      -- answered | late | duplicate
  canonical_name  text,
  is_correct      boolean,
  share           real,
  n_answer        int,
  n_correct       int
)
language plpgsql
set search_path = public
as $$
declare
  v_started  timestamptz;
  v_limit    smallint;
  v_pack     smallint;
  v_existing submissions%rowtype;
  v_match    record;
  v_sub_id   bigint;
begin
  select pv.started_at, p.time_limit_s, p.pack_id into v_started, v_limit, v_pack
  from prompt_views pv join prompts p on p.id = pv.prompt_id
  where pv.player_id = p_player_id and pv.puzzle_date = p_date and pv.prompt_id = p_prompt_id;

  if v_started is null then
    raise exception 'question not started' using errcode = 'P0004';
  end if;

  select * into v_existing from submissions s
  where s.player_id = p_player_id and s.puzzle_date = p_date and s.prompt_id = p_prompt_id;
  if found then
    return query
      select 'duplicate'::text, e.canonical_name, v_existing.answer_id is not null, sh.share, sh.n_answer, sh.n_correct
      from (select 1) x
      left join entities e on e.id = v_existing.matched_entity_id
      left join lateral answer_share(p_prompt_id, p_date, v_existing.answer_id) sh on true;
    return;
  end if;

  if now() > v_started + make_interval(secs => v_limit) + answer_grace() then
    insert into submissions (player_id, puzzle_date, pack_id, prompt_id, raw_input, status)
    values (p_player_id, p_date, v_pack, p_prompt_id, left(coalesce(p_input, ''), 80), 'late');
    return query select 'late'::text, null::text, false, null::real, null::int, null::int;
    return;
  end if;

  select * into v_match from match_answer(p_prompt_id, p_input) limit 1;

  insert into submissions (player_id, puzzle_date, pack_id, prompt_id, raw_input, answer_id, matched_entity_id, status)
  values (p_player_id, p_date, v_pack, p_prompt_id, left(coalesce(p_input, ''), 80),
          case when v_match.is_correct then v_match.answer_id end, v_match.entity_id, 'answered')
  on conflict (player_id, puzzle_date, prompt_id) do nothing
  returning id into v_sub_id;

  if v_sub_id is null then  -- lost a race with a double submit
    return query select * from submit_answer(p_player_id, p_date, p_prompt_id, p_input);
    return;
  end if;

  return query
    select 'answered'::text, v_match.canonical_name, coalesce(v_match.is_correct, false), sh.share, sh.n_answer, sh.n_correct
    from (select 1) x
    left join lateral answer_share(p_prompt_id, p_date, v_match.answer_id) sh on v_match.is_correct;
end;
$$;

-- 8. After finishing: the most common correct answers to a question that day.
create or replace function top_answers(p_prompt_id bigint, p_date date, p_limit int default 3)
returns table (canonical_name text, n int)
language sql stable
set search_path = public
as $$
  select e.canonical_name, count(*)::int
  from submissions s
  join answers a on a.id = s.answer_id
  join entities e on e.id = a.entity_id
  where s.prompt_id = p_prompt_id and s.puzzle_date = p_date
  group by e.canonical_name
  order by count(*) desc, e.canonical_name
  limit p_limit;
$$;

grant execute on function answer_grace() to service_role;
grant execute on function answer_share(bigint, date, bigint) to service_role;
grant execute on function player_day(uuid, text, date) to service_role;
grant execute on function start_prompt(uuid, text, date, bigint) to service_role;
grant execute on function submit_answer(uuid, date, bigint, text) to service_role;
grant execute on function top_answers(bigint, date, int) to service_role;
