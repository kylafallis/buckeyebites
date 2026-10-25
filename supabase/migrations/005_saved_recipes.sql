-- Recipes a user has hearted in the recipe book.
create table if not exists public.saved_recipes (
  user_id uuid not null references auth.users on delete cascade,
  recipe_id bigint not null references public.recipes on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.saved_recipes enable row level security;

drop policy if exists "own rows" on public.saved_recipes;
create policy "own rows" on public.saved_recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
