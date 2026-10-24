import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react/ssr"
import { createClient } from "@/lib/supabase/server"
import { getSafeItems } from "@/lib/menu.server"
import { columbusDayHour, currentMealPeriod, NUTRIENT_TAGS, SCOTT_SLUG, todayInColumbus } from "@/lib/menu-shared"
import { safeCuratedPlates, type CuratedPlate } from "@/lib/plate"
import { labelFor, NUTRIENTS } from "@/lib/preferences"
import { ProgressRing } from "@/components/progress-ring"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FeedMeButton } from "./feed-me-button"

export const metadata: Metadata = {
  title: "Dashboard · BuckeyeBites",
}

const TIME_ZONE = "America/New_York"
const BALANCED_GROUPS = [
  { group: "protein", label: "Protein" },
  { group: "veg", label: "Veg" },
  { group: "fruit", label: "Fruit" },
  { group: "grain", label: "Grain" },
] as const
const NUTRIENT_GOAL = 3
// Fiber has no nutrient tag; 3 g a serving is about 10% of the daily value.
const FIBER_GOOD_SOURCE_G = 3

type LoggedFood = { food_group: string | null; nutrient_tags: string[] | null; fiber_g: number | null }
type MealLog = {
  id: number
  meal_period: string | null
  created_at: string
  totals: Record<string, number> | null
  recipes: {
    title: string | null
    recipe_items: { menu_items: LoggedFood | null }[]
  } | null
}

