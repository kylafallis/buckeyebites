"use client"

import { useMemo, useState } from "react"
import { CaretRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { foodKey, MEAL_PERIODS, type MealPeriod, type MenuItem } from "@/lib/menu-shared"
import { ALLERGENS, labelFor } from "@/lib/preferences"
import { NutrientBadges } from "@/components/nutrient-badges"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const PERIOD_LABELS: Record<MealPeriod, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
}

const tagLabel = (tag: string) => tag.replaceAll("_", " ")

/** Likes and times eaten per food, keyed by foodKey, from every student. */
export type Popularity = Record<string, { likes: number; eaten: number }>

const POPULAR_LIMIT = 20

type Tab = MealPeriod | "popular"
type PopularItem = { item: MenuItem; meals: MealPeriod[]; likes: number; eaten: number }

/** Today's foods students like or eat most, across all meals, one row per food. */
function popularToday(menus: Record<MealPeriod, MenuItem[]>, popularity: Popularity): PopularItem[] {
  const byFood = new Map<string, PopularItem>()
  for (const meal of MEAL_PERIODS) {
    for (const item of menus[meal]) {
      const key = foodKey(item.name)
      const stats = popularity[key]
      if (!stats || stats.likes + stats.eaten === 0) continue
      const entry = byFood.get(key)
      if (!entry) byFood.set(key, { item, meals: [meal], ...stats })
      else if (!entry.meals.includes(meal)) entry.meals.push(meal)
    }
  }
  return [...byFood.values()]
    .sort((a, b) => b.likes + b.eaten - (a.likes + a.eaten) || a.item.name.localeCompare(b.item.name))
    .slice(0, POPULAR_LIMIT)
}

/** The search box and diet chips. */
function matchesFilters(item: MenuItem, query: string, tags: string[]) {
  const q = query.trim().toLowerCase()
  return (!q || item.name.toLowerCase().includes(q)) && tags.every((t) => item.diet_tags.includes(t))
}

