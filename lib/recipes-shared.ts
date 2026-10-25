// Recipe card types shared by the server (lib/recipes.ts) and client components.
import type { MealPeriod } from "@/lib/menu-shared"

export const RECIPE_DIETS = ["vegetarian", "vegan", "halal_friendly"] as const
export type RecipeDiet = (typeof RECIPE_DIETS)[number]

/** A recipe as shown on a card in the recipe book or the plan picker. */
export type RecipeCard = {
  id: number
  title: string
  source: "curated" | "ai"
  meals: MealPeriod[]
  items: { name: string; station: string | null }[]
  /** Diets every item on the plate fits. */
  diets: RecipeDiet[]
  /** nutrient_tags keys (high_iron, vit_d, calcium) from the items or the recipe's tags. */
  nutrientTags: string[]
  /** Up to 4 item photos for the card picture. */
  photos: { src: string; alt: string }[]
}
