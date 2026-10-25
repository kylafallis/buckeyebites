"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleNotchIcon } from "@phosphor-icons/react"
import { MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import { requestPlate } from "@/lib/request-plate"
import { Button } from "@/components/ui/button"

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const STORAGE_KEY = "bb:feed-me-meal"

/**
 * Feed me with Breakfast / Lunch / Dinner chips. Starts on `defaultMeal` (the
 * current meal), then on the last meal picked on this device.
 */
export function FeedMeButton({ defaultMeal }: { defaultMeal: MealPeriod }) {
  const router = useRouter()
  const [meal, setMeal] = useState<MealPeriod>(defaultMeal)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembered, but still used for this tap.
    }
  }

  async function feedMe() {
    setPending(true)
    setError(null)
    try {
      router.push(`/plate/${await requestPlate(undefined, { meal })}?meal=${meal}`)
    } catch (e) {
      setError((e as Error).message)
      setPending(false)
    }
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
              className={`h-9 rounded-full border text-sm font-medium transition-colors ${
                on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {MEAL_LABELS[m]}
            </button>
          )
        })}
      </div>
      <Button onClick={feedMe} disabled={pending} className="h-16 w-full text-lg font-semibold">
        {pending ? (
          <>
            <CircleNotchIcon className="size-5 animate-spin" />
            Building your plate...
          </>
        ) : (
          "Feed me"
        )}
      </Button>
      <p className="sr-only" aria-live="polite">
        {pending ? "Building your plate" : ""}
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
