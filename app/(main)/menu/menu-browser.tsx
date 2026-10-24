"use client"

import { useMemo, useState } from "react"
import { CaretRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import type { MealPeriod, MenuItem } from "@/lib/menu-shared"
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

export function MenuBrowser({
  menus,
  defaultPeriod,
  showCalories,
}: {
  menus: Record<MealPeriod, MenuItem[]>
  defaultPeriod: MealPeriod
  showCalories: boolean
}) {
  const [period, setPeriod] = useState<MealPeriod>(defaultPeriod)
  const [query, setQuery] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [selected, setSelected] = useState<MenuItem | null>(null)

  const items = menus[period]

  // Chips come from the tags present in this meal, minus "contains_*" warnings.
  const availableTags = useMemo(
    () =>
      [...new Set(items.flatMap((i) => i.diet_tags))]
        .filter((t) => !t.startsWith("contains_"))
        .sort(),
    [items]
  )

  const stations = useMemo(() => {
    const q = query.trim().toLowerCase()
    const groups = new Map<string, MenuItem[]>()
    for (const item of items) {
      if (q && !item.name.toLowerCase().includes(q)) continue
      if (!tags.every((t) => item.diet_tags.includes(t))) continue
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
          setPeriod(value as MealPeriod)
          setTags([])
        }}
      >
        <TabsList className="w-full group-data-horizontal/tabs:h-10">
          {(Object.keys(PERIOD_LABELS) as MealPeriod[]).map((p) => (
            <TabsTrigger key={p} value={p} className="text-sm">
              {PERIOD_LABELS[p]}
            </TabsTrigger>
          ))}
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

      {stations.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? `No ${PERIOD_LABELS[period].toLowerCase()} items for you today.`
            : "Nothing matches your search."}
        </p>
      ) : (
        stations.map(([station, stationItems]) => (
          <section key={station} aria-label={station}>
            <h2
              className="pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {station}
            </h2>
            <ul className="divide-y border-y bg-card">
              {stationItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
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
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
