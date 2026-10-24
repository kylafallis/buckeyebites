-- Support scripts/sync-sheet.ts: the same Food ID is served at several
-- meals, days and stations, so it is unique per (item, station, day, meal).
alter table menu_items
  add column if not exists sat_fat_g numeric,
  add column if not exists cholesterol_mg numeric;

alter table menu_items drop constraint if exists menu_items_nutrislice_id_key;
alter table menu_items
  add constraint menu_items_item_station_day_meal_key
  unique (nutrislice_id, station_id, served_on, meal_period);

-- Lets the sync upsert stations by name.
alter table stations
  add constraint stations_location_name_key unique (location_id, name);
