import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { addDays, currentMealPeriod, MEAL_PERIODS, todayInColumbus, type MealPeriod } from "@/lib/menu-shared"
import { PageContainer } from "@/components/page-container"
import { DayPlan, type Logged, type Slots } from "./day-plan"

export const metadata: Metadata = {
  title: "Plan · BuckeyeBites",
}

const DAYS = 7
const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

async function Plan() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const now = new Date()
  const today = todayInColumbus(now)
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i))

  const [plans, logs] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id, plan_date, meal_period, recipe_id, recipes(title)")
      .eq("user_id", userId)
      .gte("plan_date", dates[0])
      .lte("plan_date", dates.at(-1)!)
      .order("id"),
    supabase
      .from("meal_logs")
      .select("id, meal_period, recipe_id, recipes(title)")
      .eq("user_id", userId)
      .eq("eaten_on", today)
      .order("created_at"),
  ])
  if (plans.error) throw plans.error
  if (logs.error) throw logs.error

  // Latest row wins if a slot somehow has more than one.
  const slots: Slots = {}
  for (const row of plans.data as unknown as {
    plan_date: string
    meal_period: string
    recipe_id: number
    recipes: { title: string | null } | null
  }[]) {
    slots[`${row.plan_date}|${row.meal_period}`] = { recipeId: row.recipe_id, title: row.recipes?.title ?? "Scott plate" }
  }

  const logged: Logged = {}
  for (const row of logs.data as unknown as {
    meal_period: string | null
    recipe_id: number | null
    recipes: { title: string | null } | null
  }[]) {
    if (isMealPeriod(row.meal_period)) {
      logged[row.meal_period] = { recipeId: row.recipe_id, title: row.recipes?.title ?? "Your plate" }
    }
  }

  return <DayPlan dates={dates} initialSlots={slots} logged={logged} currentMeal={currentMealPeriod(now)} />
}

export default function PlanPage() {
  return (
    <PageContainer narrow>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading your plan…</p>}>
        <Plan />
      </Suspense>
    </PageContainer>
  )
}
