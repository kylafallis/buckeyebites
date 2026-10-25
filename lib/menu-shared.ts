// Menu types, constants and pure helpers. Safe to import from client components;
// anything that queries Supabase lives in lib/menu.server.ts.

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
  nutrient_tags: string[]
  food_group: string | null
  station: { id: number; name: string; floor: number | null } | null
}

/** Food names are the stable key: menu item ids change every day and meal. */
export const foodKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ")

/** Items a plate may use: condiments and items with unknown calories only show on /menu. */
export function isPlateItem(item: Pick<MenuItem, "food_group" | "calories">) {
  return item.food_group !== "condiment" && item.calories != null
}

function fitsOneDiet(tags: string[], diet: string) {
  switch (diet) {
    case "vegan":
      return tags.includes("vegan")
    case "vegetarian":
      return tags.includes("vegetarian")
    case "pescatarian":
      return ["pescatarian", "vegetarian", "vegan"].some((t) => tags.includes(t))
    case "halal_friendly":
      return tags.includes("halal") || tags.includes("vegetarian")
    case "gluten_free":
      return tags.includes("gluten_free")
    default:
      return true
  }
}

/** Whether an item's diet_tags fit every one of the user's diets. */
export function fitsDiet(tags: string[], diets: readonly string[]) {
  return diets.every((d) => fitsOneDiet(tags, d))
}

/**
 * A profile's diets: profiles.diets, or the older single profiles.diet when
 * diets is empty or the column doesn't exist yet (before migration 007).
 */
export function profileDiets(profile: { diet?: string | null; diets?: string[] | null } | null | undefined): string[] {
  const diets = (profile?.diets ?? []).filter((d) => d && d !== "none")
  if (diets.length > 0) return [...new Set(diets)]
  return profile?.diet && profile.diet !== "none" ? [profile.diet] : []
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

// Nutrient tags come from the menu sheet and are estimates, not lab values.
export const NUTRIENT_TAGS = [
  { tag: "high_iron", focus: "iron", label: "Iron" },
  { tag: "vit_d", focus: "vit_d", label: "Vitamin D" },
  { tag: "calcium", focus: "calcium", label: "Calcium" },
] as const

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "Sat, Oct 24" for a YYYY-MM-DD date. */
export function formatDay(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options })
}

// Words that make a menu item a sauce or condiment rather than real food.
export const SAUCE_WORDS = [
  "sauce", "dressing", "ranch", "mayo", "mayonnaise", "mustard", "ketchup", "salsa", "pico de gallo", "gravy",
  "syrup", "aioli", "vinaigrette", "dip", "relish", "sriracha", "hot sauce", "honey", "jam", "jelly", "glaze",
  "sour cream", "butter", "cream cheese",
] as const
// Spreads that contain a sauce word but are real food.
const NOT_SAUCE = /\b(?:peanut|almond|cashew|sunflower|seed) butter\b|\bseed spread\b/gi
// A sauce word as the item's main (last) word, e.g. "Marinara Sauce", "Brown Gravy".
const SAUCE_RE = new RegExp(String.raw`\b(?:${SAUCE_WORDS.map((w) => w.replace(/ /g, String.raw`\s+`)).join("|")})\s*$`, "i")

/**
 * True for condiments and sauces: food_group "condiment", or a name whose main
 * word is a sauce word (whole words, case-insensitive). Anything after "with"
 * is ignored, so dishes that come with a sauce stay real food. Quick checks:
 *   "Marinara Sauce" true, "Chipotle Ranch" true, "Light Mayonnaise" true,
 *   "Salted Butter" true, "Grilled Chicken Breast" false, "Grilled Cheese" false,
 *   "Shredded Parmesan Cheese" false, "Gluten Free Sunflower Seed Spread" false,
 *   "Butter Chicken" false, "Country Fried Steak with Gravy" false.
 */
export function isSauce(item: { name: string; food_group: string | null }) {
  if (item.food_group === "condiment") return true
  const dish = item.name.split(/\s+with\s+/i)[0].replace(NOT_SAUCE, " food")
  return SAUCE_RE.test(dish)
}
