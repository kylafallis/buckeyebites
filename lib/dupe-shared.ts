// Recipe dupe types shared by lib/dupe.ts, /api/dupe and the /dupe page.
import type { MealPeriod } from "@/lib/menu-shared"
import type { Totals } from "@/lib/totals"

export type DupeIngredient = {
  /** The ingredient line as written in the recipe. */
  ingredient: string
  status: "matched" | "swapped" | "pantry" | "missing"
  /** The Scott item it maps to; null for pantry and missing. */
  item: { id: number; name: string; station: string | null } | null
  /** For swaps: "Scott has X instead of Y". */
  reason: string
}

export type DupeResult = {
  /** null when nothing in the recipe is at Scott, so nothing was saved. */
  recipeId: number | null
  title: string
  meal: MealPeriod
  date: string
  ingredients: DupeIngredient[]
  steps: string[]
  totals: Totals
  /** The original recipe's nutrition, as written on its page. */
  sourceNutrition: Record<string, string> | null
}
