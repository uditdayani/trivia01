-- Players keep guessing until they're right or the clock runs out.
-- Wrong guesses go to `attempts`; `submissions` still holds one final row per
-- question (the correct answer, or the last guess when time ran out).

create table attempts (
  id                 bigint generated always as identity primary key,
  player_id          uuid not null references players(id) on delete cascade,
  puzzle_date        date not null,
  prompt_id          bigint not null references prompts(id),
  raw_input          text not null,
  matched_entity_id  bigint references entities(id),
  created_at         timestamptz not null default now()
);
create index on attempts (player_id, puzzle_date, prompt_id);
alter table attempts enable row level security;
grant select, insert, delete on attempts to service_role;

-- Wrong guesses allowed per question before it ends.
create or replace function max_wrong_guesses() returns int language sql immutable as $$ select 10 $$;

drop function if exists submit_answer(uuid, date, bigint, text);
drop function if exists player_day(uuid, text, date);

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
  tier            text,
  points          smallint,
  n_answer        int,
  n_correct       int,
  tried           text[]     -- wrong guesses so far, oldest first
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
    a.tier,
    coalesce(s.points, 0)::smallint,
    st.n_answer,
    st.n_correct,
    coalesce((
      select array_agg(coalesce(te.canonical_name, at.raw_input) order by at.created_at)
      from attempts at
      left join entities te on te.id = at.matched_entity_id
      where at.player_id = p_player_id and at.puzzle_date = p_date and at.prompt_id = t.id
    ), '{}')
  from todays_prompts(p_pack_slug, p_date) with ordinality as t(id, text, time_limit_s, theme, difficulty, ord)
  left join prompt_views v on v.player_id = p_player_id and v.puzzle_date = p_date and v.prompt_id = t.id
  left join submissions s  on s.player_id = p_player_id and s.puzzle_date = p_date and s.prompt_id = t.id
  left join answers a      on a.id = s.answer_id
  left join entities e     on e.id = s.matched_entity_id
  left join lateral answer_stats(t.id, p_date, s.answer_id) st on s.answer_id is not null
  order by t.ord;
$$;

-- p_final = true when the clock ran out: whatever was typed is the last word.
create or replace function submit_answer(
  p_player_id uuid, p_date date, p_prompt_id bigint, p_input text, p_final boolean default false
)
returns table (
  status          text,      -- answered | retry | late | duplicate
  canonical_name  text,
  is_correct      boolean,
  tier            text,
  points          smallint,
  n_answer        int,
  n_correct       int,
  guesses_left    int
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
  v_tier     text;
  v_points   smallint := 0;
  v_sub_id   bigint;
  v_wrong    int;
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
      select 'duplicate'::text, e.canonical_name, v_existing.answer_id is not null, a.tier, v_existing.points,
             st.n_answer, st.n_correct, 0
      from (select 1) x
      left join entities e on e.id = v_existing.matched_entity_id
      left join answers a on a.id = v_existing.answer_id
      left join lateral answer_stats(p_prompt_id, p_date, v_existing.answer_id) st on v_existing.answer_id is not null;
    return;
  end if;

  if now() > v_started + make_interval(secs => v_limit) + answer_grace() then
    insert into submissions (player_id, puzzle_date, pack_id, prompt_id, raw_input, status, points)
    values (p_player_id, p_date, v_pack, p_prompt_id, left(coalesce(p_input, ''), 80), 'late', 0)
    on conflict do nothing;
    return query select 'late'::text, null::text, false, null::text, 0::smallint, null::int, null::int, 0;
    return;
  end if;

  select * into v_match from match_answer(p_prompt_id, p_input) limit 1;

  select count(*) into v_wrong from attempts at
  where at.player_id = p_player_id and at.puzzle_date = p_date and at.prompt_id = p_prompt_id;

  -- a wrong guess with time and guesses left: log it and let them try again
  if not coalesce(v_match.is_correct, false) and not p_final and v_wrong + 1 < max_wrong_guesses() then
    if btrim(coalesce(p_input, '')) <> '' then
      insert into attempts (player_id, puzzle_date, prompt_id, raw_input, matched_entity_id)
      values (p_player_id, p_date, p_prompt_id, left(p_input, 80), v_match.entity_id);
      v_wrong := v_wrong + 1;
    end if;
    return query select 'retry'::text, v_match.canonical_name, false, null::text, 0::smallint, null::int, null::int,
                        max_wrong_guesses() - v_wrong;
    return;
  end if;

  if v_match.is_correct then
    select a.tier, a.points into v_tier, v_points from answers a where a.id = v_match.answer_id;
  end if;

  insert into submissions (player_id, puzzle_date, pack_id, prompt_id, raw_input, answer_id, matched_entity_id, status, points)
  values (p_player_id, p_date, v_pack, p_prompt_id, left(coalesce(p_input, ''), 80),
          case when v_match.is_correct then v_match.answer_id end, v_match.entity_id, 'answered', coalesce(v_points, 0))
  on conflict (player_id, puzzle_date, prompt_id) do nothing
  returning id into v_sub_id;

  if v_sub_id is null then  -- lost a race with a double submit
    return query select * from submit_answer(p_player_id, p_date, p_prompt_id, p_input, p_final);
    return;
  end if;

  return query
    select 'answered'::text, v_match.canonical_name, coalesce(v_match.is_correct, false), v_tier,
           coalesce(v_points, 0)::smallint, st.n_answer, st.n_correct, 0
    from (select 1) x
    left join lateral answer_stats(p_prompt_id, p_date, v_match.answer_id) st on v_match.is_correct;
end;
$$;

-- Review now includes wrong guesses, which is where most missing spellings show up.
create or replace view answer_review with (security_invoker = true) as
with wrong as (
  select s.raw_input, s.matched_entity_id, s.prompt_id, s.puzzle_date
  from submissions s
  where s.answer_id is null and s.status = 'answered' and btrim(s.raw_input) <> ''
  union all
  select at.raw_input, at.matched_entity_id, at.prompt_id, at.puzzle_date
  from attempts at
)
select
  case when w.matched_entity_id is null then 'not recognised' else 'real but wrong' end as kind,
  coalesce(e.canonical_name, normalize_answer(w.raw_input)) as answer,
  pr.text as question,
  count(*) as times,
  max(w.puzzle_date) as last_seen
from wrong w
join prompts pr on pr.id = w.prompt_id
left join entities e on e.id = w.matched_entity_id
group by 1, 2, 3
order by times desc, last_seen desc;

grant select on answer_review to service_role;
grant execute on function max_wrong_guesses() to service_role;
grant execute on function player_day(uuid, text, date) to service_role;
grant execute on function submit_answer(uuid, date, bigint, text, boolean) to service_role;
