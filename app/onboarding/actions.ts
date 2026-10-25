"use server"

import { createClient } from "@/lib/supabase/server"
import { getSafeItems } from "@/lib/menu.server"
import { foodKey, isSauce, MEAL_PERIODS, todayInColumbus, type MenuItem } from "@/lib/menu-shared"

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
  const [swiped, ...lists] = await Promise.all([
    supabase.from("food_swipes").select("menu_items(name)").eq("user_id", userId),
    ...MEAL_PERIODS.map((p) => getSafeItems(userId, p, date)),
  ])
  if (swiped.error) throw swiped.error

  // Redoing onboarding (Me > Edit preferences) skips foods already swiped.
  const seen = new Set(
    (swiped.data as unknown as { menu_items: { name: string } | null }[]).flatMap((s) =>
      s.menu_items ? [foodKey(s.menu_items.name)] : []
    )
  )
  // The three meals repeat foods: keep one card per food name.
  const items: MenuItem[] = []
  for (const item of lists.flat()) {
    if (isSauce(item) || item.calories == null) continue
    const key = foodKey(item.name)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items.slice(0, DECK_SIZE)
}
