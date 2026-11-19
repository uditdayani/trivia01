-- Minimal seed so the M0 test page has something to read.
insert into packs (slug, name) values
  ('geography', 'Geography'),
  ('cricket', 'Cricket');

with p as (
  insert into prompts (pack_id, text, difficulty)
  select id, 'Name a landlocked country', 2 from packs where slug = 'geography'
  returning id
), a as (
  insert into answers (prompt_id, canonical_name, seed_weight)
  select p.id, v.name, v.w
  from p, (values
    ('Switzerland', 30), ('Austria', 25), ('Nepal', 20), ('Bolivia', 15),
    ('Paraguay', 10), ('Mongolia', 12), ('Kazakhstan', 10), ('Afghanistan', 10),
    ('Hungary', 8), ('Czechia', 8), ('Ethiopia', 6), ('Uganda', 5),
    ('Bhutan', 4), ('Lesotho', 2), ('Eswatini', 2), ('Liechtenstein', 2)
  ) as v(name, w)
  returning id, canonical_name
)
insert into aliases (answer_id, alias_normalized)
select id, normalize_answer(canonical_name) from a
union all
select id, 'czech republic' from a where canonical_name = 'Czechia'
union all
select id, 'swaziland' from a where canonical_name = 'Eswatini';
