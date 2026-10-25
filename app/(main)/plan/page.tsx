import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { addDays, currentMealPeriod, MEAL_PERIODS, todayInColumbus, type MealPeriod } from "@/lib/menu-shared"
import { checkDay, goalName, goalProfile, type DayFood } from "@/lib/goals"
import { PageContainer } from "@/components/page-container"
import { DayPlan, type DayInfo, type GoalStats, type Slots } from "./day-plan"

export const metadata: Metadata = {
  title: "Plan · BuckeyeBites",
}

// Four weeks back (for history and averages) and a week ahead (for planning).
const PAST_DAYS = 28
const FUTURE_DAYS = 6
const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

type LogRow = {
  eaten_on: string
  meal_period: string | null
  recipe_id: number | null
  totals: Record<string, number> | null
  recipes: { title: string | null; recipe_items: { menu_items: DayFood | null }[] } | null
}

async function Plan() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const now = new Date()
  const today = todayInColumbus(now)
  const dates = Array.from({ length: PAST_DAYS + 1 + FUTURE_DAYS }, (_, i) => addDays(today, i - PAST_DAYS))

  const [plans, logs, profileRow] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id, plan_date, meal_period, recipe_id, recipes(title)")
      .eq("user_id", userId)
      .gte("plan_date", dates[0])
      .lte("plan_date", dates.at(-1)!)
      .order("id"),
    supabase
      .from("meal_logs")
      .select("eaten_on, meal_period, recipe_id, totals, recipes(title, recipe_items(menu_items(food_group, nutrient_tags, fiber_g)))")
      .eq("user_id", userId)
      .gte("eaten_on", dates[0])
      .lte("eaten_on", today)
      .order("created_at"),
    supabase.from("profiles").select("mode, focus_nutrients, goals").eq("id", userId).maybeSingle(),
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

  const profile = goalProfile(profileRow.data)

  const byDay = new Map<string, LogRow[]>()
  for (const row of logs.data as unknown as LogRow[]) {
    byDay.set(row.eaten_on, [...(byDay.get(row.eaten_on) ?? []), row])
  }

  const days: Record<string, DayInfo> = {}
  for (const date of dates) {
    const rows = byDay.get(date) ?? []
    const logged: DayInfo["logged"] = {}
    for (const row of rows) {
      if (isMealPeriod(row.meal_period)) {
        logged[row.meal_period] = { recipeId: row.recipe_id, title: row.recipes?.title ?? "Your plate" }
      }
    }
    const foods = rows.flatMap((r) => r.recipes?.recipe_items.map((ri) => ri.menu_items).filter((f): f is DayFood => !!f) ?? [])
    const protein = rows.reduce((sum, r) => sum + (Number(r.totals?.protein_g) || 0), 0)
    const checks = rows.length > 0 ? checkDay(profile, foods, protein) : []
    days[date] = {
      logged,
      checks,
      status: date > today ? "future" : rows.length === 0 ? "none" : checks.length > 0 && checks.every((c) => c.met) ? "hit" : "partial",
    }
  }

  // Goal stats over the last 7 and 28 days, today included.
  const lastDays = (n: number) => dates.filter((d) => d <= today).slice(-n)
  const hits = (ds: string[]) => ds.filter((d) => days[d].status === "hit").length
  let streak = 0
  // Today still counts as in progress, so the streak runs back from today (if hit) or yesterday.
  for (const d of [...lastDays(PAST_DAYS + 1)].reverse()) {
    if (days[d].status === "hit") streak++
    else if (d === today) continue
    else break
  }
  const week = lastDays(7)
  const labels = [...new Set(week.flatMap((d) => days[d].checks.map((c) => c.label)))]
  const stats: GoalStats = {
    goal: goalName(profile),
    measurable: profile.mode !== "macros" || profile.proteinGoal != null || profile.focusNutrients.length > 0,
    week: { hit: hits(week), logged: week.filter((d) => days[d].status !== "none").length },
    perWeek: Math.round((hits(lastDays(PAST_DAYS)) / (PAST_DAYS / 7)) * 10) / 10,
    streak,
    byCheck: labels.map((label) => ({
      label,
      days: week.filter((d) => days[d].checks.some((c) => c.label === label && c.met)).length,
    })),
  }

  return (
    <DayPlan
      dates={dates}
      todayIndex={PAST_DAYS}
      initialSlots={slots}
      days={days}
      stats={stats}
      currentMeal={currentMealPeriod(now)}
    />
  )
}

export default function PlanPage() {
  return (
    <PageContainer wide>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading your plan…</p>}>
        <Plan />
      </Suspense>
    </PageContainer>
  )
}
