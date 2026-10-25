"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleNotchIcon, ForkKnifeIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { formatDay, MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import type { RecipeCard } from "@/lib/recipes-shared"
import { requestPlate } from "@/lib/request-plate"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { clearSlot, loadSlotOptions, setSlot } from "./actions"

export type Slots = Record<string, { recipeId: number; title: string }>
/** Today's logged meals, by meal. */
export type Logged = Partial<Record<MealPeriod, { recipeId: number | null; title: string }>>

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const key = (date: string, meal: MealPeriod) => `${date}|${meal}`

type Picker = { date: string; meal: MealPeriod }
type Options = { state: "loading" } | { state: "error"; error: string } | { state: "ready"; plates: RecipeCard[] }

/**
 * Plan, layout C: a strip of the next 7 days, then the chosen day's three
 * meals in order. Today shows what was eaten, and the current meal gets a
 * Feed me card when nothing is planned for it.
 */
export function DayPlan({
  dates,
  initialSlots,
  logged,
  currentMeal,
}: {
  dates: string[]
  initialSlots: Slots
  logged: Logged
  currentMeal: MealPeriod
}) {
  const [slots, setSlots] = useState(initialSlots)
  const [day, setDay] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [picker, setPicker] = useState<Picker | null>(null)
  const [options, setOptions] = useState<Options>({ state: "loading" })
  const [saving, setSaving] = useState<"pick" | number | null>(null)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const date = dates[day]
  const isToday = day === 0
  const nowIndex = MEAL_PERIODS.indexOf(currentMeal)
  const dayLabel = (d: string) => (d === dates[0] ? "today" : formatDay(d, { weekday: "long" }))

  async function openPicker(meal: MealPeriod) {
    setPicker({ date, meal })
    setOptions({ state: "loading" })
    setPickerError(null)
    const result = await loadSlotOptions(date, meal)
    setOptions(result.ok ? { state: "ready", plates: result.value } : { state: "error", error: result.error })
  }

  async function choose(recipeId: number | "pick") {
    if (!picker) return
    setSaving(recipeId)
    setPickerError(null)
    try {
      const id = recipeId === "pick" ? await requestPlate(undefined, picker) : recipeId
      const result = await setSlot(picker.date, picker.meal, id)
      if (!result.ok) throw new Error(result.error)
      setSlots((s) => ({ ...s, [key(picker.date, picker.meal)]: result.value }))
      setPicker(null)
    } catch (e) {
      setPickerError((e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  async function remove(meal: MealPeriod) {
    const k = key(date, meal)
    setBusy(k)
    setError(null)
    const result = await clearSlot(date, meal)
    if (result.ok) {
      setSlots((s) => {
        const next = { ...s }
        delete next[k]
        return next
      })
    } else {
      setError(result.error)
    }
    setBusy(null)
  }

  return (
    <>
      <header>
        <p className="text-sm text-muted-foreground">{formatDay(date, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="text-3xl font-extrabold">{isToday ? "Today at Scott" : `${formatDay(date, { weekday: "long" })} at Scott`}</h1>
      </header>

      <nav aria-label="Day" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {dates.map((d, i) => {
          const on = i === day
          const planned = MEAL_PERIODS.filter((m) => slots[key(d, m)]).length
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(i)}
              aria-pressed={on}
              aria-label={`${formatDay(d, { weekday: "long", month: "long", day: "numeric" })}, ${planned} of 3 meals planned`}
              className={`flex min-w-14 shrink-0 flex-col items-center rounded-2xl px-2 py-2 transition-colors ${
                on ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted"
              }`}
            >
              <span className={`text-xs font-semibold ${on ? "" : "text-muted-foreground"}`}>
                {i === 0 ? "Today" : formatDay(d, { weekday: "short" })}
              </span>
              <span className="font-heading text-lg font-extrabold">{formatDay(d, { day: "numeric" })}</span>
              <span className="mt-0.5 flex gap-0.5" aria-hidden>
                {MEAL_PERIODS.map((m) => (
                  <span
                    key={m}
                    className={`size-1.5 rounded-full ${slots[key(d, m)] ? (on ? "bg-nut" : "bg-buckeye") : on ? "bg-background/30" : "bg-input"}`}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </nav>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ol className="mt-6 flex flex-col">
        {MEAL_PERIODS.map((meal, i) => {
          const planned = slots[key(date, meal)]
          const ate = isToday ? logged[meal] : undefined
          const isNow = isToday && i === nowIndex && !ate
          const isPast = isToday && i < nowIndex && !ate && !planned
          const status = ate ? "Ate it" : isNow ? "Now" : planned ? "Planned" : isPast ? "Passed" : "Open"
          const statusClass = ate ? "text-sage" : isNow ? "text-primary" : "text-muted-foreground"
          return (
            <li key={meal} className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-3 pb-5">
              <div className={isNow ? "pt-4" : "pt-0.5"}>
                <p className="font-heading text-[0.9375rem] font-bold">{MEAL_LABELS[meal]}</p>
                <p className={`mt-0.5 text-sm font-semibold ${statusClass}`}>{status}</p>
              </div>

              {ate ? (
                <div className="border-b pb-4">
                  <p className="font-semibold">{ate.title}</p>
                  {ate.recipeId != null && (
                    <Link href={`/plate/${ate.recipeId}?meal=${meal}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                      See the plate
                    </Link>
                  )}
                </div>
              ) : planned ? (
                <div className="flex items-start gap-2 border-b pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{planned.title}</p>
                    <div className="flex gap-4">
                      <Link
                        href={`/plate/${planned.recipeId}?meal=${meal}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                      >
                        See the route
                      </Link>
                      <button type="button" onClick={() => openPicker(meal)} className="min-h-11 text-sm font-semibold text-primary">
                        Swap it
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(meal)}
                    disabled={busy === key(date, meal)}
                    aria-label={`Remove ${planned.title} from ${MEAL_LABELS[meal].toLowerCase()} ${dayLabel(date)}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                  >
                    {busy === key(date, meal) ? <CircleNotchIcon className="size-4 animate-spin" /> : <XIcon className="size-4" />}
                  </button>
                </div>
              ) : isNow ? (
                <div className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-[0_6px_24px_rgba(31,42,35,0.07)]">
                  <span aria-hidden className="absolute -top-5 -right-5 size-12 rounded-full bg-background" />
                  <span aria-hidden className="absolute top-0.5 right-6 size-7 rounded-full bg-background" />
                  <p className="text-sm text-muted-foreground">Nothing planned yet</p>
                  <p className="mt-1 max-w-[80%] font-heading text-lg leading-snug font-extrabold">Hungry? We&apos;ll pick a plate that fits you.</p>
                  <Link
                    href={`/feed?meal=${meal}`}
                    className="mt-3 inline-flex h-12 items-center gap-2.5 rounded-full bg-buckeye pr-5 pl-1.5 font-heading text-base font-extrabold text-white"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-nut text-buckeye" aria-hidden>
                      <ForkKnifeIcon className="size-5" weight="bold" />
                    </span>
                    Feed me {meal}
                  </Link>
                  <button type="button" onClick={() => openPicker(meal)} className="mt-1 block min-h-11 text-sm font-semibold text-primary">
                    Or choose from a list
                  </button>
                </div>
              ) : isPast ? (
                <p className="border-b pb-4 text-sm text-muted-foreground">Nothing logged.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openPicker(meal)}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <PlusIcon className="size-4" aria-hidden />
                  Plan {meal}
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <Sheet open={picker !== null} onOpenChange={(open) => !open && saving === null && setPicker(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-md overflow-y-auto">
          {picker && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="text-base">
                  {MEAL_LABELS[picker.meal]}, {dayLabel(picker.date)}
                </SheetTitle>
                <SheetDescription>Plates that fit you on that day&apos;s Scott menu.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-6">
                <Button className="h-12 rounded-xl text-base font-bold" onClick={() => choose("pick")} disabled={saving !== null}>
                  {saving === "pick" ? (
                    <>
                      <CircleNotchIcon className="animate-spin" /> Picking a plate...
                    </>
                  ) : (
                    "Pick one for me"
                  )}
                </Button>
                {pickerError && (
                  <p className="text-sm text-destructive" role="alert">
                    {pickerError}
                  </p>
                )}

                {options.state === "loading" && <p className="py-6 text-center text-sm text-muted-foreground">Loading plates…</p>}
                {options.state === "error" && <p className="py-6 text-center text-sm text-destructive">{options.error}</p>}
                {options.state === "ready" &&
                  (options.plates.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No plates fit you on this day&apos;s menu yet. Scott&apos;s menu may not be posted.
                    </p>
                  ) : (
                    <ul className="divide-y border-y">
                      {options.plates.map((plate) => (
                        <li key={plate.id}>
                          <button
                            type="button"
                            onClick={() => choose(plate.id)}
                            disabled={saving !== null}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted disabled:opacity-60"
                          >
                            <span className="flex-1">
                              <span className="block text-sm font-semibold">{plate.title}</span>
                              <span className="block text-sm text-muted-foreground">
                                {plate.items.map((item) => item.name).join(" · ")}
                              </span>
                            </span>
                            {saving === plate.id ? (
                              <CircleNotchIcon className="size-4 animate-spin" />
                            ) : (
                              <PlusIcon className="size-4 text-muted-foreground" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
