import { createClient } from "@/lib/supabase/server"

export const SCOTT_SLUG = "scott"

export const MEAL_PERIODS = ["breakfast", "lunch", "dinner"] as const
export type MealPeriod = (typeof MEAL_PERIODS)[number]

export type MenuItem = {
  id: number
  name: string
  meal_period: MealPeriod
  served_on: string
  serving_size: string | null
  image_url: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  sugar_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  iron_mg: number | null
  calcium_mg: number | null
  vit_d_mcg: number | null
  allergens: string[]
  diet_tags: string[]
  food_group: string | null
  station: { id: number; name: string; floor: number | null } | null
}

const COLUMNS = `
  id, name, meal_period, served_on, serving_size, image_url,
  calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg,
  iron_mg, calcium_mg, vit_d_mcg, allergens, diet_tags, food_group,
  station:stations(id, name, floor),
  locations!inner(slug, is_live)
`

function fitsDiet(tags: string[], diet: string) {
  switch (diet) {
    case "vegan":
      return tags.includes("vegan")
    case "vegetarian":
      return tags.includes("vegetarian") || tags.includes("vegan")
    case "pescatarian":
      return ["pescatarian", "vegetarian", "vegan"].some((t) => tags.includes(t))
    case "halal_friendly":
      return !tags.includes("contains_pork")
    default:
      return true
  }
}

/**
 * Scott menu items for one meal that are safe for this user: no overlap with
 * their allergens and a fit for their diet. When the user has any allergy,
 * items with no allergen or diet info are dropped too, since that usually
 * means the data is missing rather than the item being allergen-free.
 *
 * Every page and route that lists menu items must go through this function.
 * Throws if the user's allergens can't be read, so callers fail closed.
 */
export async function getSafeItems(
  userId: string,
  mealPeriod: MealPeriod,
  date: string
): Promise<MenuItem[]> {
  const supabase = await createClient()

  const [items, profile, allergens] = await Promise.all([
    supabase
      .from("menu_items")
      .select(COLUMNS)
      .eq("locations.slug", SCOTT_SLUG)
      .eq("locations.is_live", true)
      .eq("meal_period", mealPeriod)
      .eq("served_on", date)
      .order("name"),
    supabase.from("profiles").select("diet").eq("id", userId).maybeSingle(),
    supabase.from("user_allergens").select("allergen").eq("user_id", userId),
  ])
  if (items.error) throw items.error
  if (profile.error) throw profile.error
  if (allergens.error) throw allergens.error

  const diet = profile.data?.diet ?? "none"
  const userAllergens = new Set(allergens.data.map((a) => a.allergen))

  return (items.data as unknown as (MenuItem & { locations?: unknown })[])
    .map((row) => {
      const item = { ...row, allergens: row.allergens ?? [], diet_tags: row.diet_tags ?? [] }
      delete item.locations // only needed for the join filter
      return item as MenuItem
    })
    .filter((item) => {
      if (item.allergens.some((a) => userAllergens.has(a))) return false
      if (userAllergens.size > 0 && item.allergens.length === 0 && item.diet_tags.length === 0) {
        return false
      }
      return fitsDiet(item.diet_tags, diet)
    })
}

// Scott's hours are in Columbus time regardless of where the server runs.
function columbusParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: +get("hour"), minute: +get("minute") }
}

export function todayInColumbus(now = new Date()) {
  return columbusParts(now).date
}

export function currentMealPeriod(now = new Date()): MealPeriod {
  const { hour, minute } = columbusParts(now)
  const minutes = hour * 60 + minute
  if (minutes < 10 * 60 + 30) return "breakfast"
  if (minutes < 16 * 60) return "lunch"
  return "dinner"
}
