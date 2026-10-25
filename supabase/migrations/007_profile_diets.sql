-- Multiple diets per user. profiles.diet stays for older code; the app reads
-- diets first and falls back to diet when diets is empty.
alter table public.profiles
  add column if not exists diets text[] not null default '{}';

-- Copy the old single diet across ('none' means no restrictions).
update public.profiles
set diets = array[diet]
where diet is not null
  and diet <> 'none'
  and diets = '{}';
