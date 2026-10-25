// Daily goal checks, shared by the Plan history. Plain module: no Supabase.
// A student can have several goals at once, matching the dashboard:
//   each focus nutrient: 3 foods that are a good source of it
//   protein (mode "macros"): the daily protein goal
//   balanced (no other goal): protein, veg, fruit and grain all eaten that day
import { NUTRIENT_TAGS } from "@/lib/menu-shared"
import { labelFor, NUTRIENTS } from "@/lib/preferences"

export type DayFood = { food_group: string | null; nutrient_tags: string[] | null; fiber_g: number | null }
export type GoalProfile = { mode: string; focusNutrients: string[]; proteinGoal: number | null }
export type GoalCheck = { label: string; value: number; target: number; unit: string; met: boolean }

/** Reads a profile row's goals. Focus nutrients and a protein goal can both be set. */
export function goalProfile(row: { mode?: string | null; focus_nutrients?: string[] | null; goals?: unknown } | null): GoalProfile {
  const mode = row?.mode ?? "balanced"
  const protein = Number((row?.goals as Record<string, unknown> | null)?.protein_g)
  return {
    mode,
    focusNutrients: mode === "balanced" ? [] : (row?.focus_nutrients ?? []),
    proteinGoal: mode === "macros" && Number.isFinite(protein) && protein > 0 ? protein : null,
  }
}

export const NUTRIENT_GOAL = 3
// Fiber has no nutrient tag; 3 g a serving is about 10% of the daily value.
const FIBER_GOOD_SOURCE_G = 3
const BALANCED_GROUPS = ["protein", "veg", "fruit", "grain"]

/** The day's goal checks from what was logged. Empty when the profile has no measurable goal. */
export function checkDay(profile: GoalProfile, foods: DayFood[], protein: number): GoalCheck[] {
  const checks: GoalCheck[] = profile.focusNutrients.map((nutrient) => {
    const tag = NUTRIENT_TAGS.find((n) => n.focus === nutrient)?.tag
    const value = foods.filter((f) =>
      tag ? (f.nutrient_tags ?? []).includes(tag) : nutrient === "fiber" && (f.fiber_g ?? 0) >= FIBER_GOOD_SOURCE_G
    ).length
    return { label: labelFor(NUTRIENTS, nutrient), value, target: NUTRIENT_GOAL, unit: "good-source foods", met: value >= NUTRIENT_GOAL }
  })
  if (profile.proteinGoal) {
    const value = Math.round(protein)
    checks.push({ label: "Protein", value, target: profile.proteinGoal, unit: "g", met: value >= profile.proteinGoal })
  }
  if (checks.length > 0 || profile.mode === "macros") return checks
  const groups = new Set(foods.map((f) => f.food_group))
  const value = BALANCED_GROUPS.filter((g) => groups.has(g)).length
  return [{ label: "Food groups", value, target: BALANCED_GROUPS.length, unit: "groups", met: value >= BALANCED_GROUPS.length }]
}

/** A short name for the goals, for headings: "Iron and Fiber", "Iron and 120 g protein", "A balanced day". */
export function goalName(profile: GoalProfile) {
  const names = profile.focusNutrients.map((n) => labelFor(NUTRIENTS, n))
  if (profile.mode === "macros") names.push(profile.proteinGoal ? `${profile.proteinGoal} g protein` : "Protein")
  if (names.length === 0) return "A balanced day"
  const name = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
  return name.charAt(0).toUpperCase() + name.slice(1)
}
