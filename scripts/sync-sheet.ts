// Syncs Scott's menu for Sat Oct 24 – Sat Oct 31, 2026 from the menu Google Sheet.
//
//   npx tsx scripts/sync-sheet.ts            download, parse and upsert
//   npx tsx scripts/sync-sheet.ts --dry-run  download and parse only, no writes
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and MENU_SHEET_ID in
// .env.local, migration 003 applied, and the sheet shared as "Anyone with the link".

import { createHash } from "node:crypto"
import Papa from "papaparse"
import { createClient } from "@supabase/supabase-js"

process.loadEnvFile(".env.local")

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH_SIZE = 200
const TABS = [
  "Sat Oct 24",
  "Sun Oct 25",
  "Mon Oct 26",
  "Tue Oct 27",
  "Wed Oct 28",
  "Thu Oct 29",
  "Fri Oct 30",
  "Sat Oct 31",
]

const MEALS: Record<string, "breakfast" | "lunch" | "dinner"> = { B: "breakfast", L: "lunch", D: "dinner" }

const NUMBER_COLUMNS = [
  ["Calories", "calories"],
  ["Fat (g)", "fat_g"],
  ["Sat fat (g)", "sat_fat_g"],
  ["Cholesterol (mg)", "cholesterol_mg"],
  ["Sodium (mg)", "sodium_mg"],
  ["Carbs (g)", "carbs_g"],
  ["Fiber (g)", "fiber_g"],
  ["Sugar (g)", "sugar_g"],
  ["Protein (g)", "protein_g"],
] as const
type NumberField = (typeof NUMBER_COLUMNS)[number][1]

const ALLERGEN_TAGS: Record<string, string> = {
  Dairy: "milk",
  Eggs: "egg",
  Fish: "fish",
  Soy: "soy",
  Wheat: "wheat",
  Sesame: "sesame",
  Coconut: "tree_nut",
  // Not in the original mapping, but an unmapped allergen tag would show the
  // item to users who are allergic to it.
  Peanut: "peanut",
  Peanuts: "peanut",
  "Tree nut": "tree_nut",
  "Tree nuts": "tree_nut",
  Shellfish: "shellfish",
}
const DIET_TAGS: Record<string, string[]> = {
  Vg: ["vegetarian"],
  V: ["vegan", "vegetarian"],
  "No gluten": ["gluten_free"],
  Halal: ["halal"],
}

// Whole words, optionally plural, so "rice" doesn't match "ricotta".
const words = (list: string[]) => new RegExp(`\\b(${list.join("|")})(s|es)?\\b`, "i")
const DAIRY_WORDS = words(["yogurt", "milk", "cheese"])
const FRUIT_WORDS = words([
  "fruit", "apple", "banana", "orange", "berry", "berries", "strawberry", "strawberries", "blueberry",
  "blueberries", "raspberry", "raspberries", "blackberry", "blackberries", "cranberry", "cranberries",
  "grape", "melon", "watermelon", "cantaloupe", "honeydew", "pineapple", "mango", "peach", "pear",
  "kiwi", "cherry", "cherries", "plum", "clementine", "citrus", "raisin",
])
const GRAIN_WORDS = words([
  "bread", "flatbread", "cornbread", "breadstick", "bun", "bagel", "tortilla", "rice", "pasta",
  "penne", "potato", "waffle", "oatmeal", "granola", "cereal",
])
const VEG_WORDS = words([
  "vegetable", "veggie", "salad", "greens", "broccoli", "carrot", "spinach", "lettuce", "kale",
  "tomato", "tomatoes", "cucumber", "pepper", "onion", "mushroom", "zucchini", "squash", "corn",
  "peas", "green bean", "cauliflower", "cabbage", "celery", "asparagus", "beet", "edamame",
  "brussels sprout", "eggplant", "okra",
])

type Row = Record<string, string | undefined>

type MenuRow = {
  nutrislice_id: string
  location_id: number
  station_id: number
  name: string
  meal_period: "breakfast" | "lunch" | "dinner"
  served_on: string
  serving_size: string | null
  allergens: string[]
  diet_tags: string[]
  food_group: string
  image_url?: string | null
} & Record<NumberField, number | null>

function fail(message: string): never {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

function env(name: string) {
  return process.env[name]?.trim() || fail(`Missing ${name} in .env.local`)
}

/** "Sat Oct 24" -> "2026-10-24" */
function tabToDate(tab: string) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const match = /^\w{3}\s+(\w{3})\s+(\d{1,2})$/.exec(tab.trim())
  const month = match ? months.indexOf(match[1]) + 1 : 0
  if (!match || month === 0) fail(`Can't read a date from tab name "${tab}"`)
  return `2026-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`
}

