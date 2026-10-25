import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSafeItems, getSafeItemsFrom } from "@/lib/menu.server"
import {
  fitsDiet,
  MEAL_PERIODS,
  NUTRIENT_TAGS,
  todayInColumbus,
  type MealPeriod,
  type MenuItem,
} from "@/lib/menu-shared"
import { curatedRecipes, matchCuratedPlates, safePlatesForSlot, type CuratedPlate } from "@/lib/plate"
import { RECIPE_DIETS, type RecipeCard } from "@/lib/recipes-shared"
import { platePhotos } from "@/lib/plate-photos"

// Recipe tags from the plates CSV that mean the same as an item nutrient tag.
const RECIPE_NUTRIENT_TAGS: Record<string, string> = { iron: "high_iron", "vitamin d": "vit_d", calcium: "calcium" }

const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

function toCard(
  recipe: { id: number; title: string | null; source: RecipeCard["source"]; tags: string[] },
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
    diets: RECIPE_DIETS.filter((d) => items.every((i) => fitsDiet(i, [d]))),
    nutrientTags: NUTRIENT_TAGS.map((n) => n.tag).filter((t) => nutrientTags.has(t)),
    photos: platePhotos(items),
  }
}

/**
 * The recipe book: ready-made plates whose foods are all safe for this user
 * and all on one meal's menu, today or any later day of the synced week, plus
 * the AI plates made for them whose items still pass getSafeItems on the menu
 * they were built from. Plates on today's menu come first.
 */
export async function recipeBook(supabase: SupabaseClient, userId: string): Promise<RecipeCard[]> {
  const today = todayInColumbus()
  const [safeAhead, recipes, ai] = await Promise.all([
    getSafeItemsFrom(userId, today, { forPlate: true }),
    curatedRecipes(supabase),
    supabase
      .from("recipes")
      .select("id, title, source, tags, recipe_items(menu_item_id, menu_items(meal_period, served_on))")
      // Their own plates: recipe-link dupes (and older AI plates).
      .in("source", ["ai", "dupe"])
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
  ])
  if (ai.error) throw ai.error

  // Ready-made plates, checked against each day and meal's menu from today on.
  // A plate keeps the menu rows from the first day and meal it fits, and the
  // meals it fits on any day.
  const menus = new Map<string, MenuItem[]>()
  for (const item of safeAhead) {
    if (!isMealPeriod(item.meal_period)) continue
    const key = `${item.served_on}|${item.meal_period}`
    menus.set(key, [...(menus.get(key) ?? []), item])
  }
  // Day order, then breakfast, lunch, dinner.
  const slotOrder = (key: string) => key.replace(/\|(\w+)$/, (_, m) => `|${MEAL_PERIODS.indexOf(m)}`)
  const slots = [...menus.keys()].sort((a, b) => slotOrder(a).localeCompare(slotOrder(b)))
  const curated = new Map<number, { plate: CuratedPlate; meals: Set<MealPeriod>; date: string; meal: MealPeriod }>()
  for (const key of slots) {
    const [date, meal] = key.split("|") as [string, MealPeriod]
    for (const plate of matchCuratedPlates(recipes, menus.get(key)!, meal)) {
      const entry = curated.get(plate.id)
      if (entry) entry.meals.add(meal)
      else curated.set(plate.id, { plate, meals: new Set([meal]), date, meal })
    }
  }
  const cards: RecipeCard[] = [...curated.values()].map(({ plate, meals, date, meal }) => ({
    ...toCard(
      { ...plate, source: "curated" },
      plate.parts.map((p) => p.item),
      MEAL_PERIODS.filter((m) => meals.has(m))
    ),
    next: { date, meal, today: date === today },
  }))

  // AI plates: check each against the exact menu rows it was built from.
  type AiRow = {
    id: number
    title: string | null
    source: "ai" | "dupe"
    tags: string[] | null
    recipe_items: { menu_item_id: number; menu_items: { meal_period: string | null; served_on: string | null } | null }[]
  }
  const aiRows = ai.data as unknown as AiRow[]
  const aiMenus = [
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
        aiMenus.map((key) => {
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
    cards.push(toCard({ id: row.id, title: row.title, source: row.source, tags }, items as MenuItem[], tags.filter(isMealPeriod)))
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
