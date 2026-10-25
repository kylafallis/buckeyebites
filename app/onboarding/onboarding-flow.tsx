"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { foodKey } from "@/lib/menu-shared"
import { ALLERGENS, DIETS, MODES, NUTRIENTS } from "@/lib/preferences"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SwipeDeck } from "./swipe-deck"

export type OnboardingValues = {
  diets: string[]
  allergens: string[]
  mealsPerDay: number
  snacksPerDay: number
  dessertsPerDay: number
  mode: string
  focusNutrients: string[]
  goals: Record<string, unknown>
}

const SAVE_TIMEOUT_MS = 15_000

class SaveError extends Error {}

/** Throws a SaveError for a failed Supabase write. */
function check({ error }: { error: { message: string } | null }) {
  if (error) throw new SaveError(error.message)
}

const STEPS = [
  { title: "Any diet we should know about?", subtitle: "Pick all that apply, or none for no restrictions." },
  { title: "Any food allergies?", subtitle: "Pick all that apply. Items with these are hidden." },
  { title: "How do you eat?", subtitle: "Per day, on a typical day." },
  { title: "What's your goal?", subtitle: "You can change this anytime." },
  { title: "What looks good?", subtitle: "Swipe right to like, left to pass." },
]

export function OnboardingFlow({ userId, initial }: { userId: string; initial: OnboardingValues }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState(initial)
  const [protein, setProtein] = useState(
    typeof initial.goals.protein_g === "number" ? String(initial.goals.protein_g) : ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Swipes are kept here and saved in one write when the user taps Finish.
  const [swipes, setSwipes] = useState<Map<number, boolean>>(() => new Map())

  const set = <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const toggle = (key: "diets" | "allergens" | "focusNutrients", value: string) =>
    setValues((v) => ({
      ...v,
      [key]: v[key].includes(value) ? v[key].filter((x) => x !== value) : [...v[key], value],
    }))

  function validate(): string | null {
    if (step !== 3) return null
    if (values.mode === "nutrients" && values.focusNutrients.length === 0) {
      return "Pick at least one nutrient to focus on."
    }
    if (values.mode === "macros") {
      const grams = Number(protein)
      if (!Number.isInteger(grams) || grams < 1 || grams > 400) {
        return "Enter a protein goal between 1 and 400 grams."
      }
    }
    return null
  }

  /** Saves the current step. Every write is an upsert so a retry never fails on duplicates. */
  async function save(signal: AbortSignal) {
    const supabase = createClient()
    const upsertProfile = async (fields: Record<string, unknown>) => {
      const result = await supabase.from("profiles").upsert({ id: userId, ...fields }).abortSignal(signal)
      // Before migration 007 there's no diets column: save the first diet in diet only.
      if (result.error?.code === "PGRST204" && "diets" in fields) {
        const { diets: _skipped, ...rest } = fields
        void _skipped
        return check(await supabase.from("profiles").upsert({ id: userId, ...rest }).abortSignal(signal))
      }
      check(result)
    }
    // diet keeps the first choice for older readers; diets holds them all.
    const dietFields = { diets: values.diets, diet: values.diets[0] ?? "none" }

    const saveAllergens = async () => {
      if (values.allergens.length > 0) {
        check(
          await supabase
            .from("user_allergens")
            .upsert(
              values.allergens.map((allergen) => ({ user_id: userId, allergen })),
              { onConflict: "user_id,allergen", ignoreDuplicates: true }
            )
            .abortSignal(signal)
        )
      }
      // Then remove any the user unchecked.
      let removed = supabase.from("user_allergens").delete().eq("user_id", userId)
      if (values.allergens.length > 0) {
        removed = removed.not("allergen", "in", `(${values.allergens.join(",")})`)
      }
      check(await removed.abortSignal(signal))
    }

    const saveSwipes = async () => {
      if (swipes.size === 0) return
      // Skip items that were removed from the menu since the deck loaded.
      const ids = [...swipes.keys()]
      const [current, previous] = await Promise.all([
        supabase.from("menu_items").select("id, name").in("id", ids).abortSignal(signal),
        supabase.from("food_swipes").select("menu_item_id, menu_items(name)").eq("user_id", userId).abortSignal(signal),
      ])
      check(current)
      check(previous)
      // The same food has a different menu item each day, so match earlier swipes by name.
      const swipedBefore = new Map<string, number[]>()
      for (const row of (previous.data ?? []) as unknown as { menu_item_id: number; menu_items: { name: string } | null }[]) {
        if (!row.menu_items) continue
        const key = foodKey(row.menu_items.name)
        swipedBefore.set(key, [...(swipedBefore.get(key) ?? []), row.menu_item_id])
      }

      const fresh: { user_id: string; menu_item_id: number; liked: boolean }[] = []
      const updates = new Map<boolean, number[]>()
      for (const { id, name } of current.data ?? []) {
        const liked = swipes.get(id)!
        const earlier = swipedBefore.get(foodKey(name))
        if (earlier) updates.set(liked, [...(updates.get(liked) ?? []), ...earlier])
        else fresh.push({ user_id: userId, menu_item_id: id, liked })
      }
      // A food swiped before is updated, not added again.
      for (const [liked, menuItemIds] of updates) {
        check(
          await supabase
            .from("food_swipes")
            .update({ liked })
            .eq("user_id", userId)
            .in("menu_item_id", menuItemIds)
            .abortSignal(signal)
        )
      }
      if (fresh.length > 0) {
        check(
          await supabase
            .from("food_swipes")
            .upsert(fresh, { onConflict: "user_id,menu_item_id" })
            .abortSignal(signal)
        )
      }
    }

    const goals = { ...values.goals }
    if (values.mode === "macros") goals.protein_g = Number(protein)
    else delete goals.protein_g
    const preferences = {
      ...dietFields,
      meals_per_day: values.mealsPerDay,
      snacks_per_day: values.snacksPerDay,
      desserts_per_day: values.dessertsPerDay,
      mode: values.mode,
      focus_nutrients: values.mode === "nutrients" ? values.focusNutrients : [],
      goals,
    }

    switch (step) {
      case 0:
        return upsertProfile(dietFields)
      case 1:
        return saveAllergens()
      case 2:
        return upsertProfile({
          meals_per_day: values.mealsPerDay,
          snacks_per_day: values.snacksPerDay,
          desserts_per_day: values.dessertsPerDay,
        })
      case 3:
        return upsertProfile({
          mode: preferences.mode,
          focus_nutrients: preferences.focus_nutrients,
          goals: preferences.goals,
        })
      default:
        // Re-save everything so a retry after a partial failure is complete,
        // and mark onboarded only once the rest has saved.
        await saveAllergens()
        await saveSwipes()
        return upsertProfile({ ...preferences, onboarded: true })
    }
  }

  async function next() {
    const invalid = validate()
    if (invalid) return setError(invalid)

    setSaving(true)
    setError(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS)
    try {
      await save(controller.signal)
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "Saving took too long. Check your connection and try again."
          : e instanceof SaveError
            ? `Couldn't save: ${e.message}`
            : "Couldn't save. Check your connection and try again."
      )
      setSaving(false)
      return
    } finally {
      clearTimeout(timer)
    }

    if (step === STEPS.length - 1) {
      // Don't call router.refresh() here: it re-fetches /onboarding and
      // cancels this navigation, leaving the button stuck on "Saving…".
      router.replace("/dashboard")
      // Fallback if the client-side navigation stalls, so the button is never stuck.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      setTimeout(() => window.location.assign("/dashboard"), 5_000)
      return
    }
    setSaving(false)
    setStep((s) => s + 1)
  }

  function back() {
    setError(null)
    setStep((s) => s - 1)
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="pt-6 pb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full bg-muted"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <h1 className="mt-6 text-xl font-semibold">{STEPS[step].title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].subtitle}</p>
      </header>

      <main className="flex-1 pb-4">
        {step === 0 && (
          <div className="flex flex-col gap-2" role="group" aria-label="Diets">
            {DIETS.map((d) => (
              <Choice
                key={d.value}
                role="checkbox"
                selected={values.diets.includes(d.value)}
                onClick={() => toggle("diets", d.value)}
                label={d.label}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Allergens">
            {ALLERGENS.map((a) => (
              <Choice
                key={a.value}
                role="checkbox"
                selected={values.allergens.includes(a.value)}
                onClick={() => toggle("allergens", a.value)}
                label={a.label}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col divide-y border-y">
            <Stepper label="Meals" value={values.mealsPerDay} min={1} max={6} onChange={(n) => set("mealsPerDay", n)} />
            <Stepper label="Snacks" value={values.snacksPerDay} min={0} max={5} onChange={(n) => set("snacksPerDay", n)} />
            <Stepper label="Desserts" value={values.dessertsPerDay} min={0} max={3} onChange={(n) => set("dessertsPerDay", n)} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Goal">
            {MODES.map((m) => (
              <Choice
                key={m.value}
                role="radio"
                selected={values.mode === m.value}
                onClick={() => set("mode", m.value)}
                label={m.label}
                description={m.description}
              />
            ))}

            {values.mode === "nutrients" && (
              <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Nutrients to focus on">
                {NUTRIENTS.map((n) => (
                  <Choice
                    key={n.value}
                    role="checkbox"
                    selected={values.focusNutrients.includes(n.value)}
                    onClick={() => toggle("focusNutrients", n.value)}
                    label={n.label}
                  />
                ))}
              </div>
            )}

            {values.mode === "macros" && (
              <label className="mt-3 flex flex-col gap-1.5 text-xs font-medium">
                Daily protein goal (grams)
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={400}
                  placeholder="120"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="h-11 text-base md:text-base"
                />
              </label>
            )}
          </div>
        )}

        {step === 4 && (
          <SwipeDeck onSwipe={(id, liked) => setSwipes((m) => new Map(m).set(id, liked))} />
        )}

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </main>

      <footer className="sticky bottom-0 flex gap-2 border-t bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {step > 0 && (
          <Button variant="outline" className="h-11 flex-1 text-sm" onClick={back} disabled={saving}>
            Back
          </Button>
        )}
        <Button className="h-11 flex-[2] text-sm" onClick={next} disabled={saving}>
          {saving ? "Saving…" : isLast ? "Finish" : "Next"}
        </Button>
      </footer>
    </div>
  )
}

function Choice({
  label,
  description,
  selected,
  role,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  role: "radio" | "checkbox"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-between gap-3 border px-3 py-2.5 text-left text-sm transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <CheckIcon className={`size-4 shrink-0 text-primary ${selected ? "" : "invisible"}`} weight="bold" />
    </button>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-lg"
          className="size-11"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <MinusIcon />
        </Button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button
          variant="outline"
          size="icon-lg"
          className="size-11"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  )
}
