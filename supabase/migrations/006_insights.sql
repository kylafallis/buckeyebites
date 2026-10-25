-- Insights views for /insights (counts only, never who did what).
-- Drops older versions first (an earlier draft had station columns and a
-- station-demand view), since a view can't lose columns in place.
drop view if exists insight_station_demand;
drop view if exists insight_planned_tomorrow;
drop view if exists insight_top_liked;

create or replace view insight_top_liked as
select m.name,
  count(*) filter (where s.liked) as likes,
  count(*) filter (where not s.liked) as dislikes,
  round(100.0 * count(*) filter (where s.liked) / count(*)) as like_rate
from food_swipes s join menu_items m on m.id = s.menu_item_id
group by m.name order by likes desc;

create or replace view insight_planned_tomorrow as
select m.name, mp.meal_period, sum(ri.servings) as planned_servings
from meal_plans mp
join recipe_items ri on ri.recipe_id = mp.recipe_id
join menu_items m on m.id = ri.menu_item_id
where mp.plan_date = (now() at time zone 'America/New_York')::date + 1
group by m.name, mp.meal_period order by planned_servings desc;

grant select on insight_top_liked, insight_planned_tomorrow to authenticated;
