"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HeartIcon } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { formatDay, NUTRIENT_TAGS, type MealPeriod } from "@/lib/menu-shared"
import type { RecipeCard, RecipeDiet } from "@/lib/recipes-shared"
import { NutrientBadges } from "@/components/nutrient-badges"
import { PlatePhoto } from "@/components/plate-photo"

const MEALS: { value: MealPeriod; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
]
const DIETS: { value: RecipeDiet; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal_friendly", label: "Halal-friendly" },
]
const NUTRIENTS = NUTRIENT_TAGS.map((n) => ({ value: n.tag as string, label: n.label as string }))
const WHEN = [{ value: "today" as const, label: "On today's menu" }]

/** Ready-made plates open on the day and meal they're next served; the plate page checks that menu. */
function plateHref(card: RecipeCard) {
  if (!card.next) return `/plate/${card.id}`
  const params = new URLSearchParams(card.next.today ? { meal: card.next.meal } : { date: card.next.date, meal: card.next.meal })
  return `/plate/${card.id}?${params}`
}

export function RecipeBook({
  userId,
  cards,
  savedIds,
}: {
  userId: string
  cards: RecipeCard[]
  /** null when saving isn't available (saved_recipes table missing). */
  savedIds: number[] | null
}) {
  const [tab, setTab] = useState<"all" | "liked">("all")
  const [meal, setMeal] = useState<MealPeriod | null>(null)
  const [diet, setDiet] = useState<RecipeDiet | null>(null)
  const [nutrient, setNutrient] = useState<string | null>(null)
  const [when, setWhen] = useState<"today" | null>(null)
  const [saved, setSaved] = useState(() => new Set(savedIds ?? []))
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(
    () =>
      cards.filter(
        (c) =>
          (tab === "all" || saved.has(c.id)) &&
          (!meal || c.meals.includes(meal)) &&
          (!diet || c.diets.includes(diet)) &&
          (!nutrient || c.nutrientTags.includes(nutrient)) &&
          (!when || !c.next || c.next.today)
      ),
    [cards, tab, saved, meal, diet, nutrient, when]
  )

  async function toggleSave(recipeId: number) {
    const wasSaved = saved.has(recipeId)
    const flip = (on: boolean) =>
      setSaved((s) => {
        const next = new Set(s)
        if (on) next.add(recipeId)
        else next.delete(recipeId)
        return next
      })
    flip(!wasSaved)
    setError(null)

    const table = createClient().from("saved_recipes")
    const { error } = wasSaved
      ? await table.delete().eq("user_id", userId).eq("recipe_id", recipeId)
      : await table.upsert({ user_id: userId, recipe_id: recipeId }, { ignoreDuplicates: true })
    if (error) {
      flip(wasSaved)
      setError("Couldn't update your liked plates. Try again.")
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div role="tablist" aria-label="Recipe book" className="flex w-fit gap-1 rounded-full bg-muted p-1">
        {(
          [
            ["all", "All plates"],
            ["liked", `Liked${savedIds === null ? "" : ` (${cards.filter((c) => saved.has(c.id)).length})`}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${
              tab === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "liked" && <HeartIcon className="size-4" weight={tab === value ? "fill" : "regular"} aria-hidden />}
            {label}
          </button>
        ))}
      </div>
      <FilterRow label="When" options={WHEN} value={when} onChange={setWhen} />
      <FilterRow label="Meal" options={MEALS} value={meal} onChange={setMeal} />
      <FilterRow label="Diet" options={DIETS} value={diet} onChange={setDiet} />
      <FilterRow label="Nutrient" options={NUTRIENTS} value={nutrient} onChange={setNutrient} />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {tab === "liked" && ![...saved].some((id) => cards.some((c) => c.id === id))
            ? savedIds === null
              ? "Liking plates isn't set up yet."
              : "Tap the heart on a plate to keep it here. Liked plates show up on days they fit Scott's menu."
            : cards.length === 0
              ? "No plates fit you on this week's menu yet."
              : "No recipes match these filters."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((card) => {
            const isSaved = saved.has(card.id)
            return (
              <li key={card.id} className="relative overflow-hidden rounded-2xl bg-card p-4 hover:bg-muted/40">
                <PlatePhoto photos={card.photos} className="-mx-4 -mt-4 mb-3 aspect-[16/9]" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={plateHref(card)}
                      className="text-sm font-semibold after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {card.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {card.source === "dupe"
                        ? "From your recipe link"
                        : card.source === "ai"
                          ? "Your AI plate"
                          : [
                              card.next && (card.next.today ? "Today" : `Next: ${formatDay(card.next.date)}`),
                              card.meals.join(" · "),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSave(card.id)}
                    disabled={savedIds === null}
                    aria-pressed={isSaved}
                    aria-label={isSaved ? `Unlike ${card.title}` : `Like ${card.title}`}
                    title={savedIds === null ? "Liking isn't set up yet" : undefined}
                    className="relative z-10 -m-1.5 flex size-11 shrink-0 items-center justify-center text-primary disabled:opacity-40"
                  >
                    <HeartIcon className="size-5" weight={isSaved ? "fill" : "regular"} />
                    <span className="sr-only">{isSaved ? "Liked" : "Like"}</span>
                  </button>
                </div>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {card.items.slice(0, 4).map((item, i) => (
                    <li key={`${item.name}-${i}`} className="text-sm">
                      {item.name}
                      {item.station && <span className="text-xs text-muted-foreground"> · {item.station}</span>}
                    </li>
                  ))}
                </ul>
                <NutrientBadges tags={card.nutrientTags} className="mt-2" />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
}) {
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4" role="group" aria-label={label}>
      <span className="w-16 shrink-0 text-sm font-semibold text-muted-foreground">{label}</span>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : o.value)}
            className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              on ? "bg-accent text-primary" : "bg-card text-foreground hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
