-- Points are fixed before anyone plays (like Krillion): each answer's tier comes
-- from the pipeline (familiarity in written English), never from live player counts.
-- How many players gave an answer is still shown, but only as information.

alter table answers
  add column tier   text,
  add column points smallint check (points between 0 and 100);

-- Old live-share scoring goes; return types change, so drop and recreate.
drop function if exists submit_answer(uuid, date, bigint, text);
drop function if exists player_day(uuid, text, date);
drop function if exists answer_share(bigint, date, bigint);

-- How many players gave this answer, and how many answered correctly, on a day.
create or replace function answer_stats(p_prompt_id bigint, p_date date, p_answer_id bigint)
returns table (n_answer int, n_correct int)
language sql stable
set search_path = public
as $$
  select (count(*) filter (where answer_id = p_answer_id))::int,
         (count(*) filter (where answer_id is not null))::int
  from submissions
  where prompt_id = p_prompt_id and puzzle_date = p_date;
$$;

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
    a.tier,
    coalesce(s.points, 0)::smallint,
    st.n_answer,
    st.n_correct
  from todays_prompts(p_pack_slug, p_date) with ordinality as t(id, text, time_limit_s, theme, difficulty, ord)
  left join prompt_views v on v.player_id = p_player_id and v.puzzle_date = p_date and v.prompt_id = t.id
  left join submissions s  on s.player_id = p_player_id and s.puzzle_date = p_date and s.prompt_id = t.id
  left join answers a      on a.id = s.answer_id
  left join entities e     on e.id = s.matched_entity_id
  left join lateral answer_stats(t.id, p_date, s.answer_id) st on s.answer_id is not null
  order by t.ord;
$$;

create or replace function submit_answer(p_player_id uuid, p_date date, p_prompt_id bigint, p_input text)
returns table (
  status          text,      -- answered | late | duplicate
  canonical_name  text,
  is_correct      boolean,
  tier            text,
  points          smallint,
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
  v_tier     text;
  v_points   smallint := 0;
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
      select 'duplicate'::text, e.canonical_name, v_existing.answer_id is not null, a.tier, v_existing.points,
             st.n_answer, st.n_correct
      from (select 1) x
      left join entities e on e.id = v_existing.matched_entity_id
      left join answers a on a.id = v_existing.answer_id
      left join lateral answer_stats(p_prompt_id, p_date, v_existing.answer_id) st on v_existing.answer_id is not null;
    return;
  end if;

  if now() > v_started + make_interval(secs => v_limit) + answer_grace() then
    insert into submissions (player_id, puzzle_date, pack_id, prompt_id, raw_input, status, points)
    values (p_player_id, p_date, v_pack, p_prompt_id, left(coalesce(p_input, ''), 80), 'late', 0);
    return query select 'late'::text, null::text, false, null::text, 0::smallint, null::int, null::int;
    return;
  end if;

  select * into v_match from match_answer(p_prompt_id, p_input) limit 1;
  if v_match.is_correct then
    select a.tier, a.points into v_tier, v_points from answers a where a.id = v_match.answer_id;
  end if;

  insert into submissions (player_id, puzzle_date, pack_id, prompt_id, raw_input, answer_id, matched_entity_id, status, points)
  values (p_player_id, p_date, v_pack, p_prompt_id, left(coalesce(p_input, ''), 80),
          case when v_match.is_correct then v_match.answer_id end, v_match.entity_id, 'answered', coalesce(v_points, 0))
  on conflict (player_id, puzzle_date, prompt_id) do nothing
  returning id into v_sub_id;

  if v_sub_id is null then  -- lost a race with a double submit
    return query select * from submit_answer(p_player_id, p_date, p_prompt_id, p_input);
    return;
  end if;

  return query
    select 'answered'::text, v_match.canonical_name, coalesce(v_match.is_correct, false), v_tier, coalesce(v_points, 0)::smallint,
           st.n_answer, st.n_correct
    from (select 1) x
    left join lateral answer_stats(p_prompt_id, p_date, v_match.answer_id) st on v_match.is_correct;
end;
$$;

grant execute on function answer_stats(bigint, date, bigint) to service_role;
grant execute on function player_day(uuid, text, date) to service_role;
grant execute on function submit_answer(uuid, date, bigint, text) to service_role;
