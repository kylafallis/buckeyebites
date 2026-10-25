import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { addDays, todayInColumbus } from "@/lib/menu-shared"
import { WeekPlan, type Slots } from "./week-plan"

export const metadata: Metadata = {
  title: "Plan · BuckeyeBites",
}

const DAYS = 7

async function Plan() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const today = todayInColumbus()
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i))

  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, plan_date, meal_period, recipe_id, recipes(title)")
    .eq("user_id", userId)
    .gte("plan_date", dates[0])
    .lte("plan_date", dates.at(-1)!)
    .order("id")
  if (error) throw error

  // Latest row wins if a slot somehow has more than one.
  const slots: Slots = {}
  for (const row of data as unknown as {
    plan_date: string
    meal_period: string
    recipe_id: number
    recipes: { title: string | null } | null
  }[]) {
    slots[`${row.plan_date}|${row.meal_period}`] = { recipeId: row.recipe_id, title: row.recipes?.title ?? "Scott plate" }
  }

  return <WeekPlan dates={dates} initialSlots={slots} />
}

export default function PlanPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 md:max-w-6xl">
      <h1 className="text-xl font-semibold">Meal plan</h1>
      <p className="text-sm text-muted-foreground">Your week at Scott, starting today.</p>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading your plan…</p>}>
        <Plan />
      </Suspense>
    </main>
  )
}
