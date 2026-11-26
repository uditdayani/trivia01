-- After a player finishes, show an example answer from each tier, so they can
-- see what would have scored more. The app only calls this once all 7 are done.
create or replace function tier_examples(p_prompt_id bigint, p_per_tier int default 1)
returns table (tier text, points smallint, canonical_name text)
language sql stable
set search_path = public
as $$
  select r.tier, r.points, r.canonical_name
  from (
    select a.tier, a.points, e.canonical_name,
           row_number() over (partition by a.tier order by a.seed_weight desc, e.canonical_name) as rn
    from answers a
    join entities e on e.id = a.entity_id
    where a.prompt_id = p_prompt_id and a.tier is not null
  ) r
  where r.rn <= p_per_tier
  order by r.points desc, r.canonical_name;
$$;

grant execute on function tier_examples(bigint, int) to service_role;