/** Blank or unreadable cells become null, never 0. */
function toNumber(value: string | undefined): number | null {
  const text = (value ?? "").trim().replace(/,/g, "")
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function foodGroup(name: string, station: string, n: Record<NumberField, number | null>) {
  const st = station.toLowerCase()
  const isFruit = FRUIT_WORDS.test(name)
  const isGrain = GRAIN_WORDS.test(name) || st === "cereals"
  const isVeg = VEG_WORDS.test(name) || st === "salad bar" || st === "grains and greens"
  const isProtein = (n.protein_g ?? 0) >= 12

  if (st === "condiments") return "condiment"
  if (st === "desserts" || (n.sugar_g ?? 0) >= 15) return "treat"
  const isDairy = DAIRY_WORDS.test(name)
  if (isDairy && !isFruit && !isGrain && !isVeg && !isProtein) return "dairy"
  // Yogurt Bar toppings that aren't yogurt or granola are fruit.
  if (isFruit || (st === "yogurt bar" && !isGrain && !isDairy)) return "fruit"
  if (isProtein) return "protein"
  if (isGrain) return "grain"
  if (isVeg) return "veg"
  return "other"
}

async function downloadTab(sheetId: string, tab: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  const res = await fetch(url)
  if (!res.ok) fail(`Downloading "${tab}" failed: HTTP ${res.status}`)
  if (res.headers.get("content-type")?.includes("text/html")) {
    fail(`Google returned a web page for "${tab}". Share the sheet as "Anyone with the link can view".`)
  }
  return res.text()
}

async function main() {
  const sheetId = env("MENU_SHEET_ID")
  const supabase = DRY_RUN
    ? null
    : createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false },
      })

  let locationId = 0
  if (supabase) {
    const { data, error } = await supabase.from("locations").select("id").eq("slug", "scott").maybeSingle()
    if (error) fail(`Looking up Scott failed: ${error.message}`)
    if (!data) fail("No location with slug 'scott'. Create it first.")
    locationId = data.id
  }

  // 1. Download and parse every tab.
  const seenCsv = new Map<string, string>()
  const days: { tab: string; date: string; rows: Row[]; hasImages: boolean }[] = []
  for (const tab of TABS) {
    const csv = await downloadTab(sheetId, tab)
    // gviz silently returns the first tab when a name doesn't match.
    const hash = createHash("sha256").update(csv).digest("hex")
    if (seenCsv.has(hash)) {
      console.warn(`⚠ "${tab}" is identical to "${seenCsv.get(hash)}". The tab is probably missing, so it's skipped.`)
      continue
    }
    seenCsv.set(hash, tab)

    const parsed = Papa.parse<Row>(csv, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() })
    if (parsed.errors.length > 0) {
      console.warn(`⚠ "${tab}": ${parsed.errors.length} CSV parse issue(s), first: ${parsed.errors[0].message}`)
    }
    days.push({
      tab,
      date: tabToDate(tab),
      rows: parsed.data,
      hasImages: parsed.meta.fields?.includes("Image URL") ?? false,
    })
  }

  // 2. Upsert stations and keep their ids.
  const stationNames = [
    ...new Set(days.flatMap((d) => d.rows.map((r) => r.Station?.trim()).filter((s): s is string => !!s))),
  ]
  const stationIds = new Map<string, number>()
  if (supabase) {
    const { data, error } = await supabase
      .from("stations")
      .upsert(stationNames.map((name) => ({ location_id: locationId, name })), { onConflict: "location_id,name" })
      .select("id, name")
    if (error) fail(`Upserting stations failed: ${error.message}. Is migration 003 applied?`)
    for (const s of data) stationIds.set(s.name, s.id)
  } else {
    stationNames.forEach((name, i) => stationIds.set(name, -(i + 1)))
  }

  // 3. Build menu_items rows.
  const unknownTags = new Map<string, number>()
  const unknownMeals = new Map<string, number>()
  const skipped: string[] = []
  const incomplete = new Map<string, string>()
  const counts: Record<string, Record<string, number>> = {}
  const groupCounts = new Map<string, number>()
  let duplicates = 0

  for (const day of days) {
    const byKey = new Map<string, MenuRow>()

    day.rows.forEach((row, i) => {
      const foodId = row["Food ID"]?.trim()
      const name = row.Item?.trim()
      const station = row.Station?.trim()
      if (!foodId || !name || !station) {
        skipped.push(`${day.tab} row ${i + 2}: missing ${!foodId ? "Food ID" : !name ? "Item" : "Station"}`)
        return
      }

      const numbers = Object.fromEntries(
        NUMBER_COLUMNS.map(([column, field]) => [field, toNumber(row[column])])
      ) as Record<NumberField, number | null>

      const tags = (row.Tags ?? "").split("/").map((t) => t.trim()).filter(Boolean)
      const allergens = new Set<string>()
      const dietTags = new Set<string>()
      for (const tag of tags) {
        if (ALLERGEN_TAGS[tag]) allergens.add(ALLERGEN_TAGS[tag])
        else if (DIET_TAGS[tag]) DIET_TAGS[tag].forEach((t) => dietTags.add(t))
        else unknownTags.set(tag, (unknownTags.get(tag) ?? 0) + 1)
      }

      const noNutrition = Object.values(numbers).every((v) => v === null)
      if (noNutrition || tags.length === 0) {
        const problems = [noNutrition && "blank nutrition", tags.length === 0 && "no tags"].filter(Boolean).join(", ")
        incomplete.set(`${day.date}|${station}|${foodId}`, `${day.date}  ${station} · ${name} (Food ID ${foodId}): ${problems}`)
      }

      const letters = (row.Meals ?? "").toUpperCase().replace(/[^A-Z]/g, "").split("")
      if (letters.length === 0) skipped.push(`${day.tab} row ${i + 2}: ${name} has no Meals`)

      for (const letter of letters) {
        const meal = MEALS[letter]
        if (!meal) {
          unknownMeals.set(letter, (unknownMeals.get(letter) ?? 0) + 1)
          continue
        }
        const key = `${foodId}|${station}|${day.date}|${meal}`
        if (byKey.has(key)) {
          duplicates++
          continue
        }
        byKey.set(key, {
          nutrislice_id: foodId,
          location_id: locationId,
          station_id: stationIds.get(station)!,
          name,
          meal_period: meal,
          served_on: day.date,
          serving_size: row.Serving?.trim() || null,
          ...numbers,
          allergens: [...allergens].sort(),
          diet_tags: [...dietTags].sort(),
          food_group: foodGroup(name, station, numbers),
          ...(day.hasImages ? { image_url: row["Image URL"]?.trim() || null } : {}),
        })
      }
    })

    // 4. Upsert in batches (per day, so every row in a batch has the same columns).
    const rows = [...byKey.values()]
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      if (supabase) {
        const { error } = await supabase
          .from("menu_items")
          .upsert(batch, { onConflict: "nutrislice_id,station_id,served_on,meal_period" })
        if (error) fail(`Upserting ${day.tab} failed: ${error.message}. Is migration 003 applied?`)
      }
      for (const r of batch) {
        counts[day.date] ??= { breakfast: 0, lunch: 0, dinner: 0 }
        counts[day.date][r.meal_period]++
        groupCounts.set(r.food_group, (groupCounts.get(r.food_group) ?? 0) + 1)
      }
    }
  }

  // 5. Report.
  console.log(DRY_RUN ? "\nDry run: nothing was written. Rows that would be saved:" : "\nRows saved:")
  console.table(
    Object.entries(counts).map(([date, c]) => ({ date, ...c, total: c.breakfast + c.lunch + c.dinner }))
  )
  console.log(`${stationNames.length} stations: ${stationNames.join(", ")}`)
  console.log(`Food groups: ${[...groupCounts].map(([g, n]) => `${g} ${n}`).join(", ")}`)
  if (duplicates > 0) console.log(`Removed ${duplicates} duplicate rows (same Food ID, station, date and meal).`)

  if (incomplete.size > 0) {
    console.log(`\nRows with blank nutrition or no tags (${incomplete.size}):`)
    for (const line of [...incomplete.values()].sort()) console.log(`  ${line}`)
  } else {
    console.log("\nEvery row has nutrition and tags.")
  }
  if (unknownTags.size > 0) {
    console.log(`\nIgnored unrecognized tags: ${[...unknownTags].map(([t, n]) => `"${t}" ×${n}`).join(", ")}`)
  }
  if (unknownMeals.size > 0) {
    console.log(`Ignored unrecognized meal letters: ${[...unknownMeals].map(([m, n]) => `"${m}" ×${n}`).join(", ")}`)
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped rows (${skipped.length}):`)
    for (const line of skipped) console.log(`  ${line}`)
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
