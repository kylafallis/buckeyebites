 scripts/checks.sql
-- Data checks for menu_items. Run in Supabase SQL Editor after every sync.
-- Column names: served_on, meal_period, name, station_id, calories, allergens, diet_tags

-- CHECK 1a: rows per day and meal period (every day should have breakfast, lunch, dinner)
select served_on, meal_period, count(*) as items
from menu_items
group by served_on, meal_period
order by served_on, meal_period;

-- CHECK 1b: days missing a meal (should return nothing)
select served_on, count(distinct meal_period) as meals
from menu_items
group by served_on
having count(distinct meal_period) < 3;

-- CHECK 2: foods with blank nutrition
-- Leave them in the menu; the plate builder should skip them.
select distinct s.name as station, m.name as food
from menu_items m
join stations s on s.id = m.station_id
where m.calories is null
order by 1, 2;

-- CHECK 3: foods with no allergen tags AND no diet tags
-- Hidden from anyone who has an allergy, because we can't tell if the info is missing.
select distinct s.name as station, m.name as food
from menu_items m
join stations s on s.id = m.station_id
where coalesce(cardinality(m.allergens), 0) = 0
  and coalesce(cardinality(m.diet_tags), 0) = 0
order by 1, 2;

-- CHECK 4a: name suggests milk, but no milk tag
-- Known false alarms: oat milk ice creams, plant-based cream cheeses, butternut squash.
select distinct name, allergens from menu_items
where name ~* '(cheese|cream|butter|milk|alfredo)'
  and not (coalesce(allergens, '{}') && array['milk'])
order by name;

-- CHECK 4b: name suggests egg, but no egg tag
select distinct name, allergens from menu_items
where name ~* '(egg|mayo)'
  and not (coalesce(allergens, '{}') && array['egg'])
order by name;

-- CHECK 4c: name suggests fish, but no fish tag
select distinct name, allergens from menu_items
where name ~* '(fish|shrimp|tuna)'
  and not (coalesce(allergens, '{}') && array['fish'])
order by name;

-- CHECK 4d: name suggests sesame, but no sesame tag
select distinct name, allergens from menu_items
where name ~* '(seeded|sesame)'
  and not (coalesce(allergens, '{}') && array['sesame'])
order by name;

-- CHECK 5: summary numbers for the team chat
select count(distinct name) as foods_loaded,
       count(distinct station_id) as stations
from menu_items;