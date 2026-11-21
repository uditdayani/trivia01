-- M4: a fixed daily schedule, a once-a-day rollover job, light analytics,
-- and review views for spotting missing spellings.

-- 1. Schedule puzzles ahead. Days on or before today keep exactly the questions
--    players were already given (computed by the old picker); future days pick the
--    least recently used questions, at most 2 per theme, in a shuffled order.
create or replace function schedule_puzzles(p_pack_slug text, p_from date, p_days int)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_pack   smallint;
  v_day    date;
  v_picked bigint[];
  v_count  int := 0;
  r        record;
begin
  select id into v_pack from packs where slug = p_pack_slug and is_active;
  if v_pack is null then
    return 0;
  end if;

  for i in 0 .. p_days - 1 loop
    v_day := p_from + i;
    continue when exists (select 1 from daily_puzzles where puzzle_date = v_day and pack_id = v_pack);

    if v_day <= current_date then
      -- freeze what the old picker served that day
      select array_agg(c.id order by c.ord) into v_picked
      from (
        select p.id, row_number() over (order by md5('order:' || v_day::text || ':' || p.id)) as ord
        from (
          select p.id, p.theme,
                 row_number() over (partition by p.theme order by md5(v_day::text || ':' || p.id)) as rn
          from prompts p where p.pack_id = v_pack
        ) p
        where p.rn = 1
        order by md5('order:' || v_day::text || ':' || p.id)
        limit 7
      ) c;
    else
      v_picked := '{}';
      for r in
        select p.id, p.theme
        from prompts p
        left join lateral (
          select max(dp.puzzle_date) as last_used
          from daily_puzzles dp
          where dp.pack_id = v_pack and p.id = any (dp.prompt_ids)
        ) u on true
        where p.pack_id = v_pack
        order by u.last_used nulls first, md5(v_day::text || ':' || p.id)
      loop
        exit when cardinality(v_picked) = 7;
        if (select count(*) from prompts q where q.id = any (v_picked) and q.theme = r.theme) < 2 then
          v_picked := v_picked || r.id;
        end if;
      end loop;
      -- shuffle so themes don't arrive in last-used order
      select array_agg(x order by md5('order:' || v_day::text || ':' || x)) into v_picked from unnest(v_picked) x;
    end if;

    if cardinality(v_picked) = 7 then
      insert into daily_puzzles (puzzle_date, pack_id, prompt_ids, status)
      values (v_day, v_pack, v_picked, case when v_day < current_date then 'final' when v_day = current_date then 'live' else 'scheduled' end);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Throw away future days nobody has played yet (after adding or editing questions), then refill.
create or replace function reschedule_future(p_pack_slug text, p_days int default 30)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_pack smallint;
begin
  select id into v_pack from packs where slug = p_pack_slug;
  delete from daily_puzzles dp
  where dp.pack_id = v_pack and dp.puzzle_date > current_date
    and not exists (select 1 from prompt_views pv where pv.puzzle_date = dp.puzzle_date
                    and pv.prompt_id = any (dp.prompt_ids));
  return schedule_puzzles(p_pack_slug, current_date + 1, p_days);
end;
$$;

-- 2. Today's questions come from the schedule; the old picker is only a fallback.
create or replace function todays_prompts(p_pack_slug text, p_date date)
returns table (id bigint, text text, time_limit_s smallint, theme text, difficulty smallint)
language plpgsql stable
set search_path = public
as $$
begin
  return query
    select p.id, p.text, p.time_limit_s, p.theme, p.difficulty
    from daily_puzzles dp
    join packs k on k.id = dp.pack_id
    cross join lateral unnest(dp.prompt_ids) with ordinality as u(pid, ord)
    join prompts p on p.id = u.pid
    where k.slug = p_pack_slug and k.is_active and dp.puzzle_date = p_date
    order by u.ord;
  if found then
    return;
  end if;

  return query
    with candidates as (
      select p.id, p.text, p.time_limit_s, p.theme, p.difficulty,
             row_number() over (partition by p.theme order by md5(p_date::text || ':' || p.id)) as rn
      from prompts p
      join packs k on k.id = p.pack_id
      where k.slug = p_pack_slug and k.is_active
    )
    select c.id, c.text, c.time_limit_s, c.theme, c.difficulty
    from candidates c
    where c.rn = 1
    order by md5('order:' || p_date::text || ':' || c.id)
    limit 7;
