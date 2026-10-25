import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSafeWeekItems } from "@/lib/menu.server"
import { currentMealPeriod, formatDay, isSauce, SCOTT_SLUG, todayInColumbus, type MenuItem } from "@/lib/menu-shared"
import { buildSteps, DupeError, fetchRecipe, matchIngredients, MAX_INGREDIENTS } from "@/lib/dupe"
import { aiMatchIngredients } from "@/lib/dupe-ai"
import type { DupeResult } from "@/lib/dupe-shared"
import { platePhotos } from "@/lib/plate-photos"
import { computeTotals, type Totals } from "@/lib/totals"

/**
 * Recipe dupe. Body: { url } or { ingredients } (one ingredient per line).
 * Matches the recipe to every food Scott serves this week that's safe for the
 * user, whatever day it is (Gemini first, the keyword matcher if AI is
 * unavailable or misses a line), saves it as a "dupe" recipe and returns the
 * recipe id and matches. Foods not on today's current meal say when they're served.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return Response.json({ error: "Sign in to make a dupe." }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { url?: unknown; ingredients?: unknown }
  const lines =
    typeof body.ingredients === "string"
      ? body.ingredients.split("\n")
      : Array.isArray(body.ingredients)
        ? body.ingredients.filter((i): i is string => typeof i === "string")
        : []
  const pasted = lines.map((i) => i.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean)
  const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : null
  if (pasted.length === 0 && !url) {
    return Response.json({ error: "Add a recipe link or paste its ingredients." }, { status: 400 })
  }

  try {
    const recipe = pasted.length > 0 ? null : await fetchRecipe(url!)
    const ingredients = (recipe?.recipeIngredient ?? pasted).slice(0, MAX_INGREDIENTS).map((i) => i.slice(0, 200))

    const meal = currentMealPeriod()
    const date = todayInColumbus()
    // Only foods that pass the allergen and diet filter can be matched, from any day this week.
    const safeItems = await getSafeWeekItems(userId, { date, meal })
    if (safeItems.length === 0) {
      return Response.json({ error: "Scott's menu isn't available for you right now." }, { status: 422 })
    }

    const ai = await aiMatchIngredients(recipe?.name ?? null, ingredients, meal, safeItems)
    const keyword = matchIngredients(ingredients, safeItems, recipe?.name)
    // A line the AI gave up on uses the keyword match when there is one.
    const byId = new Map(safeItems.map((i) => [i.id, i]))
    const when = (id: number) => {
      const i = byId.get(id)
      if (!i || (i.served_on === date && i.meal_period === meal)) return null
      return `${i.served_on === date ? "Today" : formatDay(i.served_on, { weekday: "short" })} ${i.meal_period}`
    }
    const matches = (ai?.matches ?? keyword).map((m, i) => {
      const chosen = m.status === "missing" && keyword[i]?.item ? keyword[i] : m
      return chosen.item ? { ...chosen, item: { ...chosen.item, when: when(chosen.item.id) } } : chosen
    })
    const used = [...new Set(matches.flatMap((m) => (m.item ? [m.item.id] : [])))].map((id) => byId.get(id)!)
    const totals = computeTotals(used.map((item) => ({ item, servings: 1 })))
    const title = `${recipe?.name ?? "Your recipe"}, Scott style`.slice(0, 80)
    const steps = ai && ai.steps.length >= 3 ? ai.steps : buildSteps(matches)

    const result: DupeResult = {
      // Only sauces (or nothing) matched: there's no plate to save.
      recipeId: used.some((item) => !isSauce(item)) ? await saveDupe(userId, meal, title, steps, used, totals) : null,
      title,
      meal,
      date,
      ingredients: matches,
      steps,
      totals,
      method: ai ? "ai" : "keyword",
      photos: platePhotos(used),
      sourceNutrition: recipe?.nutrition ?? null,
    }
    return Response.json(result)
  } catch (error) {
    if (error instanceof DupeError) {
      return Response.json({ error: error.message, needsIngredients: error.needsIngredients }, { status: error.status })
    }
    console.error("POST /api/dupe failed:", error)
    return Response.json({ error: "Something went wrong making your dupe." }, { status: 500 })
  }
}

/** Saves the dupe and its items with the service role (users can't write recipes). */
async function saveDupe(userId: string, meal: string, title: string, steps: string[], items: MenuItem[], totals: Totals) {
  const admin = createAdminClient()
  const { data: location } = await admin.from("locations").select("id").eq("slug", SCOTT_SLUG).maybeSingle()
  const { data: recipe, error } = await admin
    .from("recipes")
    .insert({ title, source: "dupe", location_id: location?.id ?? null, steps, tags: [meal], totals, created_by: userId })
    .select("id")
    .single()
  if (error) throw error

  const { error: itemsError } = await admin
    .from("recipe_items")
    .insert(items.map((item) => ({ recipe_id: recipe.id, menu_item_id: item.id, servings: 1 })))
  if (itemsError) {
    await admin.from("recipes").delete().eq("id", recipe.id)
    throw itemsError
  }
  return recipe.id as number
}
