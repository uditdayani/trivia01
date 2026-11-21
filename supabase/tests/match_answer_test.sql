-- Answer-matching checks for the Geography pack. Run after loading supabase/data/geography.sql.
-- Each row: prompt slug, what the player typed, expected country (null = no match), expected correct?
-- Fails loudly on the first mismatch; prints "all N cases passed" otherwise.
do $$
declare
  t record;
  r record;
  n int := 0;
begin
  for t in
    select * from (values
      -- exact names and common alternatives
      ('landlocked',            'Switzerland',            'Switzerland',     true),
      ('landlocked',            'switzerland ',           'Switzerland',     true),
      ('landlocked',            'Czech Republic',         'Czechia',         true),
      ('landlocked',            'czechia',                'Czechia',         true),
      ('landlocked',            'Swaziland',              'Eswatini',        true),
      ('landlocked',            'Vatican',                'Vatican City',    true),
      ('landlocked',            'Holy See',               'Vatican City',    true),
      ('region-west-africa',    'Ivory Coast',            'Ivory Coast',     true),
      ('region-west-africa',    'Côte d''Ivoire',         'Ivory Coast',     true),
      ('region-west-africa',    'cote divoire',           'Ivory Coast',     true),
      ('borders-china',         'Burma',                  'Myanmar',         true),
      ('borders-china',         'DPRK',                   'North Korea',     true),
      ('region-europe',         'Holland',                'Netherlands',     true),
      ('region-europe',         'UK',                     'United Kingdom',  true),
      ('region-europe',         'Great Britain',          'United Kingdom',  true),
      ('region-europe',         'Deutschland',            'Germany',         true),
      ('language-english',      'USA',                    'United States',   true),
      ('language-english',      'America',                'United States',   true),
      ('language-english',      'the United States',      'United States',   true),
      ('region-asia',           'Turkey',                 'Türkiye',         true),
      ('region-asia',           'Turkiye',                'Türkiye',         true),
      ('region-central-africa', 'DRC',                    'DR Congo',        true),
      ('region-central-africa', 'Democratic Republic of the Congo', 'DR Congo', true),
      ('region-central-africa', 'Republic of the Congo',  'Republic of the Congo', true),
      ('starts-c',              'Cote d''Ivoire',         'Ivory Coast',     true),
      ('starts-t',              'Turkey',                 'Türkiye',         true),
      -- typos
      ('landlocked',            'Switzerlnd',             'Switzerland',     true),
      ('landlocked',            'Afganistan',             'Afghanistan',     true),
      ('landlocked',            'Kazakstan',              'Kazakhstan',      true),
      ('region-south-america',  'Columbia',               'Colombia',        true),
      ('region-south-america',  'Argentinia',             'Argentina',       true),
      ('region-africa',         'Madagaskar',             'Madagascar',      true),
      ('region-southeast-asia', 'Phillipines',            'Philippines',     true),
      -- real country, wrong for the prompt
      ('landlocked',            'Nigeria',                'Nigeria',         false),
      ('landlocked',            'Niger',                  'Niger',           true),
      ('region-europe',         'Japan',                  'Japan',           false),
      ('borders-china',         'Sudan',                  'Sudan',           false),
      ('borders-china',         'South Sudan',            'South Sudan',     false),
      -- must not match anything
      ('landlocked',            '',                       null,              false),
      ('landlocked',            '   ',                    null,              false),
      ('landlocked',            'asdfgh',                 null,              false),
      ('landlocked',            'Atlantis',               null,              false),
      ('landlocked',            'Austriaa',               'Austria',         true),
      ('region-europe',         'Kosovo',                 null,              false),
      -- shared names resolve to whichever country answers the prompt
      ('borders-china',         'Korea',                  'North Korea',     true),
      ('capital-starts-s',      'Korea',                  'South Korea',     true),
      ('capital-starts-b',      'Congo',                  'Republic of the Congo', true),
      ('capital-starts-k',      'Congo',                  'DR Congo',        true),
      ('borders-china',         'Congo',                  'DR Congo',        false)
    ) as v(prompt_slug, input, expected, correct)
  loop
    select m.* into r
    from prompts p, match_answer(p.id, t.input) m
    where p.slug = t.prompt_slug;

    if t.expected is null then
      if r.entity_id is not null then
        raise exception 'FAIL [%] "%": expected no match, got % (%, %)',
          t.prompt_slug, t.input, r.canonical_name, r.match_kind, r.score;
      end if;
    elsif r.entity_id is null or r.canonical_name <> t.expected or r.is_correct <> t.correct then
      raise exception 'FAIL [%] "%": expected % / correct=%, got % / correct=% (%, %)',
        t.prompt_slug, t.input, t.expected, t.correct, r.canonical_name, r.is_correct, r.match_kind, r.score;
    end if;
    n := n + 1;
  end loop;
  raise notice 'all % cases passed', n;
end $$;
