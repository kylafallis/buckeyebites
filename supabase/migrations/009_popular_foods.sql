-- Popular foods for the menu's Popular tab (counts only, never who did what).
-- Likes come from swipes, times eaten from logged meals, across every student
-- (the demo's simulated students included). Foods are keyed like foodKey in
-- lib/menu-shared.ts, so the same food on different days counts together.
create or replace view insight_popular_foods as
with liked as (
  select lower(regexp_replace(trim(m.name), '\s+', ' ', 'g')) as food, count(*) as likes
  from food_swipes s join menu_items m on m.id = s.menu_item_id
  where s.liked
  group by 1
), eaten as (
  select lower(regexp_replace(trim(m.name), '\s+', ' ', 'g')) as food, count(*) as times_eaten
  from meal_logs l
  join recipe_items ri on ri.recipe_id = l.recipe_id
  join menu_items m on m.id = ri.menu_item_id
  group by 1
)
select coalesce(liked.food, eaten.food) as food,
  coalesce(liked.likes, 0) as likes,
  coalesce(eaten.times_eaten, 0) as times_eaten
from liked full join eaten on eaten.food = liked.food;

grant select on insight_popular_foods to authenticated;
