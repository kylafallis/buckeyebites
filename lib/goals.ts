// Daily goal checks, shared by the Plan history. Plain module: no Supabase.
// The goal depends on the student's mode, matching the dashboard:
//   nutrients: 3 foods that are a good source of each focus nutrient
//   macros: the daily protein goal
//   balanced: protein, veg, fruit and grain all eaten that day
import { NUTRIENT_TAGS } from "@/lib/menu-shared"
import { labelFor, NUTRIENTS } from "@/lib/preferences"

export type DayFood = { food_group: string | null; nutrient_tags: string[] | null; fiber_g: number | null }
export type GoalProfile = { mode: string; focusNutrients: string[]; proteinGoal: number | null }
export type GoalCheck = { label: string; value: number; target: number; unit: string; met: boolean }

export const NUTRIENT_GOAL = 3
// Fiber has no nutrient tag; 3 g a serving is about 10% of the daily value.
const FIBER_GOOD_SOURCE_G = 3
const BALANCED_GROUPS = ["protein", "veg", "fruit", "grain"]

/** The day's goal checks from what was logged. Empty when the profile has no measurable goal. */
export function checkDay(profile: GoalProfile, foods: DayFood[], protein: number): GoalCheck[] {
  if (profile.mode === "nutrients" && profile.focusNutrients.length > 0) {
    return profile.focusNutrients.map((nutrient) => {
      const tag = NUTRIENT_TAGS.find((n) => n.focus === nutrient)?.tag
      const value = foods.filter((f) =>
        tag ? (f.nutrient_tags ?? []).includes(tag) : nutrient === "fiber" && (f.fiber_g ?? 0) >= FIBER_GOOD_SOURCE_G
      ).length
      return { label: labelFor(NUTRIENTS, nutrient), value, target: NUTRIENT_GOAL, unit: "good-source foods", met: value >= NUTRIENT_GOAL }
    })
  }
  if (profile.mode === "macros") {
    if (!profile.proteinGoal) return []
    const value = Math.round(protein)
    return [{ label: "Protein", value, target: profile.proteinGoal, unit: "g", met: value >= profile.proteinGoal }]
  }
  const groups = new Set(foods.map((f) => f.food_group))
  const value = BALANCED_GROUPS.filter((g) => groups.has(g)).length
  return [{ label: "Food groups", value, target: BALANCED_GROUPS.length, unit: "groups", met: value >= BALANCED_GROUPS.length }]
}

/** A short name for the goal, for headings: "Iron and fiber", "Protein", "A balanced day". */
export function goalName(profile: GoalProfile) {
  if (profile.mode === "nutrients" && profile.focusNutrients.length > 0) {
    const names = profile.focusNutrients.map((n) => labelFor(NUTRIENTS, n))
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
  }
  if (profile.mode === "macros") return profile.proteinGoal ? `${profile.proteinGoal} g protein` : "Protein"
  return "A balanced day"
}
