"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckIcon } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import type { MealPeriod } from "@/lib/menu-shared"
import type { Totals } from "@/lib/totals"
import { Button, buttonVariants } from "@/components/ui/button"

type Status = "idle" | "pending" | "done"

export function PlateActions({
  recipeId,
  userId,
  meal,
  planDate,
  totals,
  canLog,
  showLog = true,
  retry = true,
}: {
  recipeId: number
  userId: string
  meal: MealPeriod
  planDate: string
  totals: Totals
  canLog: boolean
  /** Show "I ate this". Off for a plate planned for a later day. */
  showLog?: boolean
  /** Show "Another plate" (back to Feed me's plates for this meal). Off for recipe dupes. */
  retry?: boolean
}) {
  const [logged, setLogged] = useState<Status>("idle")
  const [saved, setSaved] = useState<Status>("idle")
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

  return (
    <div className="mt-6 flex flex-col gap-2">
      {showLog && (
        <Button className="h-12 rounded-xl text-base font-bold" onClick={logIt} disabled={!canLog || logged !== "idle"}>
          {logged === "done" ? (
            <>
              <CheckIcon weight="bold" /> Logged. Enjoy!
            </>
          ) : logged === "pending" ? (
            "Logging…"
          ) : (
            "I ate this"
          )}
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-12 flex-1 rounded-xl border-2 border-foreground text-base font-bold"
          onClick={save}
          disabled={!canLog || saved !== "idle"}
        >
          {saved === "done" ? (
            <>
              <CheckIcon weight="bold" /> Planned
            </>
          ) : saved === "pending" ? (
            "Saving…"
          ) : (
            "Save to plan"
          )}
        </Button>
        {retry && (
          <Link
            href={`/feed?meal=${meal}`}
            className={buttonVariants({
              variant: "outline",
              className: "h-12 flex-1 rounded-xl border-2 border-foreground text-base font-bold",
            })}
          >
            Another plate
          </Link>
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
