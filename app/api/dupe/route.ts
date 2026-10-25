import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSafeItems } from "@/lib/menu.server"
import { currentMealPeriod, SCOTT_SLUG, todayInColumbus, type MenuItem } from "@/lib/menu-shared"
import { buildSteps, DupeError, fetchRecipe, matchIngredients, MAX_INGREDIENTS } from "@/lib/dupe"
import type { DupeResult } from "@/lib/dupe-shared"
import { computeTotals, type Totals } from "@/lib/totals"

/**
 * Recipe dupe (no AI). Body: { url } or { ingredients } (one ingredient per
 * line). Matches the recipe to the user's safe items for the current meal at
 * Scott, saves it as a "dupe" recipe and returns the recipe id and matches.
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
    // Only foods that pass getSafeItems can be matched.
    const safeItems = await getSafeItems(userId, meal, date)
    if (safeItems.length === 0) {
      return Response.json({ error: `Scott's ${meal} menu isn't available for you right now.` }, { status: 422 })
    }

    const matches = matchIngredients(ingredients, safeItems)
    const byId = new Map(safeItems.map((i) => [i.id, i]))
    const used = [...new Set(matches.flatMap((m) => (m.item ? [m.item.id] : [])))].map((id) => byId.get(id)!)
    const totals = computeTotals(used.map((item) => ({ item, servings: 1 })))
    const title = `${recipe?.name ?? "Your recipe"}, Scott style`.slice(0, 80)
    const steps = buildSteps(matches)

    const result: DupeResult = {
      recipeId: used.length > 0 ? await saveDupe(userId, meal, title, steps, used, totals) : null,
      title,
      meal,
      date,
      ingredients: matches,
      steps,
      totals,
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
