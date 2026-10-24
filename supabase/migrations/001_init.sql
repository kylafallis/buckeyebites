-- Public menu data
create table locations (
  id serial primary key, name text not null, slug text unique,
  is_live boolean default false
);
create table stations (
  id serial primary key, location_id int references locations,
  name text not null, floor int
);
create table menu_items (
  id bigserial primary key, nutrislice_id text unique,
  location_id int references locations, station_id int references stations,
  name text not null, meal_period text check (meal_period in ('breakfast','lunch','dinner')),
  served_on date, serving_size text, image_url text,
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  sugar_g numeric, fiber_g numeric, sodium_mg numeric,
  iron_mg numeric, calcium_mg numeric, vit_d_mcg numeric,
  allergens text[] default '{}',
  diet_tags text[] default '{}',
  food_group text
);
create table recipes (
  id bigserial primary key, title text, blurb text,
  source text check (source in ('curated','ai','dupe')),
  location_id int references locations, steps text[], tags text[],
  totals jsonb, created_by uuid references auth.users, created_at timestamptz default now()
);
create table recipe_items (
  recipe_id bigint references recipes on delete cascade,
  menu_item_id bigint references menu_items, servings numeric default 1,
  primary key (recipe_id, menu_item_id)
);
create table traffic_estimates (
  location_id int references locations, dow int, hour int, busy_pct int,
  primary key (location_id, dow, hour)
);

-- Per-user data
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, diet text default 'none',
  mode text default 'balanced',
  focus_nutrients text[] default '{}',
  goals jsonb default '{}',
  meals_per_day int default 3, snacks_per_day int default 1, desserts_per_day int default 0,
  onboarded boolean default false
);
create table user_allergens (user_id uuid references auth.users on delete cascade, allergen text, primary key (user_id, allergen));
create table food_swipes (user_id uuid references auth.users on delete cascade, menu_item_id bigint references menu_items, liked boolean, primary key (user_id, menu_item_id));
create table meal_logs (
  id bigserial primary key, user_id uuid references auth.users on delete cascade,
  eaten_on date default current_date, meal_period text,
  recipe_id bigint references recipes, totals jsonb, created_at timestamptz default now()
);
create table meal_plans (
  id bigserial primary key, user_id uuid references auth.users on delete cascade,
  plan_date date, meal_period text, recipe_id bigint references recipes
);

-- Row level security
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
alter table menu_items enable row level security;
create policy "public read" on menu_items for select using (true);

alter table user_allergens enable row level security;
create policy "own rows" on user_allergens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table food_swipes enable row level security;
create policy "own rows" on food_swipes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table meal_logs enable row level security;
create policy "own rows" on meal_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table meal_plans enable row level security;
create policy "own rows" on meal_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table locations enable row level security;
create policy "public read" on locations for select using (true);
alter table stations enable row level security;
create policy "public read" on stations for select using (true);
alter table recipes enable row level security;
create policy "public read" on recipes for select using (true);
alter table recipe_items enable row level security;
create policy "public read" on recipe_items for select using (true);
alter table traffic_estimates enable row level security;
create policy "public read" on traffic_estimates for select using (true);

-- Auto-create a profile on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
