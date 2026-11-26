-- Name-matching checks for the Cricket pack. Run after loading supabase/data/cricket.sql.
-- Each row: question slug, what the player typed, expected player (null = no match), expected correct?
do $$
declare
  t record;
  r record;
  n int := 0;
begin
  for t in
    select * from (values
      -- Cricsheet spelling and common forms
      ('runs-4000',        'V Kohli',                 'V Kohli',        true),
      ('runs-4000',        'Virat Kohli',             'V Kohli',        true),
      ('runs-4000',        'kohli',                   'V Kohli',        true),
      ('runs-4000',        'King Kohli',              'V Kohli',        true),
      ('runs-4000',        'Rohit Sharma',            'RG Sharma',      true),
      ('runs-4000',        'Hitman',                  'RG Sharma',      true),
      ('runs-4000',        'Mahendra Singh Dhoni',    'MS Dhoni',       true),
      ('runs-4000',        'MS Dhoni',                'MS Dhoni',       true),
      ('runs-4000',        'Mahi',                    'MS Dhoni',       true),
      ('runs-4000',        'dhoni',                   'MS Dhoni',       true),
      ('runs-4000',        'AB de Villiers',          'AB de Villiers', true),
      ('runs-4000',        'de villiers',             'AB de Villiers', true),
      ('runs-4000',        'ABD',                     'AB de Villiers', true),
      ('runs-4000',        'Abraham Benjamin de Villiers', 'AB de Villiers', true),
      ('runs-4000',        'Chris Gayle',             'CH Gayle',       true),
      ('runs-4000',        'Universe Boss',           'CH Gayle',       true),
      ('runs-4000',        'David Warner',            'DA Warner',      true),
      ('runs-4000',        'Shikhar Dhawan',          'S Dhawan',       true),
      ('runs-4000',        'Gabbar',                  'S Dhawan',       true),
      ('wickets-100',      'Bhuvneshwar Kumar',       'B Kumar',        true),
      ('wickets-100',      'Bhuvi',                   'B Kumar',        true),
      ('wickets-100',      'Jasprit Bumrah',          'JJ Bumrah',      true),
      ('wickets-100',      'bumrah',                  'JJ Bumrah',      true),
      ('wickets-100',      'Yuzvendra Chahal',        'YS Chahal',      true),
      ('wickets-100',      'Lasith Malinga',          'SL Malinga',     true),
      ('wickets-100',      'Sunil Narine',            'SP Narine',      true),
      ('wickets-100',      'Ravindra Jadeja',         'RA Jadeja',      true),
      ('hat-trick',        'Amit Mishra',             'A Mishra',       true),
      ('hat-trick',        'Yuvraj Singh',            'Yuvraj Singh',   true),
      ('hat-trick',        'Yuvraj',                  'Yuvraj Singh',   true),
      ('hat-trick',        'Pravin Tambe',            'PV Tambe',       true),
      ('hat-trick',        'Rashid Khan',             'Rashid Khan',    true),
      ('first-ball-wicket','Adam Gilchrist',          'AC Gilchrist',   true),
      ('first-ball-wicket','Kevin Pietersen',         'KP Pietersen',   true),
      -- typos
      ('runs-4000',        'Virat Kholi',             'V Kohli',        true),
      ('runs-4000',        'Rohit Shrma',             'RG Sharma',      true),
      ('wickets-100',      'Jasprit Bumra',           'JJ Bumrah',      true),
      ('runs-4000',        'David Warnr',             'DA Warner',      true),
      -- real player, wrong for the question
      ('hat-trick',        'Virat Kohli',             'V Kohli',        false),
      ('wickets-100',      'MS Dhoni',                'MS Dhoni',       false),
      ('ipl-century',      'Jasprit Bumrah',          'JJ Bumrah',      false),
      -- a surname alone counts only when one player clearly owns it
      ('hat-trick',        'Rohit Sharma',            'RG Sharma',      true),
      ('hat-trick',        'Sharma',                  null,             false),  -- Sandeep Sharma has 142 matches: ambiguous
      ('runs-4000',        'Gayle',                   'CH Gayle',       true),
      ('hat-trick',        'Singh',                   null,             false),
      ('wickets-100',      'Khan',                    null,             false),
      -- not players
      ('runs-4000',        'Sachin Kohli',            null,             false),
      ('runs-4000',        'asdfgh',                  null,             false),
      ('runs-4000',        'Don Bradman',             null,             false)
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
    r := null;
    n := n + 1;
  end loop;
  raise notice 'all % cricket name cases passed', n;
end $$;
