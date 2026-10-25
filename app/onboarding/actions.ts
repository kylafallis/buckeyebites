"use server"

import { createClient } from "@/lib/supabase/server"
import { getSafeItems } from "@/lib/menu.server"
import { isSauce, MEAL_PERIODS, todayInColumbus, type MenuItem } from "@/lib/menu-shared"

const DECK_SIZE = 15

/**
 * Today's safe Scott items across all meals, shuffled, for the swipe step.
 * Real foods only: no sauces or condiments, and no items without calories.
 * Shows fewer than DECK_SIZE cards if that's all there is.
 */
export async function loadSwipeItems(): Promise<MenuItem[]> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return []

  const date = todayInColumbus()
  const lists = await Promise.all(MEAL_PERIODS.map((p) => getSafeItems(userId, p, date)))

  const items = lists.flat().filter((item) => !isSauce(item) && item.calories != null)
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items.slice(0, DECK_SIZE)
}
