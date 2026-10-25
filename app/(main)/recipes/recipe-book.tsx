"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HeartIcon } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { NUTRIENT_TAGS, type MealPeriod } from "@/lib/menu-shared"
import type { RecipeCard, RecipeDiet } from "@/lib/recipes-shared"
import { NutrientBadges } from "@/components/nutrient-badges"

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
  const [meal, setMeal] = useState<MealPeriod | null>(null)
  const [diet, setDiet] = useState<RecipeDiet | null>(null)
  const [nutrient, setNutrient] = useState<string | null>(null)
  const [saved, setSaved] = useState(() => new Set(savedIds ?? []))
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(
    () =>
      cards.filter(
        (c) =>
          (!meal || c.meals.includes(meal)) &&
          (!diet || c.diets.includes(diet)) &&
          (!nutrient || c.nutrientTags.includes(nutrient))
      ),
    [cards, meal, diet, nutrient]
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
      setError("Couldn't update your saved recipes. Try again.")
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
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
          {cards.length === 0 ? "No plates fit you on today's menu yet." : "No recipes match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((card) => {
            const isSaved = saved.has(card.id)
            return (
              <li key={card.id} className="relative border bg-card p-4 hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/plate/${card.id}`}
                      className="text-sm font-semibold after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {card.title}
                    </Link>
                    <p className="text-xs text-muted-foreground capitalize">
                      {card.source === "ai" ? "Your AI plate" : card.meals.join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSave(card.id)}
                    disabled={savedIds === null}
                    aria-pressed={isSaved}
                    aria-label={isSaved ? `Unsave ${card.title}` : `Save ${card.title}`}
                    title={savedIds === null ? "Saving isn't set up yet" : undefined}
                    className="relative z-10 -m-1 flex size-9 shrink-0 items-center justify-center text-primary disabled:opacity-40"
                  >
                    <HeartIcon className="size-5" weight={isSaved ? "fill" : "regular"} />
                    <span className="sr-only">{isSaved ? "Saved" : "Save"}</span>
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
      <span className="w-16 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : o.value)}
            className={`h-8 shrink-0 border px-3 text-xs font-medium transition-colors ${
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
