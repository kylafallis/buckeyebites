import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSafeItems } from "@/lib/menu.server"
import {
  currentMealPeriod,
  MEAL_PERIODS,
  NUTRIENT_TAGS,
  todayInColumbus,
  type MealPeriod,
  type MenuItem,
} from "@/lib/menu-shared"
import { computeTotals, focusField } from "@/lib/totals"

// Feed me picks one of the team's ready-made (curated) plates. No AI: a plate
// is only offered when every food on it is on today's menu and safe for the
// user, then one is chosen at random, weighted toward their preferences.

export class PlateError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export type CuratedPlate = {
  id: number
  title: string | null
  parts: { item: MenuItem; servings: number }[]
}

type CuratedRow = {
  id: number
  title: string | null
  tags: string[] | null
  recipe_items: { servings: number | null; menu_items: { name: string } | null }[]
}

/** Food names are the stable key: menu item ids change every day and meal. */
export const foodKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ")

const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

/**
 * Curated plates whose foods are all in `items` (today's safe items for
 * `meal`, from getSafeItems(..., { forPlate: true })). Each part is today's
 * row for that food, so stations and nutrition are today's.
 */
export async function safeCuratedPlates(
  supabase: SupabaseClient,
  items: MenuItem[],
  meal: MealPeriod
): Promise<CuratedPlate[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, tags, recipe_items(servings, menu_items(name))")
    .eq("source", "curated")
    .order("id")
  if (error) throw error

  const byName = new Map<string, MenuItem>()
  for (const item of items) if (!byName.has(foodKey(item.name))) byName.set(foodKey(item.name), item)

  const plates: CuratedPlate[] = []
  for (const recipe of data as unknown as CuratedRow[]) {
    // A plate tagged with meal periods only shows at those meals.
    const meals = (recipe.tags ?? []).filter(isMealPeriod)
    if (meals.length > 0 && !meals.includes(meal)) continue
    if (recipe.recipe_items.length === 0) continue

    const parts = recipe.recipe_items.map((ri) => ({
      item: ri.menu_items ? byName.get(foodKey(ri.menu_items.name)) : undefined,
      servings: ri.servings ?? 1,
    }))
    if (parts.some((p) => !p.item)) continue
    plates.push({ id: recipe.id, title: recipe.title, parts: parts as CuratedPlate["parts"] })
  }
  return plates
}

// Rough daily references, only used to rank plates for nutrient focus.
const DAILY_REFERENCE: Record<string, number> = { iron_mg: 18, calcium_mg: 1300, fiber_g: 28, vit_d_mcg: 20 }

type Preferences = {
  likes: Set<string>
  dislikes: Set<string>
  focusNutrients: string[]
  proteinTarget: number | null
}

async function loadPreferences(supabase: SupabaseClient, userId: string): Promise<Preferences> {
  const [profile, swipes] = await Promise.all([
    supabase.from("profiles").select("mode, focus_nutrients, goals, meals_per_day").eq("id", userId).maybeSingle(),
    supabase.from("food_swipes").select("liked, menu_items(name)").eq("user_id", userId),
  ])
  if (profile.error) throw profile.error
  if (swipes.error) throw swipes.error

  const p = profile.data
  const mode = p?.mode ?? "balanced"
  const dailyProtein = Number((p?.goals as Record<string, unknown> | null)?.protein_g)
  const meals = Math.max(1, p?.meals_per_day ?? 3)

  const rows = swipes.data as unknown as { liked: boolean; menu_items: { name: string } | null }[]
  const names = (liked: boolean) =>
    new Set(rows.filter((s) => s.liked === liked && s.menu_items).map((s) => foodKey(s.menu_items!.name)))

  return {
    likes: names(true),
    dislikes: names(false),
    focusNutrients: mode === "nutrients" ? (p?.focus_nutrients ?? []) : [],
    proteinTarget:
      mode === "macros" && Number.isFinite(dailyProtein) && dailyProtein > 0
        ? Math.round(dailyProtein / meals)
        : null,
  }
}

/** Higher is a better fit: liked foods, focus nutrients, and closeness to the protein goal. */
function score({ parts }: CuratedPlate, prefs: Preferences) {
  const totals = computeTotals(parts)
  let s = 0
  for (const { item } of parts) {
    if (prefs.likes.has(foodKey(item.name))) s += 2
    if (prefs.dislikes.has(foodKey(item.name))) s -= 3
  }
  for (const nutrient of prefs.focusNutrients) {
    const tag = NUTRIENT_TAGS.find((n) => n.focus === nutrient)?.tag
    const key = focusField(nutrient)
    if (tag) s += parts.filter(({ item }) => item.nutrient_tags.includes(tag)).length * 2
    else if (key) s += (totals[key] / (DAILY_REFERENCE[key] ?? 1)) * 5
  }
  if (prefs.proteinTarget != null) s -= Math.abs(totals.protein_g - prefs.proteinTarget) / 10
  return s
}

/** Random pick where better-scoring plates are more likely, but any safe plate can come up. */
function weightedPick<T>(options: { value: T; score: number }[]): T {
  const best = Math.max(...options.map((o) => o.score))
  const weights = options.map((o) => Math.exp((o.score - best) / 2))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < options.length; i++) {
    r -= weights[i]
    if (r <= 0) return options[i].value
  }
  return options[options.length - 1].value
}

/**
 * Feed me: a random ready-made plate that is safe for this user right now.
 * `exclude` is the plate they're looking at, so Try again shows a different one.
 */
export async function pickPlate(
  supabase: SupabaseClient,
  userId: string,
  exclude?: number
): Promise<{ recipeId: number; source: "curated" }> {
  const meal = currentMealPeriod()
  const [items, prefs] = await Promise.all([
    getSafeItems(userId, meal, todayInColumbus(), { forPlate: true }),
    loadPreferences(supabase, userId),
  ])
  const plates = await safeCuratedPlates(supabase, items, meal)

  if (plates.length === 0) {
    throw new PlateError(`No ready-made ${meal} plate fits your diet and allergies on today's menu yet.`, 422)
  }

  const choices = plates.length > 1 ? plates.filter((p) => p.id !== exclude) : plates
  const id = weightedPick(choices.map((p) => ({ value: p.id, score: score(p, prefs) })))
  return { recipeId: id, source: "curated" }
}
