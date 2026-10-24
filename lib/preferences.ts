export const DIETS = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "halal_friendly", label: "Halal-friendly" },
] as const

export const ALLERGENS = [
  { value: "milk", label: "Milk" },
  { value: "egg", label: "Egg" },
  { value: "peanut", label: "Peanut" },
  { value: "tree_nut", label: "Tree nut" },
  { value: "soy", label: "Soy" },
  { value: "wheat", label: "Wheat" },
  { value: "fish", label: "Fish" },
  { value: "shellfish", label: "Shellfish" },
  { value: "sesame", label: "Sesame" },
] as const

export const MODES = [
  { value: "balanced", label: "Balanced", description: "A well-rounded mix at every meal." },
  { value: "nutrients", label: "Nutrient focus", description: "Prioritize specific nutrients." },
  { value: "macros", label: "Macros", description: "Hit a daily protein goal." },
] as const

export const NUTRIENTS = [
  { value: "iron", label: "Iron" },
  { value: "vit_d", label: "Vitamin D" },
  { value: "calcium", label: "Calcium" },
  { value: "fiber", label: "Fiber" },
] as const

export function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ")
}
