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

/** Items a plate may use: condiments and items with unknown calories only show on /menu. */
export function isPlateItem(item: Pick<MenuItem, "food_group" | "calories">) {
  return item.food_group !== "condiment" && item.calories != null
}

/** Whether an item's diet_tags fit the user's diet. */
export function fitsDiet(tags: string[], diet: string) {
  switch (diet) {
    case "vegan":
      return tags.includes("vegan")
    case "vegetarian":
      return tags.includes("vegetarian")
    case "pescatarian":
      return ["pescatarian", "vegetarian", "vegan"].some((t) => tags.includes(t))
    case "halal_friendly":
      return tags.includes("halal") || tags.includes("vegetarian")
    default:
      return true
  }
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
  const date = `${get("year")}-${get("month")}-${get("day")}`
  // Day of week for that calendar date, 0 = Sunday.
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
  return { date, dow, hour: +get("hour"), minute: +get("minute") }
}

export function todayInColumbus(now = new Date()) {
  return columbusParts(now).date
}

/** Day of week (0 = Sunday) and hour (0-23) in Columbus. */
export function columbusDayHour(now = new Date()) {
  const { dow, hour } = columbusParts(now)
  return { dow, hour }
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
