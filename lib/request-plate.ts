import type { MealPeriod } from "@/lib/menu-shared"

/**
 * Client helper: asks /api/plate for a plate (not `exclude`) and returns its
 * recipe id. Defaults to the current meal today; pass `slot` for another day or meal.
 */
export async function requestPlate(exclude?: number, slot?: { date?: string; meal: MealPeriod }): Promise<number> {
  let res: Response
  try {
    res = await fetch("/api/plate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(exclude != null ? { exclude } : {}),
        ...(slot ? { meal_period: slot.meal, ...(slot.date ? { date: slot.date } : {}) } : {}),
      }),
    })
  } catch {
    throw new Error("You're offline. Check your connection and try again.")
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok || typeof body.recipeId !== "number") {
    throw new Error(body.error ?? "Something went wrong building your plate.")
  }
  return body.recipeId
}
