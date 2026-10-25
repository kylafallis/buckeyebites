-- Adds the Salad Bar, Grains and Greens and Mongolian Grill foods to Scott,
-- for lunch and dinner, Oct 24-31. Safe to run twice (duplicates are skipped).
--
-- Nutrition and allergens for these foods are TYPICAL ESTIMATES (general
-- averages for a common serving), not Scott's official data, so each serving
-- size ends in "(estimated)". A food that's already on Scott's menu under the
-- same name keeps its real nutrition and tags instead.

with scott as (
  select id from locations where slug = 'scott'
),
st as (
  insert into stations (location_id, name)
  select scott.id, s from scott, unnest(array['Salad Bar', 'Grains and Greens', 'Mongolian Grill']) as s
  on conflict (location_id, name) do update set name = excluded.name
  returning id, name
),
foods (name, station, food_group, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, allergens, diet_tags) as (values
  -- Salad Bar
  ('Spring Lettuce Mix', 'Salad Bar', 'veg', '1 cup (estimated)', 5, 0.5, 1, 0, 0.5, 0, 10, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Spinach', 'Salad Bar', 'veg', '1 cup (estimated)', 7, 1, 1, 0, 0.7, 0, 24, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Chopped Romaine Lettuce', 'Salad Bar', 'veg', '1 cup (estimated)', 8, 0.6, 1.5, 0, 1, 0.6, 4, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Grape Tomato', 'Salad Bar', 'veg', '1 oz (estimated)', 5, 0.3, 1, 0, 0.3, 0.7, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Sliced Cucumber', 'Salad Bar', 'veg', '1 oz (estimated)', 4, 0.2, 1, 0, 0.1, 0.5, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Shredded Carrots', 'Salad Bar', 'veg', '1 oz (estimated)', 11, 0.3, 3, 0, 0.8, 1.3, 20, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Banana Peppers', 'Salad Bar', 'veg', '1 oz (estimated)', 8, 0.3, 1.5, 0, 0.5, 0.5, 400, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Chickpeas', 'Salad Bar', 'veg', '2 oz (estimated)', 90, 5, 15, 1.5, 4, 2, 140, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Ohio Slaw Mix', 'Salad Bar', 'veg', '1 oz (estimated)', 7, 0.4, 1.5, 0, 0.7, 1, 5, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Green Bell Pepper', 'Salad Bar', 'veg', '1 oz (estimated)', 6, 0.2, 1.3, 0, 0.5, 0.7, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Shredded Cheddar Cheese', 'Salad Bar', 'dairy', '1 oz (estimated)', 111, 7, 0.4, 9, 0, 0.1, 180, '{milk}', '{vegetarian,gluten_free}'),
  ('Crumbled Feta', 'Salad Bar', 'dairy', '1 oz (estimated)', 75, 4, 1.2, 6, 0, 1, 320, '{milk}', '{vegetarian,gluten_free}'),
  ('Tofu', 'Salad Bar', 'protein', '3 oz (estimated)', 70, 8, 2, 4, 1, 0, 10, '{soy}', '{vegetarian,vegan,gluten_free}'),
  ('Hard Boiled Eggs', 'Salad Bar', 'protein', '1 egg (estimated)', 78, 6, 0.6, 5, 0, 0.6, 62, '{egg}', '{vegetarian,gluten_free}'),
  ('Halal Pepperoni', 'Salad Bar', 'protein', '1 oz (estimated)', 140, 6, 0, 12, 0, 0, 500, '{}', '{gluten_free,halal}'),
  ('Bacon Crumbles', 'Salad Bar', 'other', '1 oz (estimated)', 142, 8, 0, 12, 0, 0, 550, '{}', '{gluten_free}'),
  ('Halal Sliced Turkey Breast', 'Salad Bar', 'protein', '2 oz (estimated)', 60, 12, 1, 1, 0, 1, 450, '{}', '{gluten_free,halal}'),
  ('Grilled Chicken Breast', 'Salad Bar', 'protein', '4 oz (estimated)', 221, 33, 0, 9, 0, 0, 300, '{}', '{gluten_free}'),
  ('Quinoa', 'Salad Bar', 'grain', '4 oz (estimated)', 135, 5, 24, 2, 3, 1, 8, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Hummus', 'Salad Bar', 'other', '2 oz (estimated)', 100, 4, 8, 6, 3, 0, 240, '{sesame}', '{vegetarian,vegan,gluten_free}'),
  ('Baby Carrots', 'Salad Bar', 'veg', '3 oz (estimated)', 30, 0.5, 7, 0, 2.5, 4, 65, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Naan Dippers', 'Salad Bar', 'grain', '2 oz (estimated)', 160, 5, 27, 4, 1, 2, 280, '{wheat,milk}', '{vegetarian}'),
  ('Cottage Cheese', 'Salad Bar', 'dairy', '4 oz (estimated)', 110, 12, 5, 5, 0, 4, 400, '{milk}', '{vegetarian,gluten_free}'),
  ('Croutons', 'Salad Bar', 'grain', '0.5 oz (estimated)', 65, 2, 9, 2.5, 0.5, 0.5, 140, '{wheat}', '{vegetarian,vegan}'),
  ('Greek Orzo Salad', 'Salad Bar', 'grain', '4 oz (estimated)', 190, 5, 24, 8, 2, 2, 350, '{wheat,milk}', '{vegetarian}'),
  ('Tabouli', 'Salad Bar', 'grain', '4 oz (estimated)', 130, 3, 16, 7, 3, 1, 250, '{wheat}', '{vegetarian,vegan}'),
  ('Caesar Dressing', 'Salad Bar', 'condiment', '1 oz (estimated)', 150, 1, 1, 16, 0, 0.5, 300, '{milk,egg,fish}', '{gluten_free}'),
  ('Ranch Dressing', 'Salad Bar', 'condiment', '1 oz (estimated)', 130, 0.5, 1.5, 13, 0, 1, 260, '{milk,egg}', '{vegetarian,gluten_free}'),
  ('Light Italian Dressing', 'Salad Bar', 'condiment', '1 oz (estimated)', 30, 0, 3, 2, 0, 2, 450, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Honey Mustard', 'Salad Bar', 'condiment', '1 oz (estimated)', 130, 0.5, 8, 11, 0, 7, 230, '{egg}', '{vegetarian,gluten_free}'),
  ('Balsamic Vinaigrette', 'Salad Bar', 'condiment', '1 oz (estimated)', 90, 0, 4, 8, 0, 3, 250, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Extra Virgin Olive Oil', 'Salad Bar', 'condiment', '0.5 oz (estimated)', 120, 0, 0, 14, 0, 0, 0, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Balsamic Vinegar', 'Salad Bar', 'condiment', '0.5 oz (estimated)', 14, 0, 2.7, 0, 0, 2.4, 4, '{}', '{vegetarian,vegan,gluten_free}'),
  -- Grains and Greens
  ('Black Beans', 'Grains and Greens', 'veg', '4 oz (estimated)', 130, 8, 23, 0.5, 8, 0.3, 240, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Brown Rice', 'Grains and Greens', 'grain', '4 oz (estimated)', 125, 3, 26, 1, 2, 0, 5, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Cilantro Lime Cauliflower Rice', 'Grains and Greens', 'veg', '4 oz (estimated)', 45, 2, 6, 2, 2, 2, 180, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Lentils', 'Grains and Greens', 'veg', '4 oz (estimated)', 130, 10, 23, 0.4, 9, 2, 240, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Diced Tomatoes', 'Grains and Greens', 'veg', '1 oz (estimated)', 5, 0.3, 1, 0, 0.3, 0.7, 2, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Yellow Corn', 'Grains and Greens', 'veg', '2 oz (estimated)', 50, 2, 11, 0.7, 1.2, 3, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Diced Yellow Onion', 'Grains and Greens', 'veg', '1 oz (estimated)', 11, 0.3, 2.6, 0, 0.5, 1.2, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Chickpeas', 'Grains and Greens', 'veg', '2 oz (estimated)', 90, 5, 15, 1.5, 4, 2, 140, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Spinach', 'Grains and Greens', 'veg', '1 cup (estimated)', 7, 1, 1, 0, 0.7, 0, 24, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Shredded Carrots', 'Grains and Greens', 'veg', '1 oz (estimated)', 11, 0.3, 3, 0, 0.8, 1.3, 20, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Diced Green Bell Pepper', 'Grains and Greens', 'veg', '1 oz (estimated)', 6, 0.2, 1.3, 0, 0.5, 0.7, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Cooked Mushrooms', 'Grains and Greens', 'veg', '2 oz (estimated)', 16, 1.2, 2.7, 0.2, 1, 1.3, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Crumbled Feta', 'Grains and Greens', 'dairy', '1 oz (estimated)', 75, 4, 1.2, 6, 0, 1, 320, '{milk}', '{vegetarian,gluten_free}'),
  ('Vegan Shredded Mozzarella Cheese', 'Grains and Greens', 'dairy', '1 oz (estimated)', 80, 0, 7, 6, 0, 0, 200, '{tree_nut}', '{vegetarian,vegan,gluten_free}'),
  ('Diced Cucumber', 'Grains and Greens', 'veg', '1 oz (estimated)', 4, 0.2, 1, 0, 0.1, 0.5, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Cilantro', 'Grains and Greens', 'condiment', '0.25 oz (estimated)', 2, 0.2, 0.3, 0, 0.2, 0, 3, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Diced Jalapeno Pepper', 'Grains and Greens', 'condiment', '0.5 oz (estimated)', 4, 0.1, 0.9, 0, 0.4, 0.6, 0, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Green Onion', 'Grains and Greens', 'condiment', '0.5 oz (estimated)', 5, 0.3, 1, 0, 0.4, 0.3, 2, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Tamari Ginger Kale', 'Grains and Greens', 'veg', '2 oz (estimated)', 45, 2, 6, 2, 1.5, 1, 300, '{soy}', '{vegetarian,vegan,gluten_free}'),
  ('Gluten Free Boneless Chicken Wings', 'Grains and Greens', 'protein', '4 oz (estimated)', 260, 20, 14, 14, 1, 1, 700, '{egg}', '{gluten_free}'),
  ('Diced Chicken', 'Grains and Greens', 'protein', '3 oz (estimated)', 140, 26, 0, 3, 0, 0, 250, '{}', '{gluten_free}'),
  ('Fried Gluten Free Breaded Tofu', 'Grains and Greens', 'protein', '3 oz (estimated)', 180, 9, 12, 11, 1, 1, 300, '{soy}', '{vegetarian,vegan,gluten_free}'),
  ('Plant-Based Piri Piri Chicken', 'Grains and Greens', 'protein', '3 oz (estimated)', 170, 15, 9, 8, 3, 2, 500, '{soy}', '{vegetarian,vegan}'),
  ('Nut-Free Basil Pesto', 'Grains and Greens', 'condiment', '0.5 oz (estimated)', 70, 1, 1, 7, 0, 0, 120, '{milk}', '{vegetarian,gluten_free}'),
  ('Gluten Free Tamari Soy Sauce', 'Grains and Greens', 'condiment', '0.5 oz (estimated)', 10, 1.5, 1, 0, 0, 0, 900, '{soy}', '{vegetarian,vegan,gluten_free}'),
  ('Harissa Ranch', 'Grains and Greens', 'condiment', '1 oz (estimated)', 120, 0.5, 2, 12, 0, 1, 280, '{milk,egg}', '{vegetarian,gluten_free}'),
  ('Plant Based Cilantro Lime', 'Grains and Greens', 'condiment', '1 oz (estimated)', 90, 0, 2, 9, 0, 1, 220, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Garlic Aioli', 'Grains and Greens', 'condiment', '1 oz (estimated)', 190, 0, 1, 21, 0, 0, 200, '{egg}', '{vegetarian,gluten_free}'),
  ('Coconut Curry Sauce', 'Grains and Greens', 'condiment', '1 oz (estimated)', 60, 0.5, 3, 5, 0.3, 1.5, 200, '{tree_nut}', '{vegetarian,vegan,gluten_free}'),
  -- Mongolian Grill
  ('Rice Noodles', 'Mongolian Grill', 'grain', '4 oz (estimated)', 120, 1, 27, 0.2, 1, 0, 20, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Jasmine Rice', 'Mongolian Grill', 'grain', '4 oz (estimated)', 198, 4, 44, 0.4, 0.6, 0, 2, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Lo Mein', 'Mongolian Grill', 'grain', '4 oz (estimated)', 160, 5, 30, 2, 1.5, 1, 250, '{wheat,egg,soy}', '{vegetarian}'),
  ('Tofu', 'Mongolian Grill', 'protein', '3 oz (estimated)', 70, 8, 2, 4, 1, 0, 10, '{soy}', '{vegetarian,vegan,gluten_free}'),
  ('Stir Fry Chicken', 'Mongolian Grill', 'protein', '3 oz (estimated)', 150, 24, 2, 5, 0, 1, 350, '{soy,wheat}', '{}'),
  ('Beef', 'Mongolian Grill', 'protein', '3 oz (estimated)', 200, 22, 0, 12, 0, 0, 60, '{}', '{gluten_free}'),
  ('Plant-Based Bulgogi Beef', 'Mongolian Grill', 'protein', '3 oz (estimated)', 180, 14, 10, 9, 3, 4, 450, '{soy,wheat,sesame}', '{vegetarian,vegan}'),
  ('Vegan Chicken', 'Mongolian Grill', 'protein', '3 oz (estimated)', 150, 15, 7, 7, 3, 0, 400, '{soy,wheat}', '{vegetarian,vegan}'),
  ('Baked Salmon', 'Mongolian Grill', 'protein', '4 oz (estimated)', 230, 25, 0, 14, 0, 0, 75, '{fish}', '{gluten_free}'),
  ('Egg', 'Mongolian Grill', 'protein', '1 egg (estimated)', 90, 6, 0.5, 7, 0, 0.2, 95, '{egg}', '{vegetarian,gluten_free}'),
  ('Shredded Kale', 'Mongolian Grill', 'veg', '1 oz (estimated)', 10, 0.8, 1.2, 0.4, 1, 0.3, 15, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Napa Cabbage', 'Mongolian Grill', 'veg', '1 oz (estimated)', 4, 0.3, 0.6, 0, 0.3, 0.4, 3, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Shredded Carrots', 'Mongolian Grill', 'veg', '1 oz (estimated)', 11, 0.3, 3, 0, 0.8, 1.3, 20, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Baby Corn', 'Mongolian Grill', 'veg', '1 oz (estimated)', 8, 0.6, 1.5, 0, 0.6, 0.5, 90, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Snow Peas', 'Mongolian Grill', 'veg', '1 oz (estimated)', 12, 0.8, 2, 0, 0.7, 1, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Broccoli', 'Mongolian Grill', 'veg', '2 oz (estimated)', 20, 1.6, 4, 0.2, 1.5, 1, 20, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Water Chestnuts', 'Mongolian Grill', 'veg', '1 oz (estimated)', 14, 0.3, 3.4, 0, 0.7, 0.7, 2, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Sliced Red Onion', 'Mongolian Grill', 'veg', '0.5 oz (estimated)', 6, 0.2, 1.3, 0, 0.2, 0.6, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Bean Sprouts', 'Mongolian Grill', 'veg', '1 oz (estimated)', 9, 0.9, 1.7, 0, 0.5, 1.2, 2, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Green Bell Pepper', 'Mongolian Grill', 'veg', '1 oz (estimated)', 6, 0.2, 1.3, 0, 0.5, 0.7, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Cooked Mushrooms', 'Mongolian Grill', 'veg', '2 oz (estimated)', 16, 1.2, 2.7, 0.2, 1, 1.3, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Lemongrass', 'Mongolian Grill', 'condiment', '0.25 oz (estimated)', 7, 0.1, 1.8, 0, 0, 0, 0, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Minced Ginger', 'Mongolian Grill', 'condiment', '0.25 oz (estimated)', 6, 0.1, 1.2, 0, 0.1, 0.1, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Minced Garlic', 'Mongolian Grill', 'condiment', '0.25 oz (estimated)', 10, 0.4, 2.3, 0, 0.1, 0.1, 1, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Teriyaki Glaze', 'Mongolian Grill', 'condiment', '1 oz (estimated)', 50, 1, 11, 0, 0, 9, 700, '{soy,wheat}', '{vegetarian,vegan}'),
  ('Soy Sauce', 'Mongolian Grill', 'condiment', '0.5 oz (estimated)', 8, 1.3, 0.8, 0, 0, 0, 880, '{soy,wheat}', '{vegetarian,vegan}'),
  ('Gluten Free Tamari Soy Sauce', 'Mongolian Grill', 'condiment', '0.5 oz (estimated)', 10, 1.5, 1, 0, 0, 0, 900, '{soy}', '{vegetarian,vegan,gluten_free}'),
  ('Korean BBQ Sauce', 'Mongolian Grill', 'condiment', '1 oz (estimated)', 60, 0.5, 13, 0.5, 0, 11, 600, '{soy,wheat,sesame}', '{vegetarian,vegan}'),
  ('General Tso Sauce', 'Mongolian Grill', 'condiment', '1 oz (estimated)', 60, 0.5, 13, 0.5, 0, 10, 450, '{soy,wheat}', '{vegetarian,vegan}'),
  ('Sweet Chili Sauce', 'Mongolian Grill', 'condiment', '1 oz (estimated)', 70, 0, 17, 0, 0, 15, 400, '{}', '{vegetarian,vegan,gluten_free}'),
  ('Orange Sauce', 'Mongolian Grill', 'condiment', '1 oz (estimated)', 65, 0.3, 15, 0.3, 0, 12, 300, '{soy,wheat}', '{vegetarian,vegan}')
)
insert into menu_items (
  nutrislice_id, location_id, station_id, name, meal_period, served_on, serving_size,
  calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, iron_mg, calcium_mg, vit_d_mcg,
  allergens, diet_tags, nutrient_tags, food_group
)
select
  'manual-' || trim(both '-' from lower(regexp_replace(f.name, '[^a-zA-Z0-9]+', '-', 'g'))),
  scott.id, st.id, f.name, m.meal, d.day::date,
  coalesce(src.serving_size, f.serving_size),
  coalesce(src.calories, f.calories), coalesce(src.protein_g, f.protein_g), coalesce(src.carbs_g, f.carbs_g),
  coalesce(src.fat_g, f.fat_g), coalesce(src.fiber_g, f.fiber_g), coalesce(src.sugar_g, f.sugar_g),
  coalesce(src.sodium_mg, f.sodium_mg), src.iron_mg, src.calcium_mg, src.vit_d_mcg,
  coalesce(src.allergens, f.allergens::text[]),
  coalesce(src.diet_tags, f.diet_tags::text[]),
  '{}',
  -- Sauces and toppings stay condiments so they never become a plate's main food.
  case when f.food_group = 'condiment' then 'condiment' else coalesce(src.food_group, f.food_group) end
from foods f
cross join scott
join st on st.name = f.station
cross join (values ('lunch'), ('dinner')) as m (meal)
cross join generate_series('2026-10-24'::date, '2026-10-31'::date, interval '1 day') as d (day)
left join lateral (
  select mi.serving_size, mi.calories, mi.protein_g, mi.carbs_g, mi.fat_g, mi.fiber_g, mi.sugar_g,
         mi.sodium_mg, mi.iron_mg, mi.calcium_mg, mi.vit_d_mcg, mi.allergens, mi.diet_tags, mi.food_group
  from menu_items mi
  where mi.location_id = scott.id
    and lower(mi.name) = lower(f.name)
    and mi.calories is not null
    and mi.nutrislice_id not like 'manual-%'
  order by mi.served_on desc
  limit 1
) src on true
on conflict (nutrislice_id, station_id, served_on, meal_period) do nothing;

-- Check: foods added per station (each food = 2 meals x 8 days = 16 rows).
select s.name as station, count(distinct m.name) as foods, count(*) as rows
from menu_items m join stations s on s.id = m.station_id
where m.nutrislice_id like 'manual-%'
group by s.name order by s.name;
