-- Marks the demo's simulated students (scripts/demo.ts), so they can be told
-- apart from real sign-ups and labeled as simulated.
alter table public.profiles
  add column if not exists is_simulated boolean not null default false;
