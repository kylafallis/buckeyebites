import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import { INSIGHT_STATS, INSIGHT_STATS_SOURCE } from "@/lib/insights-stats"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StationDemandChart, TopLikedChart, type LikedRow, type StationRow } from "./insights-charts"

export const metadata: Metadata = {
  title: "Insights · BuckeyeBites",
}

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const isMeal = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)
const servings = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

type PlannedRow = { name: string; station: string | null; meal_period: string | null; planned_servings: number }
type DemandRow = { station: string | null; meal_period: string | null; planned_servings: number }

async function Insights() {
  // Any signed-in user can view this for the demo; the views only expose totals.
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) redirect("/login")

  const [liked, planned, demand] = await Promise.all([
    supabase.from("insight_top_liked").select("name, likes, dislikes, like_rate"),
    supabase.from("insight_planned_tomorrow").select("name, station, meal_period, planned_servings"),
    supabase.from("insight_station_demand").select("station, meal_period, planned_servings"),
  ])
  for (const r of [liked, planned, demand]) if (r.error) console.error("Insights query failed:", r.error.message)

  const topLiked = ((liked.data ?? []) as LikedRow[])
    .map((r) => ({ ...r, likes: Number(r.likes), dislikes: Number(r.dislikes), like_rate: r.like_rate == null ? null : Number(r.like_rate) }))
    .filter((r) => r.likes > 0)
    .sort((a, b) => b.likes - a.likes || (b.like_rate ?? 0) - (a.like_rate ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 10)

  const mealRank = (m: string | null) => (isMeal(m) ? MEAL_PERIODS.indexOf(m) : MEAL_PERIODS.length)
  const tomorrow = ((planned.data ?? []) as PlannedRow[])
    .map((r) => ({ ...r, planned_servings: Number(r.planned_servings) }))
    .sort((a, b) => mealRank(a.meal_period) - mealRank(b.meal_period) || b.planned_servings - a.planned_servings || a.name.localeCompare(b.name))

  // Pivot station demand to one row per station, one value per meal.
  const byStation = new Map<string, StationRow>()
  const meals = new Set<MealPeriod>()
  for (const r of (demand.data ?? []) as DemandRow[]) {
    if (!isMeal(r.meal_period)) continue
    const station = r.station ?? "Other"
    const row = byStation.get(station) ?? { station }
    row[r.meal_period] = (row[r.meal_period] ?? 0) + Number(r.planned_servings)
    byStation.set(station, row)
    meals.add(r.meal_period)
  }
  const mealList = MEAL_PERIODS.filter((m) => meals.has(m))
  const total = (r: StationRow) => mealList.reduce((s, m) => s + (r[m] ?? 0), 0)
  const stationRows = [...byStation.values()].sort((a, b) => total(b) - total(a))

  const empty = (text: string) => <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Most-liked foods</CardTitle>
          <p className="text-xs text-muted-foreground">Top 10 by likes on BuckeyeBite&apos;s swipe deck</p>
        </CardHeader>
        <CardContent>
          {topLiked.length === 0 ? empty("No likes yet.") : <TopLikedChart rows={topLiked} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planned for tomorrow</CardTitle>
          <p className="text-xs text-muted-foreground">Servings students have planned, by food</p>
        </CardHeader>
        <CardContent>
          {tomorrow.length === 0 ? (
            empty("No meals planned for tomorrow yet.")
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">Food</th>
                    <th className="py-1.5 pr-2 font-medium">Station</th>
                    <th className="py-1.5 pr-2 font-medium">Meal</th>
                    <th className="py-1.5 text-right font-medium">Servings</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tomorrow.map((r, i) => (
                    <tr key={`${r.name}-${r.station}-${r.meal_period}-${i}`}>
                      <td className="py-1.5 pr-2">{r.name}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.station ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{isMeal(r.meal_period) ? MEAL_LABELS[r.meal_period] : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{servings(r.planned_servings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planned servings by station</CardTitle>
          <p className="text-xs text-muted-foreground">Tomorrow, split by meal</p>
        </CardHeader>
        <CardContent>
          {stationRows.length === 0 ? (
            empty("No station demand yet.")
          ) : (
            <>
              <StationDemandChart rows={stationRows} meals={mealList} />
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-primary">View as table</summary>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-2 font-medium">Station</th>
                      {mealList.map((m) => (
                        <th key={m} className="py-1.5 pr-2 text-right font-medium">{MEAL_LABELS[m]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stationRows.map((r) => (
                      <tr key={r.station}>
                        <td className="py-1.5 pr-2">{r.station}</td>
                        {mealList.map((m) => (
                          <td key={m} className="py-1.5 pr-2 text-right tabular-nums">{servings(r[m] ?? 0)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function InsightsPage() {
  return (
    <PageContainer>
      <h1 className="text-xl font-semibold">Dining insights</h1>
      <p className="text-sm text-muted-foreground">For OSU Dining staff: what students like and plan to eat at Scott.</p>

      <div className="mt-4 border-l-2 border-primary bg-primary/5 px-3 py-2 text-sm" role="note">
        <p className="font-semibold">Includes simulated demo data</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Likes and planned servings come from BuckeyeBite (swipes and meal plans). The waste figures in the cards
          come from The Lantern.
        </p>
      </div>

      <section aria-label="Food waste at Scott" className="mt-6">
        <ul className="grid gap-3 md:grid-cols-3">
          {INSIGHT_STATS.map((s) => (
            <li key={s.value} className="border bg-card p-4">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="mt-1 text-sm">{s.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Source: {INSIGHT_STATS_SOURCE}</p>
      </section>

      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading insights…</p>}>
        <Insights />
      </Suspense>
    </PageContainer>
  )
}