async function Dashboard() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const now = new Date()
  const today = todayInColumbus(now)
  const meal = currentMealPeriod(now)
  const { dow, hour } = columbusDayHour(now)

  const [profile, logs, traffic, plates] = await Promise.all([
    supabase.from("profiles").select("display_name, mode, focus_nutrients, goals").eq("id", userId).maybeSingle(),
    supabase
      .from("meal_logs")
      .select("id, meal_period, created_at, totals, recipes(title, recipe_items(menu_items(food_group, nutrient_tags, fiber_g)))")
      .eq("user_id", userId)
      .eq("eaten_on", today)
      .order("created_at"),
    supabase
      .from("traffic_estimates")
      .select("busy_pct, locations!inner(slug)")
      .eq("locations.slug", SCOTT_SLUG)
      .eq("dow", dow)
      .eq("hour", hour)
      .maybeSingle(),
    getSafeItems(userId, meal, today, { forPlate: true })
      .then((items) => safeCuratedPlates(supabase, items))
      .catch((error): CuratedPlate[] => {
        // Fail closed: no suggestions rather than ones we couldn't check.
        console.error("Dashboard plate suggestions failed:", error)
        return []
      }),
  ])

  const name = profile.data?.display_name?.trim()
  const mealLogs = (logs.data ?? []) as unknown as MealLog[]
  const foods = mealLogs.flatMap(
    (log) => log.recipes?.recipe_items.map((ri) => ri.menu_items).filter((f): f is LoggedFood => !!f) ?? []
  )

  return (
    <>
      <header>
        <h1 className="text-xl font-semibold">{name ? `Hi, ${name}` : "Hi there"}</h1>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" })}
        </p>
        {traffic.data?.busy_pct != null && <TrafficPill busyPct={traffic.data.busy_pct} />}
      </header>

      <div className="mt-5">
        <FeedMeButton />
      </div>

      <Section title="Today's progress">
        <Card>
          <CardContent>
            <Progress
              mode={profile.data?.mode ?? "balanced"}
              focusNutrients={profile.data?.focus_nutrients ?? []}
              goals={(profile.data?.goals ?? {}) as Record<string, unknown>}
              foods={foods}
              logs={mealLogs}
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Today's meals">
        {mealLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet. Tap Feed me to start.</p>
        ) : (
          <ul className="divide-y border-y bg-card">
            {mealLogs.map((log) => (
              <li key={log.id} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">{log.recipes?.title ?? "Your plate"}</span>
                  <span className="block text-xs text-muted-foreground capitalize">{log.meal_period ?? "Meal"}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(log.created_at).toLocaleTimeString("en-US", {
                    timeZone: TIME_ZONE,
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Plates for you">
        {plates.length === 0 ? (
          <p className="text-sm text-muted-foreground">More plates coming soon.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {plates.slice(0, 3).map((plate) => (
              <Card key={plate.id} size="sm">
                <CardHeader>
                  <CardTitle>{plate.title ?? "Scott plate"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{plate.parts.map((p) => p.item.name).join(" · ")}</p>
                </CardContent>
                <CardFooter>
                  <Link href={`/plate/${plate.id}`} className={buttonVariants({ variant: "outline", className: "h-10 w-full text-sm" })}>
                    View
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <form action="/auth/signout" method="post" className="mt-8 flex justify-center">
        <Button type="submit" variant="ghost" className="text-muted-foreground">
          Sign out
        </Button>
      </form>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function TrafficPill({ busyPct }: { busyPct: number }) {
  const [label, colors] =
    busyPct < 40
      ? ["Quiet", "bg-[#4C9A5A]/15 text-[#2F6B3B] [&>i]:bg-[#4C9A5A]"]
      : busyPct <= 70
        ? ["Moderate", "bg-[#E8B931]/20 text-[#7A5B00] [&>i]:bg-[#E8B931]"]
        : ["Busy", "bg-[#BB0000]/10 text-[#BB0000] [&>i]:bg-[#BB0000]"]
  return (
    <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>
      <i className="size-2 rounded-full" aria-hidden />
      Scott right now: {label}
      <span className="font-normal opacity-75">· Estimated</span>
    </p>
  )
}

function Progress({
  mode,
  focusNutrients,
  goals,
  foods,
  logs,
}: {
  mode: string
  focusNutrients: string[]
  goals: Record<string, unknown>
  foods: LoggedFood[]
  logs: MealLog[]
}) {
  if (mode === "nutrients" && focusNutrients.length > 0) {
    return (
      <>
        <div className="flex flex-wrap justify-around gap-4">
          {focusNutrients.map((nutrient) => {
            const tag = NUTRIENT_TAGS.find((n) => n.focus === nutrient)?.tag
            const count = foods.filter((f) =>
              tag ? (f.nutrient_tags ?? []).includes(tag) : nutrient === "fiber" && (f.fiber_g ?? 0) >= FIBER_GOOD_SOURCE_G
            ).length
            return (
              <ProgressRing
                key={nutrient}
                value={count}
                max={NUTRIENT_GOAL}
                detail={`${count}/${NUTRIENT_GOAL}`}
                label={labelFor(NUTRIENTS, nutrient)}
              />
            )
          })}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Foods logged today that are a good source (estimated). Goal: {NUTRIENT_GOAL} each.
        </p>
      </>
    )
  }

  if (mode === "macros") {
    const total = (key: string) => logs.reduce((sum, log) => sum + (Number(log.totals?.[key]) || 0), 0)
    const goal = (key: string) => {
      const n = Number(goals[key])
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const macros = [
      { key: "protein_g", label: "Protein" },
      { key: "carbs_g", label: "Carbs" },
      { key: "fat_g", label: "Fat" },
    ]
    return (
      <>
        <div className="flex justify-around gap-2">
          {macros.map(({ key, label }) => {
            const value = Math.round(total(key))
            const max = goal(key)
            return (
              <ProgressRing
                key={key}
                value={value}
                max={max}
                detail={`${value}g`}
                label={max ? `${label} / ${max}g` : `${label} (no goal)`}
              />
            )
          })}
        </div>
        <p className="mt-3 text-center text-sm">
          <span className="font-semibold tabular-nums">{Math.round(total("calories"))}</span>{" "}
          <span className="text-muted-foreground">calories today</span>
        </p>
      </>
    )
  }

  const groups = new Set(foods.map((f) => f.food_group))
  const hits = BALANCED_GROUPS.filter((g) => groups.has(g.group))
  const score = Math.round((hits.length / BALANCED_GROUPS.length) * 100)
  return (
    <div className="flex items-center gap-5">
      <p className="shrink-0 text-center">
        <span className="block text-4xl font-semibold text-primary tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">plate score / 100</span>
      </p>
      <ul className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
        {BALANCED_GROUPS.map(({ group, label }) => {
          const hit = groups.has(group)
          return (
            <li key={group} className="flex items-center gap-1.5 text-sm">
              {hit ? (
                <CheckCircleIcon weight="fill" className="size-5 text-[#4C9A5A]" aria-hidden />
              ) : (
                <CircleIcon className="size-5 text-muted-foreground" aria-hidden />
              )}
              {label}
              <span className="sr-only">{hit ? "(logged today)" : "(not yet)"}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  )
}
