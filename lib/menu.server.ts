import "server-only"
import { createClient } from "@/lib/supabase/server"
import { fitsDiet, foodKey, isPlateItem, profileDiets, SCOTT_SLUG, type MealPeriod, type MenuItem } from "@/lib/menu-shared"

const COLUMNS = `
  id, name, meal_period, served_on, serving_size, image_url,
  calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg,
  iron_mg, calcium_mg, vit_d_mcg, allergens, diet_tags, nutrient_tags, food_group,
  station:stations(id, name, floor),
  locations!inner(slug, is_live)
`

const SAMPLE_LIMIT = 60
const PAGE_SIZE = 1000 // Supabase returns at most 1000 rows per request.

/**
 * Live menu items for one meal that are safe for this user: no overlap with
 * their allergens and a fit for their diet. When the user has any allergy,
 * items with no allergen or diet info are dropped too, since that usually
 * means the data is missing rather than the item being allergen-free.
 *
 * Every page and route that lists menu items must go through this function
 * (or getSafeSampleItems, which uses the same filter). Pass `forPlate` when
 * building or suggesting plates to also drop items that fail isPlateItem.
 * `location` is a location slug (default Scott). Throws if the user's
 * allergens can't be read, so callers fail closed.
 */
export async function getSafeItems(
  userId: string,
  mealPeriod: MealPeriod,
  date: string,
  { forPlate = false, location = SCOTT_SLUG }: { forPlate?: boolean; location?: string } = {}
): Promise<MenuItem[]> {
  const supabase = await createClient()
  const rows = supabase
    .from("menu_items")
    .select(COLUMNS)
    .eq("locations.slug", location)
    .eq("locations.is_live", true)
    .eq("meal_period", mealPeriod)
    .eq("served_on", date)
    .order("name")
  return filterSafe(userId, rows, { forPlate })
}

/**
 * Every live Scott food on any day and meal of the synced week, safe for this
 * user, one row per food name. For the recipe dupe, so it works whatever day
 * it is. When a food is served more than once, the row for `prefer` (today's
 * current meal) wins, then the rest of today, then the soonest upcoming day.
 */
export async function getSafeWeekItems(
  userId: string,
  prefer: { date: string; meal: MealPeriod }
): Promise<MenuItem[]> {
  const supabase = await createClient()
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("menu_items")
      .select(COLUMNS)
      .eq("locations.slug", SCOTT_SLUG)
      .eq("locations.is_live", true)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  const safe = await filterSafe(userId, Promise.resolve({ data: rows, error: null }), { forPlate: false })

  const rank = (i: MenuItem) =>
    i.served_on === prefer.date
      ? i.meal_period === prefer.meal ? 0 : 1
      : i.served_on > prefer.date ? 2 : 3
  safe.sort((a, b) => rank(a) - rank(b) || a.served_on.localeCompare(b.served_on) || a.name.localeCompare(b.name))
  const seen = new Set<string>()
  return safe.filter((i) => {
    const key = foodKey(i.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Sample items for a location that isn't live yet (any date or meal, one row
 * per food), with the same safety filter as getSafeItems.
 */
export async function getSafeSampleItems(userId: string, location: string): Promise<MenuItem[]> {
  const supabase = await createClient()
  const rows = supabase
    .from("menu_items")
    .select(COLUMNS)
    .eq("locations.slug", location)
    .order("name")
    .limit(SAMPLE_LIMIT * 4)
  const items = await filterSafe(userId, rows, { forPlate: false })
  const seen = new Set<string>()
  return items.filter((i) => !seen.has(i.name) && seen.add(i.name)).slice(0, SAMPLE_LIMIT)
}

/**
 * The allergen and diet filter shared by getSafeItems and getSafeSampleItems.
 * Takes the items query unawaited so it runs alongside the user lookups.
 */
async function filterSafe(
  userId: string,
  itemsQuery: PromiseLike<{ data: unknown; error: Error | null }>,
  { forPlate }: { forPlate: boolean }
): Promise<MenuItem[]> {
  const supabase = await createClient()
  const [items, profile, allergens] = await Promise.all([
    itemsQuery,
    // "*" so this works before and after migration 007 adds profiles.diets.
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_allergens").select("allergen").eq("user_id", userId),
  ])
  if (items.error) throw items.error
  if (profile.error) throw profile.error
  if (allergens.error) throw allergens.error

  const diets = profileDiets(profile.data)
  const userAllergens = new Set(allergens.data.map((a) => a.allergen))

  return (items.data as unknown as (MenuItem & { locations?: unknown })[])
    .map((row) => {
      const item = {
        ...row,
        allergens: row.allergens ?? [],
        diet_tags: row.diet_tags ?? [],
        nutrient_tags: row.nutrient_tags ?? [],
      }
      delete item.locations // only needed for the join filter
      return item as MenuItem
    })
    .filter((item) => {
      if (forPlate && !isPlateItem(item)) return false
      if (item.allergens.some((a) => userAllergens.has(a))) return false
      if (userAllergens.size > 0 && item.allergens.length === 0 && item.diet_tags.length === 0) {
        return false
      }
      return fitsDiet(item.diet_tags, diets)
    })
}
