import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { WarningIcon } from "@phosphor-icons/react/ssr"
import { createClient } from "@/lib/supabase/server"
import { getSafeItems } from "@/lib/menu.server"
import { foodKey, formatDay, isIsoDate, MEAL_PERIODS, type MealPeriod, type MenuItem, todayInColumbus } from "@/lib/menu-shared"
import { NutrientBadges } from "@/components/nutrient-badges"
import { computeTotals, TOTAL_FIELDS, totalsForMode } from "@/lib/totals"
import { BackBar } from "@/components/back-bar"
import { PlatePhoto } from "@/components/plate-photo"
import { platePhotos } from "@/lib/plate-photos"
import { PageContainer } from "@/components/page-container"
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
    menu_items: { name: string; meal_period: MealPeriod | null; served_on: string | null; image_url: string | null } | null
  }[]
}

const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }

async function Plate({ params, searchParams }: PageProps<"/plate/[id]">) {
  const recipeId = Number((await params).id)
  const query = await searchParams
  const asked = query.meal
  // ?date= comes from the meal plan: a plate planned for a later day is
  // checked against that day's menu, not today's.
  const today = todayInColumbus()
  const day = isIsoDate(query.date) ? query.date : today
  const isToday = day === today
  if (!Number.isInteger(recipeId)) notFound()

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, source, blurb, steps, tags, recipe_items(menu_item_id, servings, menu_items(name, meal_period, served_on, image_url))")
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
  // The plate's meal comes from its own tags; ?meal= (from Feed me) picks among them.
  const mealTags = (recipe.tags ?? []).filter(isMealPeriod)
  const taggedMeal = isMealPeriod(asked) && mealTags.includes(asked) ? asked : mealTags[0]
  const curatedMeal = taggedMeal ?? "lunch"
  const todaySafe = curated ? await getSafeItems(userId, curatedMeal, day, { forPlate: true }) : []
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
  const meal: MealPeriod =
    taggedMeal ?? parts.find((p) => isMealPeriod(p.item.meal_period))?.item.meal_period ?? "lunch"
  const photos = platePhotos(recipe.recipe_items.flatMap((ri) => (ri.menu_items ? [ri.menu_items] : [])))

  const take = (servings: number, size: string | null) =>
    `Take ${servings}${size ? ` · ${size}${servings === 1 ? "" : " each"}` : ""}`

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-[0_6px_24px_rgba(31,42,35,0.07)]">
        <BiteNotch />
        <p className="text-sm text-muted-foreground">
          {MEAL_LABELS[meal]} at Scott
          {isToday ? (curated ? ", picked for you" : "") : `, ${formatDay(day, { weekday: "long", month: "short", day: "numeric" })}`}
        </p>
        <h1 className="mt-1 max-w-[85%] text-2xl leading-tight font-extrabold">{recipe.title ?? "Your plate"}</h1>
        {recipe.blurb && <p className="mt-2 text-[0.9375rem] leading-relaxed">{recipe.blurb}</p>}
        {stops.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {stops.length === 1 ? "One stop" : `${stops.length} stops, in walking order`}
          </p>
        )}
      </section>

      {unsafeNames.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-destructive" weight="fill" />
          <p>
            {unsafeNames.join(", ")} {unsafeNames.length === 1 ? "isn't" : "aren't"} safe for you or{" "}
            {unsafeNames.length === 1 ? "isn't" : "aren't"} on {isToday ? "today's" : `${formatDay(day, { weekday: "long" })}'s`} menu, so{" "}
            {unsafeNames.length === 1 ? "it's" : "they're"} hidden. Pick another plate.
          </p>
        </div>
      )}

      <h2 className="sr-only">Your route</h2>
      <ol className="mt-5 flex flex-col">
        {stops.map((stop, i) => (
          <li key={`${stop.station}-${i}`} className="flex gap-3.5">
            <div className="flex flex-col items-center" aria-hidden>
              <StopMarker n={i + 1} />
              {i < stops.length - 1 && <span className="w-[3px] flex-1 rounded-full bg-buckeye" />}
            </div>
            <div className="min-w-0 flex-1 pt-2 pb-5">
              <h3 className="text-[1.0625rem] font-bold">
                <span className="sr-only">Stop {i + 1}: </span>
                {stop.station}
              </h3>
              <ul className="mt-1.5 flex flex-col gap-2">
                {stop.items.map(({ item, servings }) => (
                  <li key={item.id}>
                    <p className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                      <span className="font-medium">{item.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">{take(servings, item.serving_size)}</span>
                    </p>
                    <NutrientBadges tags={item.nutrient_tags} className="mt-0.5" />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      {parts.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-6 border-t pt-4 sm:grid-cols-4">
          {shown.map((key) => (
            <div key={key} className="py-1">
              <dt className="text-sm text-muted-foreground">{TOTAL_FIELDS[key].label}</dt>
              <dd className="font-heading text-xl font-extrabold tabular-nums">
                {Math.round(totals[key])}
                {TOTAL_FIELDS[key].unit && (
                  <span className="font-sans text-sm font-normal text-muted-foreground"> {TOTAL_FIELDS[key].unit}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {photos.length > 0 && <PlatePhoto photos={photos} className="mt-5 aspect-[16/9] w-full rounded-2xl" />}

      <PlateActions
        recipeId={recipe.id}
        userId={userId}
        meal={meal}
        planDate={day}
        showLog={isToday}
        totals={totals}
        canLog={parts.length > 0 && unsafeNames.length === 0}
        retry={curated && isToday}
      />
    </>
  )
}

/** The logo's bite, cut from the hero card's top-right corner. */
function BiteNotch() {
  return (
    <>
      <span aria-hidden className="absolute -top-5 -right-5 size-14 rounded-full bg-background" />
      <span aria-hidden className="absolute top-0.5 right-7 size-8 rounded-full bg-background" />
    </>
  )
}

/** A numbered buckeye: one per station on the route. */
function StopMarker({ n }: { n: number }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-buckeye">
      <span className="flex size-6 items-center justify-center rounded-full bg-nut font-heading text-[0.8125rem] font-extrabold text-buckeye">
        {n}
      </span>
    </span>
  )
}

export default function PlatePage({ params, searchParams }: PageProps<"/plate/[id]">) {
  return (
    <PageContainer narrow>
      <BackBar />
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading your plate…</p>}>
        <Plate params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}
