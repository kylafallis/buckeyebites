"use client"

import { useState } from "react"
import { CaretLeftIcon, CaretRightIcon, CircleNotchIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { formatDay, MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import type { RecipeCard } from "@/lib/recipes-shared"
import { requestPlate } from "@/lib/request-plate"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { clearSlot, loadSlotOptions, setSlot } from "./actions"

export type Slots = Record<string, { recipeId: number; title: string }>

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const key = (date: string, meal: MealPeriod) => `${date}|${meal}`

type Picker = { date: string; meal: MealPeriod }
type Options = { state: "loading" } | { state: "error"; error: string } | { state: "ready"; plates: RecipeCard[] }

export function WeekPlan({ dates, initialSlots }: { dates: string[]; initialSlots: Slots }) {
  const [slots, setSlots] = useState(initialSlots)
  const [day, setDay] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [picker, setPicker] = useState<Picker | null>(null)
  const [options, setOptions] = useState<Options>({ state: "loading" })
  const [saving, setSaving] = useState<"pick" | number | null>(null)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const dayLabel = (date: string) => (date === dates[0] ? `Today, ${formatDay(date, { month: "short", day: "numeric" })}` : formatDay(date))

  async function openPicker(date: string, meal: MealPeriod) {
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

  async function remove(date: string, meal: MealPeriod) {
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

  const slot = (date: string, meal: MealPeriod) => (
    <Slot
      key={key(date, meal)}
      label={`${MEAL_LABELS[meal]}, ${dayLabel(date)}`}
      planned={slots[key(date, meal)]}
      busy={busy === key(date, meal)}
      onAdd={() => openPicker(date, meal)}
      onRemove={() => remove(date, meal)}
    />
  )

  return (
    <div className="mt-4">
      {error && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Mobile: one day at a time. */}
      <div className="md:hidden">
        <div className="flex items-center justify-between border-y bg-card">
          <Button
            variant="ghost"
            className="size-11"
            onClick={() => setDay((d) => d - 1)}
            disabled={day === 0}
            aria-label="Previous day"
          >
            <CaretLeftIcon className="size-5" />
          </Button>
          <p className="text-sm font-semibold" aria-live="polite">
            {dayLabel(dates[day])}
          </p>
          <Button
            variant="ghost"
            className="size-11"
            onClick={() => setDay((d) => d + 1)}
            disabled={day === dates.length - 1}
            aria-label="Next day"
          >
            <CaretRightIcon className="size-5" />
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {MEAL_PERIODS.map((meal) => (
            <section key={meal} aria-label={MEAL_LABELS[meal]}>
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {MEAL_LABELS[meal]}
              </h2>
              {slot(dates[day], meal)}
            </section>
          ))}
        </div>
      </div>

      {/* Desktop: the whole week. */}
      <div className="hidden grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-2 md:grid" role="table" aria-label="Meal plan">
        <div role="row" className="contents">
          <span role="columnheader" />
          {dates.map((date) => (
            <span key={date} role="columnheader" className="text-xs font-semibold">
              {dayLabel(date)}
            </span>
          ))}
        </div>
        {MEAL_PERIODS.map((meal) => (
          <div key={meal} role="row" className="contents">
            <span role="rowheader" className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {MEAL_LABELS[meal]}
            </span>
            {dates.map((date) => (
              <div key={date} role="cell">
                {slot(date, meal)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Sheet open={picker !== null} onOpenChange={(open) => !open && saving === null && setPicker(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-md overflow-y-auto">
          {picker && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="text-base">
                  {MEAL_LABELS[picker.meal]} · {dayLabel(picker.date)}
                </SheetTitle>
                <SheetDescription>Plates that fit you on that day&apos;s Scott menu.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-6">
                <Button className="h-12 text-sm" onClick={() => choose("pick")} disabled={saving !== null}>
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

                {options.state === "loading" && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading plates…</p>
                )}
                {options.state === "error" && (
                  <p className="py-6 text-center text-sm text-destructive">{options.error}</p>
                )}
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
                              <span className="block text-sm font-medium">{plate.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {plate.items.map((i) => i.name).join(" · ")}
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
    </div>
  )
}

function Slot({
  label,
  planned,
  busy,
  onAdd,
  onRemove,
}: {
  label: string
  planned: { recipeId: number; title: string } | undefined
  busy: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  if (!planned) {
    return (
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${label}`}
        className="flex min-h-14 w-full items-center justify-center border border-dashed text-muted-foreground hover:border-primary hover:text-primary"
      >
        <PlusIcon className="size-5" />
      </button>
    )
  }
  return (
    <div className="flex min-h-14 items-center gap-1 border bg-card py-1 pl-3">
      <span className="flex-1 text-sm leading-snug font-medium">{planned.title}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Remove ${planned.title} from ${label}`}
        className="flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {busy ? <CircleNotchIcon className="size-4 animate-spin" /> : <XIcon className="size-4" />}
      </button>
    </div>
  )
}
