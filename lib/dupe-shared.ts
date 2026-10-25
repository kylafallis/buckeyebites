// Recipe dupe types shared by lib/dupe.ts, /api/dupe and the /dupe page.
import type { MealPeriod } from "@/lib/menu-shared"
import type { Totals } from "@/lib/totals"

export type DupeIngredient = {
  /** The ingredient line as written in the recipe. */
  ingredient: string
  /** The amount, when the AI matcher pulled one out. */
  quantity?: string | null
  status: "matched" | "swapped" | "pantry" | "missing"
  /** The Scott item it maps to; null for pantry and missing. */
  item: { id: number; name: string; station: string | null } | null
  /** For swaps: "Scott has X instead of Y". */
  reason: string
}

export type DupeResult = {
  /** null when nothing (or only sauces) matched, so nothing was saved. */
  recipeId: number | null
  title: string
  meal: MealPeriod
  date: string
  ingredients: DupeIngredient[]
  steps: string[]
  totals: Totals
  /** "ai" when Gemini matched it, "keyword" when the AI-free fallback did. */
  method: "ai" | "keyword"
  /** Up to 4 photos of the matched Scott items. */
  photos: { src: string; alt: string }[]
  /** The original recipe's nutrition, as written on its page. */
  sourceNutrition: Record<string, string> | null
}
