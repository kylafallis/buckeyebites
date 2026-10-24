// TEMPORARY: fake Scott menu for today until Hanna's real data is loaded.
// Delete this file (and the "seed:scott" scripts in package.json) afterwards.
//
//   npm run seed:scott          insert/refresh 10 fake items for today
//   npm run seed:scott:remove   delete them again
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from "@supabase/supabase-js"

const SEED_PREFIX = "seed-scott-"
const STATIONS = ["Grill", "Global Bowls", "Bakery & Breakfast"]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

function check({ data, error }, what) {
  if (error) {
    console.error(`Failed to ${what}:`, error.message)
    process.exit(1)
  }
  return data
}

async function removeSeed() {
  const deleted = check(
    await supabase.from("menu_items").delete().like("nutrislice_id", `${SEED_PREFIX}%`).select("id"),
    "delete seed items"
  )
  console.log(`Deleted ${deleted.length} seed items.`)
}

if (process.argv.includes("--remove")) {
  await removeSeed()
  process.exit(0)
}

const [location] = check(
  await supabase
    .from("locations")
    .upsert({ slug: "scott", name: "Traditions at Scott", is_live: true }, { onConflict: "slug" })
    .select("id"),
  "upsert Scott location"
)

const stationIds = {}
for (const [i, name] of STATIONS.entries()) {
  const existing = check(
    await supabase.from("stations").select("id").eq("location_id", location.id).eq("name", name).maybeSingle(),
    `look up station ${name}`
  )
  stationIds[name] =
    existing?.id ??
    check(
      await supabase.from("stations").insert({ location_id: location.id, name, floor: i === 2 ? 1 : 2 }).select("id").single(),
      `create station ${name}`
    ).id
}

// [name, station, meal, serving, cal, protein, carbs, fat, sugar, fiber, sodium, iron, calcium, vitD, allergens, diet_tags]
const ITEMS = [
  ["Buttermilk Pancakes", "Bakery & Breakfast", "breakfast", "2 pancakes", 340, 8, 52, 11, 12, 1, 620, 2.1, 180, 0.4, ["milk", "egg", "wheat"], ["vegetarian"]],
  ["Scrambled Eggs", "Bakery & Breakfast", "breakfast", "1/2 cup", 180, 12, 2, 14, 1, 0, 290, 1.4, 60, 1.6, ["egg", "milk"], ["vegetarian"]],
  ["Pork Sausage Links", "Grill", "breakfast", "3 links", 260, 11, 1, 23, 0, 0, 540, 0.8, 10, 0.2, [], ["contains_pork"]],
  ["Overnight Oats with Berries", "Bakery & Breakfast", "breakfast", "1 cup", 290, 9, 48, 7, 14, 7, 90, 2.6, 120, 0, ["tree_nut"], ["vegan"]],
  ["Classic Cheeseburger", "Grill", "lunch", "1 burger", 610, 32, 41, 34, 8, 2, 980, 4.2, 210, 0.3, ["milk", "wheat", "sesame"], []],
  ["Black Bean Burger", "Grill", "lunch", "1 burger", 420, 17, 58, 13, 6, 11, 760, 3.8, 90, 0, ["wheat", "soy"], ["vegan"]],
  ["Teriyaki Chicken Bowl", "Global Bowls", "lunch", "1 bowl", 540, 34, 68, 12, 18, 3, 1180, 2.4, 50, 0.1, ["soy", "wheat"], ["halal"]],
  ["Garden Side Salad", "Global Bowls", "lunch", "1 salad", 90, 3, 12, 4, 5, 4, 140, 1.1, 60, 0, [], []],
  ["Shrimp Pad Thai", "Global Bowls", "dinner", "1 bowl", 580, 26, 72, 20, 16, 4, 1420, 3.1, 110, 0.2, ["shellfish", "peanut", "egg", "soy"], ["pescatarian"]],
  ["Chickpea Tikka Masala", "Global Bowls", "dinner", "1 cup", 380, 13, 49, 15, 9, 10, 820, 4.6, 140, 0, ["milk"], ["vegetarian"]],
]

await removeSeed()
check(
  await supabase.from("menu_items").insert(
    ITEMS.map(([name, station, meal, serving, calories, protein, carbs, fat, sugar, fiber, sodium, iron, calcium, vitD, allergens, diet_tags], i) => ({
      nutrislice_id: `${SEED_PREFIX}${i + 1}`,
      location_id: location.id,
      station_id: stationIds[station],
      name,
      meal_period: meal,
      served_on: today,
      serving_size: serving,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      sugar_g: sugar,
      fiber_g: fiber,
      sodium_mg: sodium,
      iron_mg: iron,
      calcium_mg: calcium,
      vit_d_mcg: vitD,
      allergens,
      diet_tags,
    }))
  ),
  "insert seed items"
)
console.log(`Seeded ${ITEMS.length} Scott items for ${today}.`)
