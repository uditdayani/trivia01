-- M1/M2: aliases move from "per answer" to "per entity" (a country, a player),
-- so one spelling list serves every prompt and wrong-but-real answers are recognised.
-- Also adds the answer-matching function and the daily prompt picker.

-- 1. Entities: anything that can be an answer, shared across a pack's prompts
create table entities (
  id              bigint generated always as identity primary key,
  pack_id         smallint not null references packs(id),
  slug            text not null,
  canonical_name  text not null,
  popularity      real not null default 1 check (popularity > 0),  -- fame prior for cold start
  unique (pack_id, slug)
);

create table entity_aliases (
  entity_id         bigint not null references entities(id) on delete cascade,
  alias_normalized  text not null,
  primary key (entity_id, alias_normalized)
);
create index entity_aliases_alias_idx on entity_aliases (alias_normalized);
create index entity_aliases_trgm_idx on entity_aliases using gin (alias_normalized gin_trgm_ops);

-- 2. Replace the M0 test data and per-answer aliases
delete from answers;
delete from prompts;
drop table aliases;

alter table answers
  drop constraint answers_prompt_id_canonical_name_key,
  drop column canonical_name,
  add column entity_id bigint not null references entities(id),
  add constraint answers_prompt_entity_key unique (prompt_id, entity_id);

alter table prompts
  add column slug  text unique,
  add column theme text;

-- the entity the player's input matched, even when it isn't a correct answer
alter table submissions add column matched_entity_id bigint references entities(id);

alter table entities       enable row level security;
alter table entity_aliases enable row level security;

grant select, insert, update, delete on entities, entity_aliases to service_role;

-- 3. Match a player's input to an entity and say whether it answers the prompt.
--    Exact alias first; then fuzzy (trigram) match, accepted only when the best
--    candidate is clearly ahead of the runner-up (stops "Niger" -> "Nigeria").
create or replace function match_answer(p_prompt_id bigint, p_input text)
returns table (
  entity_id       bigint,
  canonical_name  text,
  is_correct      boolean,
  answer_id       bigint,
  match_kind      text,
  score           real
)
language plpgsql stable
set search_path = public, extensions
as $$
declare
  v_pack smallint;
  v_norm text;
begin
  select pack_id into v_pack from prompts where id = p_prompt_id;
  if v_pack is null then
    raise exception 'unknown prompt %', p_prompt_id;
  end if;

  v_norm := normalize_answer(coalesce(p_input, ''));
  if v_norm = '' then
    return;
  end if;

  -- exact: if an alias is shared (rare), prefer the entity that is a correct answer
  return query
    select e.id, e.canonical_name, a.id is not null, a.id, 'exact'::text, 1::real
    from entity_aliases ea
    join entities e on e.id = ea.entity_id
    left join answers a on a.entity_id = e.id and a.prompt_id = p_prompt_id
    where e.pack_id = v_pack and ea.alias_normalized = v_norm
    order by (a.id is not null) desc, e.popularity desc
    limit 1;
  if found then
    return;
  end if;

  -- very short input: exact only
  if length(v_norm) < 4 then
    return;
  end if;

  return query
    with scored as (
      select ea.entity_id as eid, max(similarity(ea.alias_normalized, v_norm)) as s
      from entity_aliases ea
      join entities e on e.id = ea.entity_id
      where e.pack_id = v_pack and ea.alias_normalized % v_norm
      group by ea.entity_id
    ), ranked as (
      select eid, s,
             lead(s) over (order by s desc) as next_s,
             row_number() over (order by s desc) as rn
      from scored
    )
    select e.id, e.canonical_name, a.id is not null, a.id, 'fuzzy'::text, r.s
    from ranked r
    join entities e on e.id = r.eid
    left join answers a on a.entity_id = e.id and a.prompt_id = p_prompt_id
    where r.rn = 1 and r.s >= 0.5 and (r.next_s is null or r.s - r.next_s >= 0.1);
end;
$$;

-- 4. Today's 7 prompts for a pack: one per theme, the same for every player on a date.
--    (M4 will freeze these into daily_puzzles; until then they're computed.)
create or replace function todays_prompts(p_pack_slug text, p_date date)
returns table (id bigint, text text, time_limit_s smallint, theme text, difficulty smallint)
language sql stable
set search_path = public
as $$
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
$$;

grant execute on function match_answer(bigint, text) to service_role;
grant execute on function todays_prompts(text, date) to service_role;
