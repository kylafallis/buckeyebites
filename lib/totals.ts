import type { MenuItem } from "@/lib/menu-shared"

export const TOTAL_FIELDS = {
  calories: { label: "Calories", unit: "" },
  protein_g: { label: "Protein", unit: "g" },
  carbs_g: { label: "Carbs", unit: "g" },
  fat_g: { label: "Fat", unit: "g" },
  sugar_g: { label: "Sugar", unit: "g" },
  fiber_g: { label: "Fiber", unit: "g" },
  sodium_mg: { label: "Sodium", unit: "mg" },
  iron_mg: { label: "Iron", unit: "mg" },
  calcium_mg: { label: "Calcium", unit: "mg" },
  vit_d_mcg: { label: "Vitamin D", unit: "mcg" },
} as const

export type TotalKey = keyof typeof TOTAL_FIELDS
export type Totals = Record<TotalKey, number>

const FOCUS_FIELDS: Record<string, TotalKey> = {
  iron: "iron_mg",
  vit_d: "vit_d_mcg",
  calcium: "calcium_mg",
  fiber: "fiber_g",
}

/** Plate totals, always computed from menu_items rows, never from model output. */
export function computeTotals(parts: { item: Pick<MenuItem, TotalKey>; servings: number }[]): Totals {
  const totals = Object.fromEntries(Object.keys(TOTAL_FIELDS).map((k) => [k, 0])) as Totals
  for (const { item, servings } of parts) {
    for (const key of Object.keys(TOTAL_FIELDS) as TotalKey[]) {
      totals[key] += (item[key] ?? 0) * servings
    }
  }
  for (const key of Object.keys(totals) as TotalKey[]) {
    totals[key] = Math.round(totals[key] * 10) / 10
  }
  return totals
}

export function focusField(nutrient: string): TotalKey | undefined {
  return FOCUS_FIELDS[nutrient]
}

/** Which totals to show for a profile mode. Calories only appear in macros mode. */
export function totalsForMode(mode: string, focusNutrients: string[]): TotalKey[] {
  if (mode === "balanced") return ["protein_g", "carbs_g", "fat_g", "fiber_g"]
  // The menu sheet has no iron, calcium or vitamin D amounts; those show as
  // nutrient_tags badges on each item instead of totals.
  const focus = focusNutrients
    .map(focusField)
    .filter((k): k is TotalKey => !!k && !["iron_mg", "calcium_mg", "vit_d_mcg"].includes(k))
  // Macros mode can have focus nutrients too.
  const base: TotalKey[] = mode === "macros" ? ["calories", "protein_g", "carbs_g", "fat_g"] : ["protein_g"]
  return [...new Set<TotalKey>([...base, ...focus])]
}
