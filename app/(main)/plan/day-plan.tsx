"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircleIcon, CircleIcon, CircleNotchIcon, ForkKnifeIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { formatDay, MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import type { GoalCheck } from "@/lib/goals"
import type { RecipeCard } from "@/lib/recipes-shared"
import { requestPlate } from "@/lib/request-plate"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { clearSlot, loadSlotOptions, setSlot } from "./actions"

export type Slots = Record<string, { recipeId: number; title: string }>
export type DayInfo = {
  logged: Partial<Record<MealPeriod, { recipeId: number | null; title: string }>>
  checks: GoalCheck[]
  /** hit: every goal met. partial: something logged, goal not met. none: nothing logged. future: not yet. */
  status: "hit" | "partial" | "none" | "future"
}
export type GoalStats = {
  goal: string
  /** False when there's nothing to measure (Macros mode without a protein goal). */
  measurable: boolean
  week: { hit: number; logged: number }
  perWeek: number
  streak: number
  byCheck: { label: string; days: number }[]
}

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const key = (date: string, meal: MealPeriod) => `${date}|${meal}`
const STATUS_DOT: Record<DayInfo["status"], string> = {
  hit: "bg-sage",
  partial: "bg-nut ring-1 ring-buckeye/40",
  none: "bg-input",
  future: "bg-transparent",
}

type Picker = { date: string; meal: MealPeriod }
type Options = { state: "loading" } | { state: "error"; error: string } | { state: "ready"; plates: RecipeCard[] }

/**
 * Plan, layout C: a strip of days (four weeks back, a week ahead) and the
 * chosen day's meals in order. Past days show what was eaten and whether the
 * goal was hit; today and later days can be planned. On wide screens a goal
 * summary and a five-week calendar sit beside it.
 */
