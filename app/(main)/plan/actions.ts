"use server"

import { createClient } from "@/lib/supabase/server"
import { isIsoDate, MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import { slotOptions } from "@/lib/recipes"
import type { RecipeCard } from "@/lib/recipes-shared"

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

async function signedIn() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: data?.claims?.sub ?? null }
}

const validSlot = (date: unknown, meal: unknown): meal is MealPeriod =>
  isIsoDate(date) && MEAL_PERIODS.includes(meal as MealPeriod)

/** Plates for one slot that pass getSafeItems on that date's menu. */
export async function loadSlotOptions(date: string, meal: MealPeriod): Promise<Result<RecipeCard[]>> {
  if (!validSlot(date, meal)) return { ok: false, error: "That day or meal isn't valid." }
  const { supabase, userId } = await signedIn()
  if (!userId) return { ok: false, error: "Sign in again to plan meals." }
  try {
    return { ok: true, value: await slotOptions(supabase, userId, date, meal) }
  } catch (error) {
    console.error("loadSlotOptions failed:", error)
    return { ok: false, error: "Couldn't load plates for this meal. Try again." }
  }
}

/** Puts a recipe in a slot, replacing anything already there. */
export async function setSlot(
  date: string,
  meal: MealPeriod,
  recipeId: number
): Promise<Result<{ recipeId: number; title: string }>> {
  if (!validSlot(date, meal) || !Number.isInteger(recipeId)) return { ok: false, error: "That plate isn't valid." }
  const { supabase, userId } = await signedIn()
  if (!userId) return { ok: false, error: "Sign in again to plan meals." }

  try {
    // Only plates that are safe on that day's menu can be planned.
    const plate = (await slotOptions(supabase, userId, date, meal)).find((o) => o.id === recipeId)
    if (!plate) return { ok: false, error: "That plate isn't available for you at this meal." }

    const cleared = await supabase
      .from("meal_plans")
      .delete()
      .eq("user_id", userId)
      .eq("plan_date", date)
      .eq("meal_period", meal)
    if (cleared.error) throw cleared.error
    const inserted = await supabase
      .from("meal_plans")
      .insert({ user_id: userId, plan_date: date, meal_period: meal, recipe_id: recipeId })
    if (inserted.error) throw inserted.error
    return { ok: true, value: { recipeId, title: plate.title } }
  } catch (error) {
    console.error("setSlot failed:", error)
    return { ok: false, error: "Couldn't save your plan. Try again." }
  }
}

/** Empties a slot. */
export async function clearSlot(date: string, meal: MealPeriod): Promise<Result<null>> {
  if (!validSlot(date, meal)) return { ok: false, error: "That day or meal isn't valid." }
  const { supabase, userId } = await signedIn()
  if (!userId) return { ok: false, error: "Sign in again to plan meals." }

  const { error } = await supabase
    .from("meal_plans")
    .delete()
    .eq("user_id", userId)
    .eq("plan_date", date)
    .eq("meal_period", meal)
  if (error) {
    console.error("clearSlot failed:", error)
    return { ok: false, error: "Couldn't remove that. Try again." }
  }
  return { ok: true, value: null }
}
