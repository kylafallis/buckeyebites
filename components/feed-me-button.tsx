"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleNotchIcon, ForkKnifeIcon } from "@phosphor-icons/react"
import { MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const STORAGE_KEY = "bb:feed-me-meal"

/**
 * Feed me with Breakfast / Lunch / Dinner chips. Starts on `defaultMeal` (the
 * current meal), then on the last meal picked on this device. Opens /feed,
 * where the safe plates for that meal can be swiped through.
 */
export function FeedMeButton({ defaultMeal }: { defaultMeal: MealPeriod }) {
  const router = useRouter()
  const [meal, setMeal] = useState<MealPeriod>(defaultMeal)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount; localStorage isn't available during SSR
      if (MEAL_PERIODS.includes(saved as MealPeriod)) setMeal(saved as MealPeriod)
    } catch {
      // Storage blocked (private mode etc.): keep the current meal.
    }
  }, [])

  function choose(next: MealPeriod) {
    setMeal(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembered, but still used for this tap.
    }
  }

  function feedMe() {
    setPending(true)
    router.push(`/feed?meal=${meal}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Meal">
        {MEAL_PERIODS.map((m) => {
          const on = m === meal
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(m)}
              disabled={pending}
              className={`h-10 rounded-full text-sm font-semibold transition-colors ${
                on ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {MEAL_LABELS[m]}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={feedMe}
        disabled={pending}
        className="flex h-16 w-full items-center gap-3 rounded-full bg-buckeye pr-6 pl-2 text-left font-heading text-xl font-extrabold text-white transition-transform active:scale-[0.98] disabled:opacity-80"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-nut text-buckeye" aria-hidden>
          {pending ? <CircleNotchIcon className="size-6 animate-spin" /> : <ForkKnifeIcon className="size-6" weight="bold" />}
        </span>
        <span className="flex-1">{pending ? "Finding plates…" : "Feed me"}</span>
        <span className="text-sm font-semibold text-nut">{MEAL_LABELS[meal]}</span>
      </button>
      <p className="sr-only" aria-live="polite">
        {pending ? "Finding plates that fit you" : ""}
      </p>
    </div>
  )
}
