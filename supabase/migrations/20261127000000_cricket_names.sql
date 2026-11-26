-- M5: match people's names the way players type them.
-- Cricsheet stores "V Kohli", "MS Dhoni", "AB de Villiers". Players type
-- "Virat Kohli", "Mahendra Singh Dhoni", "de villiers", or make typos.

create extension if not exists fuzzystrmatch;  -- levenshtein(): counts typing mistakes

alter table entities
  add column initials text,   -- 'v', 'ms', 'ab' (people only)
  add column surname  text;   -- 'kohli', 'dhoni', 'de villiers'
create index entities_surname_idx on entities (pack_id, surname);
create index entities_surname_trgm_idx on entities using gin (surname gin_trgm_ops);

-- Order of tries:
--   1. exact spelling (any accepted alias)
--   2. people: first names -> initials + surname ("virat kohli" -> v + kohli,
--      "rohit sharma" -> r* + sharma, so RG Sharma counts)
--   3. people: same, allowing a typo in the surname ("virat kholi": up to 1 edit
--      for 4-letter surnames, 2 for longer ones)
--   4. people: surname alone ("kohli"), accepted when one player with that surname
--      is clearly the best known (at least twice the IPL matches of the next)
--   5. fuzzy match on all aliases, accepted only with a clear winner
-- Wherever two people fit, the one who answers the question wins, then the better known.
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
  v_pack   smallint;
  v_norm   text;
  v_people boolean;
begin
  select pack_id into v_pack from prompts where id = p_prompt_id;
  if v_pack is null then
    raise exception 'unknown prompt %', p_prompt_id;
  end if;

  v_norm := normalize_answer(coalesce(p_input, ''));
  if v_norm = '' then
    return;
  end if;

  -- 1. exact
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

  select exists (select 1 from entities where pack_id = v_pack and surname is not null) into v_people;

  if v_people and position(' ' in v_norm) > 0 then
    -- 2 and 3: split "first [middle] surname" every possible way
    return query
      with toks as (
        select string_to_array(v_norm, ' ') as t
      ), splits as (
        select (select string_agg(left(x, 1), '') from unnest(t[1:k]) as x) as ini,
               array_to_string(t[k + 1:], ' ') as sur
        from toks, generate_series(1, cardinality(t) - 1) as k
      ), cands as (
        select e.id, e.canonical_name, a.id as aid, e.popularity,
               levenshtein(e.surname, s.sur) as dist, length(s.sur) as len
        from splits s
        join entities e on e.pack_id = v_pack and e.initials like s.ini || '%'
         and (e.surname = s.sur
              or (length(s.sur) >= 4
                  and levenshtein(e.surname, s.sur) <= case when length(s.sur) >= 5 then 2 else 1 end))
        left join answers a on a.entity_id = e.id and a.prompt_id = p_prompt_id
      )
      select c.id, c.canonical_name, c.aid is not null, c.aid,
             case when c.dist = 0 then 'name' else 'name-typo' end,
             (1 - c.dist::real / greatest(c.len, 1))::real
      from cands c
      order by c.dist, (c.aid is not null) desc, c.popularity desc
      limit 1;
    if found then
      return;
    end if;
  end if;

  -- 4. surname alone
  if v_people and position(' ' in v_norm) = 0 then
    return query
      with c as (
        select e.id, e.canonical_name, e.popularity, a.id as aid,
               row_number() over (order by e.popularity desc) as rn,
               lead(e.popularity) over (order by e.popularity desc) as next_pop
        from entities e
        left join answers a on a.entity_id = e.id and a.prompt_id = p_prompt_id
        where e.pack_id = v_pack and e.surname = v_norm
      )
      select c.id, c.canonical_name, c.aid is not null, c.aid, 'surname'::text, 1::real
      from c
      where c.rn = 1 and (c.next_pop is null or c.popularity >= 2 * c.next_pop);
    if found then
      return;
    end if;
  end if;

  -- very short input: exact only
  if length(v_norm) < 4 then
    return;
  end if;

  -- 5. fuzzy
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

grant execute on function match_answer(bigint, text) to service_role;