end;
$$;

-- 3. The daily job: keep 30 days scheduled for every active pack and set statuses.
create or replace function rollover(p_days int default 30)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_result jsonb := '{}';
  k record;
begin
  for k in select slug from packs where is_active loop
    v_result := v_result || jsonb_build_object(k.slug, schedule_puzzles(k.slug, current_date, p_days));
  end loop;
  update daily_puzzles set status = 'final' where puzzle_date < current_date and status <> 'final';
  update daily_puzzles set status = 'live'  where puzzle_date = current_date and status = 'scheduled';
  return jsonb_build_object(
    'date', current_date,
    'scheduled_days_added', v_result,
    'last_scheduled', (select max(puzzle_date) from daily_puzzles)
  );
end;
$$;

-- Cricket has no questions yet: keep it out of scheduling until it does.
update packs set is_active = false where slug = 'cricket' and not exists (
  select 1 from prompts p where p.pack_id = packs.id
);

-- 4. Analytics: a handful of named events, nothing personal.
create table events (
  id          bigint generated always as identity primary key,
  name        text not null check (name in ('puzzle_view', 'game_start', 'game_finish', 'result_copy')),
  player_id   uuid references players(id) on delete set null,
  pack_id     smallint references packs(id),
  puzzle_date date,
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on events (puzzle_date, name);
alter table events enable row level security;
grant select, insert on events to service_role;

-- Per day and pack: how many started, finished, shared, and the average score.
create view daily_stats with (security_invoker = true) as
with played as (
  select puzzle_date, pack_id, player_id,
         count(*) as answers,
         sum(points) as score
  from submissions
  group by puzzle_date, pack_id, player_id
)
select
  p.puzzle_date,
  k.slug as pack,
  count(*)                                         as players,
  count(*) filter (where p.answers = 7)            as finished,
  round(avg(p.score) filter (where p.answers = 7)) as avg_score,
  (select count(distinct e.player_id) from events e
    where e.name = 'result_copy' and e.puzzle_date = p.puzzle_date and e.pack_id = p.pack_id) as shared,
  (select count(*) from played nxt
    where nxt.pack_id = p.pack_id and nxt.puzzle_date = p.puzzle_date + 1
      and nxt.player_id in (select player_id from played x where x.puzzle_date = p.puzzle_date and x.pack_id = p.pack_id)) as returned_next_day
from played p
join packs k on k.id = p.pack_id
group by p.puzzle_date, p.pack_id, k.slug
order by p.puzzle_date desc;

-- 5. Review: inputs we didn't recognise (missing spellings?) and real countries
--    players thought were right (possible data mistakes). Check weekly.
create view answer_review with (security_invoker = true) as
select
  case when s.matched_entity_id is null then 'not recognised' else 'real but wrong' end as kind,
  coalesce(e.canonical_name, normalize_answer(s.raw_input)) as answer,
  pr.text as question,
  count(*) as times,
  max(s.puzzle_date) as last_seen
from submissions s
join prompts pr on pr.id = s.prompt_id
left join entities e on e.id = s.matched_entity_id
where s.answer_id is null and s.status = 'answered' and btrim(s.raw_input) <> ''
group by 1, 2, 3
order by times desc, last_seen desc;

grant select on daily_stats, answer_review to service_role;
grant execute on function schedule_puzzles(text, date, int) to service_role;
grant execute on function reschedule_future(text, int) to service_role;
grant execute on function rollover(int) to service_role;

-- Schedule now, so the next 30 days exist even before the first daily job runs.
select rollover();
