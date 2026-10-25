import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { WarningIcon } from "@phosphor-icons/react/ssr"
import { createClient } from "@/lib/supabase/server"
import { getSafeItems } from "@/lib/menu.server"
import { currentMealPeriod, MEAL_PERIODS, todayInColumbus, type MealPeriod, type MenuItem } from "@/lib/menu-shared"
import { foodKey } from "@/lib/plate"
import { NutrientBadges } from "@/components/nutrient-badges"
import { computeTotals, TOTAL_FIELDS, totalsForMode } from "@/lib/totals"
import { PlateActions } from "./plate-actions"

export const metadata: Metadata = {
  title: "Your plate · BuckeyeBites",
}

type RecipeRow = {
  id: number
  title: string | null
  source: string | null
  blurb: string | null
  steps: string[] | null
  tags: string[] | null
  recipe_items: {
    menu_item_id: number
    servings: number | null
    menu_items: { name: string; meal_period: MealPeriod | null; served_on: string | null } | null
  }[]
}

const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

async function Plate({ params }: { params: Promise<{ id: string }> }) {
  const recipeId = Number((await params).id)
  if (!Number.isInteger(recipeId)) notFound()

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, source, blurb, steps, tags, recipe_items(menu_item_id, servings, menu_items(name, meal_period, served_on))")
      .eq("id", recipeId)
      .maybeSingle(),
    supabase.from("profiles").select("mode, focus_nutrients").eq("id", userId).maybeSingle(),
  ])
  const recipe = data as RecipeRow | null
  if (!recipe) notFound()

  // Item details come only from getSafeItems, so anything unsafe for this
  // user (e.g. a plate someone else generated) is flagged, not shown as food.
  // Ready-made plates are matched by food name to today's menu for their meal;
  // other plates use the exact menu rows they were saved with.
  const curated = recipe.source === "curated"
  const curatedMeal = recipe.tags?.find(isMealPeriod) ?? currentMealPeriod()
  const todaySafe = curated ? await getSafeItems(userId, curatedMeal, todayInColumbus(), { forPlate: true }) : []
  const todayByName = new Map(todaySafe.map((i) => [foodKey(i.name), i]))
  const menus = curated ? [] : [
    ...new Set(
      recipe.recipe_items
        .map((ri) => ri.menu_items)
        .filter((m) => m && isMealPeriod(m.meal_period) && m.served_on)
        .map((m) => `${m!.meal_period}|${m!.served_on}`)
    ),
  ]
  const safeLists = await Promise.all(
    menus.map((key) => {
      const [period, date] = key.split("|")
      return getSafeItems(userId, period as MealPeriod, date)
    })
  )
  const safeById = new Map(safeLists.flat().map((i) => [i.id, i]))
  const resolve = (ri: RecipeRow["recipe_items"][number]) =>
    curated
      ? ri.menu_items
        ? todayByName.get(foodKey(ri.menu_items.name))
        : undefined
      : safeById.get(ri.menu_item_id)

  const steps = recipe.steps ?? []
  const stationRank = (item: MenuItem) => {
    const i = steps.indexOf(item.station?.name ?? "")
    return i === -1 ? steps.length : i
  }
  const parts = recipe.recipe_items
    .map((ri) => ({ item: resolve(ri), servings: ri.servings ?? 1, name: ri.menu_items?.name }))
    .filter((p): p is { item: MenuItem; servings: number; name: string | undefined } => !!p.item)
    .sort((a, b) => stationRank(a.item) - stationRank(b.item))
  const unsafeNames = recipe.recipe_items
    .filter((ri) => !resolve(ri))
    .map((ri) => ri.menu_items?.name ?? "An item")

  // Group consecutive items by station to get walking-order stops.
  const stops: { station: string; items: typeof parts }[] = []
  for (const part of parts) {
    const station = part.item.station?.name ?? "Other"
    const last = stops.at(-1)
    if (last?.station === station) last.items.push(part)
    else stops.push({ station, items: [part] })
  }

  const totals = computeTotals(parts)
  const shown = totalsForMode(profile?.mode ?? "balanced", profile?.focus_nutrients ?? [])
  const meal =
    recipe.tags?.find(isMealPeriod) ?? parts.find((p) => isMealPeriod(p.item.meal_period))?.item.meal_period ?? "lunch"

  return (
    <>
      <h1 className="text-xl font-semibold">{recipe.title ?? "Your plate"}</h1>
      <p className="text-sm text-muted-foreground capitalize">{meal} at Scott</p>

      {unsafeNames.length > 0 && (
        <div className="mt-4 flex gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-destructive" weight="fill" />
          <p>
            {unsafeNames.join(", ")} {unsafeNames.length === 1 ? "isn't" : "aren't"} safe for you or{" "}
            {unsafeNames.length === 1 ? "isn't" : "aren't"} on today&apos;s menu, so{" "}
            {unsafeNames.length === 1 ? "it's" : "they're"} hidden. Try again for a new plate.
          </p>
        </div>
      )}

      <ol className="mt-5 flex flex-col gap-3">
        {stops.map((stop, i) => (
          <li key={`${stop.station}-${i}`} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{stop.station}</p>
              <ul>
                {stop.items.map(({ item, servings }) => (
                  <li key={item.id} className="text-sm font-medium">
                    {item.name}
                    {servings !== 1 && <span className="text-muted-foreground"> × {servings}</span>}
                    <NutrientBadges tags={item.nutrient_tags} className="mt-0.5 font-normal" />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      {recipe.blurb && (
        <section className="mt-5 border-l-2 border-primary bg-primary/5 px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">Why this fits</h2>
          <p className="mt-0.5 text-sm">{recipe.blurb}</p>
        </section>
      )}

      {parts.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2">
          {shown.map((key) => (
            <div key={key} className="border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{TOTAL_FIELDS[key].label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {Math.round(totals[key])}
                {TOTAL_FIELDS[key].unit && (
                  <span className="text-sm font-normal text-muted-foreground"> {TOTAL_FIELDS[key].unit}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <PlateActions
        recipeId={recipe.id}
        userId={userId}
        meal={meal}
        planDate={todayInColumbus()}
        totals={totals}
        canLog={parts.length > 0 && unsafeNames.length === 0}
      />
    </>
  )
}

export default function PlatePage({ params }: PageProps<"/plate/[id]">) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading your plate…</p>}>
        <Plate params={params} />
      </Suspense>
    </main>
  )
}
