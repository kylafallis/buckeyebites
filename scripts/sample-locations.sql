-- Sample foods for the coming-soon locations (Kennedy, Morrill, Union Market).
-- Run in the Supabase SQL Editor. Safe to run again: it updates in place.
--
-- The menu page's location toggle shows these as "Sample items" with the same
-- allergen and diet filter as Scott. Feed me, swipes, Insights and the recipe
-- dupe only ever read Scott, so these never mix into Scott's menu.
-- Nutrition and allergens are typical estimates, not a real menu.

-- Each location: reuse an existing row whose name matches, otherwise create it.
do $$
declare
  loc record;
begin
  for loc in
    select * from (values
      ('Kennedy Commons', 'kennedy', '%kennedy%'),
      ('Morrill Tower', 'morrill', '%morrill%'),
      ('Union Market', 'union-market', '%union%')
    ) as t(name, slug, pattern)
  loop
    if not exists (select 1 from locations where name ilike loc.pattern or slug = loc.slug) then
      insert into locations (name, slug, is_live) values (loc.name, loc.slug, false);
    end if;
  end loop;
end $$;

-- The foods, by location name pattern.
drop table if exists sample_foods;
create temporary table sample_foods (
  pattern text, station text, n int, name text, serving text,
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  sugar_g numeric, fiber_g numeric, sodium_mg numeric,
  allergens text[], diet_tags text[], food_group text
);

insert into sample_foods values
  -- Kennedy Commons
  ('%kennedy%', 'Grill', 1, 'Grilled Chicken Sandwich', '1 sandwich', 430, 34, 42, 13, 6, 2, 890, '{wheat}', '{}', 'protein'),
  ('%kennedy%', 'Grill', 2, 'Black Bean Burger', '1 burger', 390, 16, 58, 11, 7, 10, 720, '{wheat,soy}', '{vegetarian,vegan}', 'protein'),
  ('%kennedy%', 'Grill', 3, 'Cheese Quesadilla', '1 quesadilla', 480, 20, 40, 26, 2, 2, 860, '{milk,wheat}', '{vegetarian}', 'other'),
  ('%kennedy%', 'Deli', 4, 'Turkey Club Wrap', '1 wrap', 520, 30, 44, 24, 3, 3, 1240, '{milk,wheat,egg}', '{}', 'protein'),
  ('%kennedy%', 'Deli', 5, 'Garden Side Salad', '1 bowl', 60, 2, 11, 1, 5, 3, 40, '{}', '{vegetarian,vegan,gluten_free}', 'vegetable'),
  ('%kennedy%', 'Deli', 6, 'Fresh Fruit Cup', '1 cup', 80, 1, 20, 0, 16, 2, 10, '{}', '{vegetarian,vegan,gluten_free}', 'fruit'),
  -- Morrill Tower
  ('%morrill%', 'Wok', 1, 'Teriyaki Chicken Rice Bowl', '1 bowl', 560, 32, 78, 12, 18, 3, 1180, '{soy,wheat}', '{}', 'protein'),
  ('%morrill%', 'Wok', 2, 'Vegetable Fried Rice', '1 cup', 340, 9, 56, 9, 4, 3, 760, '{soy,egg,wheat}', '{vegetarian}', 'grain'),
  ('%morrill%', 'Wok', 3, 'Vegetable Spring Roll', '2 rolls', 220, 4, 30, 10, 3, 2, 420, '{wheat,soy}', '{vegetarian,vegan}', 'other'),
  ('%morrill%', 'Home', 4, 'Roasted Turkey Breast', '4 oz', 170, 32, 0, 4, 0, 0, 480, '{}', '{gluten_free}', 'protein'),
  ('%morrill%', 'Home', 5, 'Baked Mac and Cheese', '1 cup', 420, 17, 44, 20, 6, 2, 780, '{milk,wheat}', '{vegetarian}', 'grain'),
  ('%morrill%', 'Home', 6, 'Steamed Broccoli', '1 cup', 55, 4, 11, 1, 2, 5, 60, '{}', '{vegetarian,vegan,gluten_free}', 'vegetable'),
  -- Union Market
  ('%union%', 'Market Grab and Go', 1, 'Chicken Caesar Salad', '1 salad', 410, 32, 14, 26, 3, 3, 940, '{milk,egg,fish,wheat}', '{}', 'protein'),
  ('%union%', 'Market Grab and Go', 2, 'Hummus and Veggie Cup', '1 cup', 190, 7, 20, 10, 4, 6, 380, '{sesame}', '{vegetarian,vegan,gluten_free}', 'vegetable'),
  ('%union%', 'Market Grab and Go', 3, 'Greek Yogurt Parfait', '1 cup', 280, 15, 40, 7, 24, 3, 110, '{milk,wheat}', '{vegetarian}', 'dairy'),
  ('%union%', 'Market Grab and Go', 4, 'Banana', '1 banana', 105, 1, 27, 0, 14, 3, 1, '{}', '{vegetarian,vegan,gluten_free}', 'fruit'),
  ('%union%', 'Market Kitchen', 5, 'Margherita Flatbread', '1 flatbread', 560, 24, 62, 22, 5, 3, 1060, '{milk,wheat}', '{vegetarian}', 'grain'),
  ('%union%', 'Market Kitchen', 6, 'Chicken Burrito Bowl', '1 bowl', 610, 38, 66, 20, 4, 11, 1150, '{milk}', '{gluten_free}', 'protein');

-- Stations.
insert into stations (location_id, name)
select distinct l.id, f.station
from sample_foods f
join locations l on l.name ilike f.pattern and not coalesce(l.is_live, false)
on conflict (location_id, name) do nothing;

-- Foods: one row per food (the sample list ignores date and meal).
insert into menu_items (
  nutrislice_id, location_id, station_id, name, meal_period, served_on, serving_size,
  calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, allergens, diet_tags, food_group
)
select
  'sample-' || l.slug || '-' || f.n, l.id, s.id, f.name, 'lunch', date '2026-10-24', f.serving,
  f.calories, f.protein_g, f.carbs_g, f.fat_g, f.sugar_g, f.fiber_g, f.sodium_mg, f.allergens, f.diet_tags, f.food_group
from sample_foods f
join locations l on l.name ilike f.pattern and not coalesce(l.is_live, false)
join stations s on s.location_id = l.id and s.name = f.station
on conflict (nutrislice_id, station_id, served_on, meal_period) do update set
  name = excluded.name, serving_size = excluded.serving_size,
  calories = excluded.calories, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g, sugar_g = excluded.sugar_g, fiber_g = excluded.fiber_g,
  sodium_mg = excluded.sodium_mg, allergens = excluded.allergens,
  diet_tags = excluded.diet_tags, food_group = excluded.food_group;

drop table sample_foods;

-- Check: each coming-soon location should show 6 foods.
select l.name, l.slug, count(m.id) as sample_foods
from locations l
left join menu_items m on m.location_id = l.id
where not coalesce(l.is_live, false)
group by l.name, l.slug
order by l.name;
