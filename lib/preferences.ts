// Multi-select: an item must fit every chosen diet. None chosen = no restrictions.
export const DIETS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "halal_friendly", label: "Halal-friendly" },
  { value: "gluten_free", label: "Gluten-free" },
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

export const NUTRIENTS = [
  { value: "iron", label: "Iron" },
  { value: "vit_d", label: "Vitamin D" },
  { value: "calcium", label: "Calcium" },
  { value: "fiber", label: "Fiber" },
] as const

export function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ")
}
