-- New Supabase projects (since May 2026) no longer auto-grant tables in `public`
-- to the API roles. Grant only what the server needs.
-- The browser (anon / authenticated) gets nothing yet: all game data goes
-- through server code using the secret key, which maps to `service_role`.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function normalize_answer(text) to service_role;

-- Future tables created by `postgres` get the same server-only access.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
