-- Allergen audit. Run in the Supabase SQL Editor.
--
-- Query 1 must return 0 rows. Any row means a logged or planned plate holds a
-- food the user marked as an allergy: post it to Kyla right away.
-- Query 2 is the one-line summary for the pitch.

-- 1. Every logged or planned plate that holds one of the user's allergens.
select 'logged' as kind, ml.id, ml.user_id, ml.eaten_on as day, ml.meal_period, r.title as plate, m.name as food, ua.allergen
from meal_logs ml
join recipes r on r.id = ml.recipe_id
join recipe_items ri on ri.recipe_id = ml.recipe_id
join menu_items m on m.id = ri.menu_item_id
join user_allergens ua on ua.user_id = ml.user_id
where ua.allergen = any(m.allergens)
union all
select 'planned', mp.id, mp.user_id, mp.plan_date, mp.meal_period, r.title, m.name, ua.allergen
from meal_plans mp
join recipes r on r.id = mp.recipe_id
join recipe_items ri on ri.recipe_id = mp.recipe_id
join menu_items m on m.id = ri.menu_item_id
join user_allergens ua on ua.user_id = mp.user_id
where ua.allergen = any(m.allergens)
order by kind, day;

-- 2. Summary: how many plates were checked, for how many people with
-- allergies, and how many allergen errors were found.
with plates as (
  select user_id, recipe_id from meal_logs where recipe_id is not null
  union all
  select user_id, recipe_id from meal_plans where recipe_id is not null
),
allergic as (
  select distinct user_id from user_allergens
),
errors as (
  select p.user_id, p.recipe_id
  from plates p
  join recipe_items ri on ri.recipe_id = p.recipe_id
  join menu_items m on m.id = ri.menu_item_id
  join user_allergens ua on ua.user_id = p.user_id
  where ua.allergen = any(m.allergens)
)
select
  (select count(*) from plates) as plates_checked,
  (select count(*) from plates where user_id in (select user_id from allergic)) as plates_for_people_with_allergies,
  (select count(*) from allergic) as people_with_allergies,
  (select count(*) from errors) as allergen_errors;