export function DayPlan({
  dates,
  todayIndex,
  initialSlots,
  days,
  stats,
  currentMeal,
}: {
  dates: string[]
  todayIndex: number
  initialSlots: Slots
  days: Record<string, DayInfo>
  stats: GoalStats
  currentMeal: MealPeriod
}) {
  const [slots, setSlots] = useState(initialSlots)
  const [day, setDay] = useState(todayIndex)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [picker, setPicker] = useState<Picker | null>(null)
  const [options, setOptions] = useState<Options>({ state: "loading" })
  const [saving, setSaving] = useState<"pick" | number | null>(null)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const chips = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    chips.current[day]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [day])

  const date = dates[day]
  const info = days[date]
  const isToday = day === todayIndex
  const isPastDay = day < todayIndex
  const nowIndex = MEAL_PERIODS.indexOf(currentMeal)
  const today = dates[todayIndex]
  const dayLabel = (d: string) => (d === today ? "today" : formatDay(d, { weekday: "long" }))
  const title = isToday
    ? "Today at Scott"
    : day === todayIndex - 1
      ? "Yesterday"
      : day === todayIndex + 1
        ? "Tomorrow"
        : formatDay(date, { weekday: "long" })

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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-12">
      <div className="min-w-0">
        <header>
          <p className="text-sm text-muted-foreground">{formatDay(date, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-3xl font-extrabold">{title}</h1>
        </header>

        <nav aria-label="Day" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {dates.map((d, i) => {
            const on = i === day
            const planned = MEAL_PERIODS.filter((m) => slots[key(d, m)]).length
            const status = days[d].status
            const past = i < todayIndex
            return (
              <button
                key={d}
                ref={(el) => {
                  chips.current[i] = el
                }}
                type="button"
                onClick={() => setDay(i)}
                aria-pressed={on}
                aria-label={`${formatDay(d, { weekday: "long", month: "long", day: "numeric" })}${
                  past
                    ? `, ${status === "hit" ? "goal hit" : status === "partial" ? "some meals logged" : "nothing logged"}`
                    : `, ${planned} of 3 meals planned`
                }`}
                className={`flex min-w-14 shrink-0 flex-col items-center rounded-2xl px-2 py-2 transition-colors ${
                  on ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted"
                }`}
              >
                <span className={`text-xs font-semibold ${on ? "" : "text-muted-foreground"}`}>
                  {i === todayIndex ? "Today" : formatDay(d, { weekday: "short" })}
                </span>
                <span className="font-heading text-lg font-extrabold">{formatDay(d, { day: "numeric" })}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                  {past ? (
                    <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
                  ) : (
                    MEAL_PERIODS.map((m) => (
                      <span
                        key={m}
                        className={`size-1.5 rounded-full ${slots[key(d, m)] ? (on ? "bg-nut" : "bg-buckeye") : on ? "bg-background/30" : "bg-input"}`}
                      />
                    ))
                  )}
                </span>
              </button>
            )
          })}
        </nav>

        {(isPastDay || isToday) && info.checks.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Goals ${dayLabel(date)}`}>
            {info.checks.map((c) => (
              <li key={c.label} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${c.met ? "bg-safe" : "bg-card"}`}>
                {c.met ? (
                  <CheckCircleIcon className="size-4 text-sage" weight="fill" aria-hidden />
                ) : (
                  <CircleIcon className="size-4 text-muted-foreground" aria-hidden />
                )}
                <span>
                  <strong>{c.label}</strong> {c.value} of {c.target} {c.unit}
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <ol className="mt-6 flex flex-col">
          {MEAL_PERIODS.map((meal, i) => {
            const planned = slots[key(date, meal)]
            const ate = isToday || isPastDay ? info.logged[meal] : undefined
            const isNow = isToday && i === nowIndex && !ate
            const isPast = isPastDay || (isToday && i < nowIndex && !ate)
            const status = ate
              ? "Ate it"
              : isNow
                ? "Now"
                : isPast
                  ? planned
                    ? "Not logged"
                    : "Nothing logged"
                  : planned
                    ? "Planned"
                    : "Open"
            const statusClass = ate ? "text-sage" : isNow ? "text-primary" : "text-muted-foreground"
            return (
              <li key={meal} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 pb-5">
                <div className={isNow ? "pt-4" : "pt-0.5"}>
                  <p className="font-heading text-[0.9375rem] font-bold">{MEAL_LABELS[meal]}</p>
                  <p className={`mt-0.5 text-sm font-semibold ${statusClass}`}>{status}</p>
                </div>

                {ate ? (
                  <div className="border-b pb-4">
                    <p className="font-semibold">{ate.title}</p>
                    {ate.recipeId != null && (
                      <Link
                        href={`/plate/${ate.recipeId}?meal=${meal}${isToday ? "" : `&date=${date}`}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                      >
                        See the plate
                      </Link>
                    )}
                  </div>
                ) : isPast ? (
                  <p className="border-b pb-4 text-sm text-muted-foreground">
                    {planned ? `Planned ${planned.title}, but it wasn't logged.` : "No meal logged."}
                  </p>
                ) : planned ? (
                  <div className="flex items-start gap-2 border-b pb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{planned.title}</p>
                      <div className="flex gap-4">
                        <Link
                          href={`/plate/${planned.recipeId}?meal=${meal}&date=${date}`}
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
                    <p className="mt-1 max-w-[80%] font-heading text-lg leading-snug font-extrabold">
                      Hungry? We&apos;ll pick a plate that fits you.
                    </p>
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
      </div>

      <aside className="mt-4 flex flex-col gap-6 lg:sticky lg:top-20 lg:mt-0" aria-label="Your goal history">
        <GoalSummary stats={stats} />
        <Calendar dates={dates} todayIndex={todayIndex} days={days} slots={slots} selected={day} onSelect={setDay} />
      </aside>

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
    </div>
  )
}

/** How often the student hits their goal: this week, the 4-week average and the current streak. */
function GoalSummary({ stats }: { stats: GoalStats }) {
  return (
    <section className="rounded-2xl bg-card p-5">
      <h2 className="text-lg font-extrabold">Your goal: {stats.goal}</h2>
      {!stats.measurable ? (
        <p className="mt-2 text-sm text-muted-foreground">Set a daily protein goal on the Me tab to track it here.</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-sm text-muted-foreground">Last 7 days</dt>
              <dd className="font-heading text-2xl font-extrabold tabular-nums">
                {stats.week.hit}
                <span className="font-sans text-sm font-normal text-muted-foreground"> of 7</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Average</dt>
              <dd className="font-heading text-2xl font-extrabold tabular-nums">
                {stats.perWeek}
                <span className="font-sans text-sm font-normal text-muted-foreground"> days/wk</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Streak</dt>
              <dd className="font-heading text-2xl font-extrabold tabular-nums">
                {stats.streak}
                <span className="font-sans text-sm font-normal text-muted-foreground"> {stats.streak === 1 ? "day" : "days"}</span>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            Days you hit your goal. The average covers the last 4 weeks.
            {stats.week.logged === 0 && " Tap I ate this on a plate to start."}
          </p>
          {stats.byCheck.length > 1 && (
            <ul className="mt-4 flex flex-col gap-2 border-t pt-4">
              {stats.byCheck.map((c) => (
                <li key={c.label} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 font-semibold">{c.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-sage" style={{ width: `${(c.days / 7) * 100}%` }} />
                  </span>
                  <span className="w-20 shrink-0 text-right text-muted-foreground tabular-nums">{c.days} of 7 days</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** Five weeks at a glance: past days colored by goal, future days by plans. Tap a day to open it. */
function Calendar({
  dates,
  todayIndex,
  days,
  slots,
  selected,
  onSelect,
}: {
  dates: string[]
  todayIndex: number
  days: Record<string, DayInfo>
  slots: Slots
  selected: number
  onSelect: (i: number) => void
}) {
  return (
    <section className="rounded-2xl bg-card p-5">
      <h2 className="text-lg font-extrabold">Last 4 weeks and next week</h2>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
        {dates.slice(0, 7).map((d) => (
          <span key={d} className="text-xs font-semibold text-muted-foreground" aria-hidden>
            {formatDay(d, { weekday: "narrow" })}
          </span>
        ))}
        {dates.map((d, i) => {
          const status = days[d].status
          const planned = MEAL_PERIODS.some((m) => slots[key(d, m)])
          const color =
            status === "hit"
              ? "bg-sage text-white"
              : status === "partial"
                ? "bg-nut text-buckeye"
                : status === "future"
                  ? planned
                    ? "border-2 border-dashed border-buckeye text-foreground"
                    : "border-2 border-dashed border-input text-muted-foreground"
                  : "bg-muted text-muted-foreground"
          const said =
            status === "hit"
              ? "goal hit"
              : status === "partial"
                ? "some meals logged"
                : status === "none"
                  ? "nothing logged"
                  : planned
                    ? "meals planned"
                    : "nothing planned"
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={i === selected}
              aria-label={`${formatDay(d, { weekday: "long", month: "long", day: "numeric" })}: ${said}`}
              className={`flex aspect-square min-h-9 items-center justify-center rounded-lg font-heading text-sm font-bold ${color} ${
                i === selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
              } ${i === todayIndex ? "underline decoration-2 underline-offset-2" : ""}`}
            >
              {formatDay(d, { day: "numeric" })}
            </button>
          )
        })}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-sage" aria-hidden /> Goal hit
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-nut" aria-hidden /> Some logged
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-muted" aria-hidden /> Nothing logged
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm border-2 border-dashed border-buckeye" aria-hidden /> Planned
        </li>
      </ul>
    </section>
  )
}
