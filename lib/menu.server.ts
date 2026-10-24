import "server-only"
import { createClient } from "@/lib/supabase/server"
import { fitsDiet, isPlateItem, SCOTT_SLUG, type MealPeriod, type MenuItem } from "@/lib/menu-shared"

const COLUMNS = `
  id, name, meal_period, served_on, serving_size, image_url,
  calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg,
  iron_mg, calcium_mg, vit_d_mcg, allergens, diet_tags, nutrient_tags, food_group,
  station:stations(id, name, floor),
  locations!inner(slug, is_live)
`

/**
 * Scott menu items for one meal that are safe for this user: no overlap with
 * their allergens and a fit for their diet. When the user has any allergy,
 * items with no allergen or diet info are dropped too, since that usually
 * means the data is missing rather than the item being allergen-free.
 *
 * Every page and route that lists menu items must go through this function.
 * Pass `forPlate` when building or suggesting plates to also drop items that
 * fail isPlateItem. Throws if the user's allergens can't be read, so callers
 * fail closed.
 */
export async function getSafeItems(
  userId: string,
  mealPeriod: MealPeriod,
  date: string,
  { forPlate = false }: { forPlate?: boolean } = {}
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
      return fitsDiet(item.diet_tags, diet)
    })
}
