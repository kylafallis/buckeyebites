import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSafeItems } from "@/lib/menu.server"
import {
  fitsDiet,
  MEAL_PERIODS,
  NUTRIENT_TAGS,
  todayInColumbus,
  type MealPeriod,
  type MenuItem,
} from "@/lib/menu-shared"
import { safeCuratedPlates, safePlatesForSlot } from "@/lib/plate"
import { RECIPE_DIETS, type RecipeCard } from "@/lib/recipes-shared"
import { platePhotos } from "@/lib/plate-photos"

// Recipe tags from the plates CSV that mean the same as an item nutrient tag.
const RECIPE_NUTRIENT_TAGS: Record<string, string> = { iron: "high_iron", "vitamin d": "vit_d", calcium: "calcium" }

const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

function toCard(
  recipe: { id: number; title: string | null; source: "curated" | "ai"; tags: string[] },
  items: MenuItem[],
  meals: MealPeriod[]
): RecipeCard {
  const nutrientTags = new Set(items.flatMap((i) => i.nutrient_tags))
  for (const tag of recipe.tags) {
    const mapped = RECIPE_NUTRIENT_TAGS[tag.toLowerCase()]
    if (mapped) nutrientTags.add(mapped)
  }
  return {
    id: recipe.id,
    title: recipe.title ?? "Scott plate",
    source: recipe.source,
    meals,
    items: items.map((i) => ({ name: i.name, station: i.station?.name ?? null })),
    diets: RECIPE_DIETS.filter((d) => items.every((i) => fitsDiet(i.diet_tags, [d]))),
    nutrientTags: NUTRIENT_TAGS.map((n) => n.tag).filter((t) => nutrientTags.has(t)),
    photos: platePhotos(items),
  }
}

/**
 * The recipe book: ready-made plates whose foods are all on today's menu and
 * safe for this user, plus the AI plates made for them whose items still pass
 * getSafeItems on the menu they were built from.
 */
export async function recipeBook(supabase: SupabaseClient, userId: string): Promise<RecipeCard[]> {
  const today = todayInColumbus()
  const [safeToday, ai] = await Promise.all([
    Promise.all(MEAL_PERIODS.map((meal) => getSafeItems(userId, meal, today, { forPlate: true }))),
    supabase
      .from("recipes")
      .select("id, title, tags, recipe_items(menu_item_id, menu_items(meal_period, served_on))")
      .eq("source", "ai")
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
  ])
  if (ai.error) throw ai.error

  // Ready-made plates, merged across the meals they fit today.
  const curated = new Map<number, { plate: Awaited<ReturnType<typeof safeCuratedPlates>>[number]; meals: MealPeriod[] }>()
  for (const [i, meal] of MEAL_PERIODS.entries()) {
    for (const plate of await safeCuratedPlates(supabase, safeToday[i], meal)) {
      const entry = curated.get(plate.id)
      if (entry) entry.meals.push(meal)
      else curated.set(plate.id, { plate, meals: [meal] })
    }
  }
  const cards = [...curated.values()].map(({ plate, meals }) =>
    toCard({ ...plate, source: "curated" }, plate.parts.map((p) => p.item), meals)
  )

  // AI plates: check each against the exact menu rows it was built from.
  type AiRow = {
    id: number
    title: string | null
    tags: string[] | null
    recipe_items: { menu_item_id: number; menu_items: { meal_period: string | null; served_on: string | null } | null }[]
  }
  const aiRows = ai.data as unknown as AiRow[]
  const menus = [
    ...new Set(
      aiRows.flatMap((r) =>
        r.recipe_items
          .map((ri) => ri.menu_items)
          .filter((m) => m && isMealPeriod(m.meal_period) && m.served_on)
          .map((m) => `${m!.meal_period}|${m!.served_on}`)
      )
    ),
  ]
  const safeById = new Map(
    (
      await Promise.all(
        menus.map((key) => {
          const [meal, date] = key.split("|")
          return getSafeItems(userId, meal as MealPeriod, date)
        })
      )
    )
      .flat()
      .map((item) => [item.id, item])
  )
  for (const row of aiRows) {
    const items = row.recipe_items.map((ri) => safeById.get(ri.menu_item_id))
    if (items.length === 0 || items.some((i) => !i)) continue
    const tags = row.tags ?? []
    cards.push(toCard({ id: row.id, title: row.title, source: "ai", tags }, items as MenuItem[], tags.filter(isMealPeriod)))
  }
  return cards
}

/** Ready-made plates for one plan slot, checked against that date's menu. */
export async function slotOptions(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  meal: MealPeriod
): Promise<RecipeCard[]> {
  const plates = await safePlatesForSlot(supabase, userId, date, meal)
  return plates.map((plate) => toCard({ ...plate, source: "curated" }, plate.parts.map((p) => p.item), [meal]))
}