export function MenuBrowser({
  menus,
  defaultPeriod,
  showCalories,
  popularity,
}: {
  menus: Record<MealPeriod, MenuItem[]>
  defaultPeriod: MealPeriod
  showCalories: boolean
  /** null when the popular-foods view isn't set up yet. */
  popularity: Popularity | null
}) {
  const [period, setPeriod] = useState<Tab>(defaultPeriod)
  const [query, setQuery] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [selected, setSelected] = useState<MenuItem | null>(null)

  const popular = useMemo(() => (popularity ? popularToday(menus, popularity) : []), [menus, popularity])
  const items = useMemo(() => (period === "popular" ? popular.map((p) => p.item) : menus[period]), [period, popular, menus])

  // Chips come from the tags present in this meal, minus "contains_*" warnings.
  const availableTags = useMemo(
    () =>
      [...new Set(items.flatMap((i) => i.diet_tags))]
        .filter((t) => !t.startsWith("contains_"))
        .sort(),
    [items]
  )

  const stations = useMemo(() => {
    const groups = new Map<string, MenuItem[]>()
    for (const item of items) {
      if (!matchesFilters(item, query, tags)) continue
      const station = item.station?.name ?? "Other"
      groups.set(station, [...(groups.get(station) ?? []), item])
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b))
  }, [items, query, tags])

  const toggleTag = (tag: string) =>
    setTags((ts) => (ts.includes(tag) ? ts.filter((t) => t !== tag) : [...ts, tag]))

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Tabs
        value={period}
        onValueChange={(value) => {
          setPeriod(value as Tab)
          setTags([])
        }}
      >
        <TabsList className="w-full group-data-horizontal/tabs:h-10">
          {(Object.keys(PERIOD_LABELS) as MealPeriod[]).map((p) => (
            <TabsTrigger key={p} value={p} className="text-sm">
              {PERIOD_LABELS[p]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="popular" className="text-sm">
            Popular
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <label className="relative">
        <span className="sr-only">Search the menu</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search dishes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 pl-9 text-base md:text-sm"
        />
      </label>

      {availableTags.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Diet filters">
          {availableTags.map((tag) => {
            const on = tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={`h-8 shrink-0 border px-3 text-xs font-medium capitalize transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                }`}
              >
                {tagLabel(tag)}
              </button>
            )
          })}
        </div>
      )}

      {period === "popular" ? (
        <PopularList
          rows={popular.filter((p) => matchesFilters(p.item, query, tags))}
          state={popularity === null ? "missing" : popular.length === 0 ? "empty" : "ready"}
          showCalories={showCalories}
          onSelect={setSelected}
        />
      ) : stations.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? `No ${PERIOD_LABELS[period].toLowerCase()} items for you today.`
            : "Nothing matches your search."}
        </p>
      ) : (
        stations.map(([station, stationItems]) => (
          <section key={station} aria-label={station}>
            <h2
              className="pt-3 pb-1 font-heading text-lg font-extrabold text-foreground"
            >
              {station}
            </h2>
            <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {stationItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex h-full min-h-14 w-full items-center gap-3 border bg-card px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{item.name}</span>
                      {item.diet_tags.some((t) => !t.startsWith("contains_")) && (
                        <span className="block text-xs text-muted-foreground capitalize">
                          {item.diet_tags.filter((t) => !t.startsWith("contains_")).map(tagLabel).join(" · ")}
                        </span>
                      )}
                      <NutrientBadges tags={item.nutrient_tags} className="mt-1" />
                    </span>
                    {showCalories && item.calories != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(item.calories)} cal
                      </span>
                    )}
                    <CaretRightIcon className="size-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-md overflow-y-auto">
          {selected && <ItemDetails item={selected} showCalories={showCalories} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** The Popular tab: today's foods ranked by student likes and meals eaten. */
function PopularList({
  rows,
  state,
  showCalories,
  onSelect,
}: {
  rows: PopularItem[]
  state: "missing" | "empty" | "ready"
  showCalories: boolean
  onSelect: (item: MenuItem) => void
}) {
  if (state !== "ready" || rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {state === "missing"
          ? "Popular foods aren't set up yet."
          : state === "empty"
            ? "None of today's foods have likes yet."
            : "Nothing matches your search."}
      </p>
    )
  }
  return (
    <section aria-label="Popular among students">
      <h2 className="pt-3 font-heading text-lg font-extrabold text-foreground">Popular among students</h2>
      <p className="pb-2 text-xs text-muted-foreground">
        Today&apos;s foods that fit you, ranked by likes on the swipe deck and meals logged. Includes simulated demo
        students.
      </p>
      <ol className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ item, meals, likes, eaten }, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex h-full min-h-14 w-full items-center gap-3 border bg-card px-3 py-2 text-left hover:bg-muted"
            >
              <span className="w-6 shrink-0 text-center font-heading text-lg font-extrabold text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{item.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[item.station?.name, meals.map((m) => PERIOD_LABELS[m]).join(", ")].filter(Boolean).join(" · ")}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {[likes > 0 && `${likes} ${likes === 1 ? "like" : "likes"}`, eaten > 0 && `eaten ${eaten}×`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {showCalories && item.calories != null && (
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(item.calories)} cal</span>
              )}
              <CaretRightIcon className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ItemDetails({ item, showCalories }: { item: MenuItem; showCalories: boolean }) {
  const rows: [string, number | null, string][] = [
    ...(showCalories ? [["Calories", item.calories, ""] as [string, number | null, string]] : []),
    ["Protein", item.protein_g, "g"],
    ["Carbs", item.carbs_g, "g"],
    ["Fat", item.fat_g, "g"],
    ["Sugar", item.sugar_g, "g"],
    ["Fiber", item.fiber_g, "g"],
    ["Sodium", item.sodium_mg, "mg"],
    ["Iron", item.iron_mg, "mg"],
    ["Calcium", item.calcium_mg, "mg"],
    ["Vitamin D", item.vit_d_mcg, "mcg"],
  ]

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="text-base">{item.name}</SheetTitle>
        <SheetDescription>
          {[item.station?.name, item.serving_size].filter(Boolean).join(" · ")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-4 pb-6">
        <section>
          <h3 className="mb-1.5 text-base font-bold">
            Allergens
          </h3>
          {item.allergens.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.allergens.map((a) => (
                <Badge key={a} variant="outline">
                  {labelFor(ALLERGENS, a)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">None listed</p>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 text-base font-bold">
            Nutrition
          </h3>
          <NutrientBadges tags={item.nutrient_tags} className="mb-2" />
          <dl className="divide-y border-y text-sm">
            {rows.map(([label, value, unit]) => (
              <div key={label} className="flex justify-between py-1.5">
                <dt>{label}</dt>
                <dd className="tabular-nums">
                  {value == null ? "—" : `${Math.round(value * 10) / 10}${unit && ` ${unit}`}`}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs">
          Recipes can change and cross-contact can happen. Confirm with Scott staff.
        </p>
      </div>
    </>
  )
}
