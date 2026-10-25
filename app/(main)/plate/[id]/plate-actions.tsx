"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CircleNotchIcon } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { requestPlate } from "@/lib/request-plate"
import type { MealPeriod } from "@/lib/menu-shared"
import type { Totals } from "@/lib/totals"
import { Button } from "@/components/ui/button"

type Status = "idle" | "pending" | "done"

export function PlateActions({
  recipeId,
  userId,
  meal,
  planDate,
  totals,
  canLog,
  retry = true,
}: {
  recipeId: number
  userId: string
  meal: MealPeriod
  planDate: string
  totals: Totals
  canLog: boolean
  /** Show "Try again" (a new Feed me plate). Off for recipe dupes. */
  retry?: boolean
}) {
  const router = useRouter()
  const [logged, setLogged] = useState<Status>("idle")
  const [saved, setSaved] = useState<Status>("idle")
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(setStatus: (s: Status) => void, write: () => PromiseLike<{ error: unknown }>) {
    setStatus("pending")
    setError(null)
    const { error } = await write()
    if (error) {
      setError("Couldn't save that. Try again.")
      setStatus("idle")
    } else {
      setStatus("done")
    }
  }

  const logIt = () =>
    run(setLogged, () =>
      createClient()
        .from("meal_logs")
        // eaten_on defaults to the database's (UTC) date, so set the Columbus date.
        .insert({ user_id: userId, eaten_on: planDate, meal_period: meal, recipe_id: recipeId, totals })
    )

  const save = () =>
    run(setSaved, () =>
      createClient()
        .from("meal_plans")
        .insert({ user_id: userId, plan_date: planDate, meal_period: meal, recipe_id: recipeId })
    )

  async function tryAgain() {
    setRetrying(true)
    setError(null)
    try {
      router.push(`/plate/${await requestPlate(recipeId)}`)
    } catch (e) {
      setError((e as Error).message)
      setRetrying(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button className="h-12 text-sm" onClick={logIt} disabled={!canLog || logged !== "idle"}>
        {logged === "done" ? (
          <>
            <CheckIcon weight="bold" /> Logged
          </>
        ) : logged === "pending" ? (
          "Logging…"
        ) : (
          "Log it"
        )}
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" className="h-12 flex-1 text-sm" onClick={save} disabled={!canLog || saved !== "idle"}>
          {saved === "done" ? (
            <>
              <CheckIcon weight="bold" /> Saved to plan
            </>
          ) : saved === "pending" ? (
            "Saving…"
          ) : (
            "Save"
          )}
        </Button>
        {retry && (
          <Button variant="outline" className="h-12 flex-1 text-sm" onClick={tryAgain} disabled={retrying}>
            {retrying ? (
              <>
                <CircleNotchIcon className="animate-spin" /> Building your plate...
              </>
            ) : (
              "Try again"
            )}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
