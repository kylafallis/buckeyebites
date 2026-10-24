"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { ALLERGENS, DIETS, MODES, NUTRIENTS } from "@/lib/preferences"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SwipeDeck } from "./swipe-deck"

export type OnboardingValues = {
  diet: string
  allergens: string[]
  mealsPerDay: number
  snacksPerDay: number
  dessertsPerDay: number
  mode: string
  focusNutrients: string[]
  goals: Record<string, unknown>
}

const STEPS = [
  { title: "Any diet we should know about?", subtitle: "We'll only show food that fits." },
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

  const set = <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const toggle = (key: "allergens" | "focusNutrients", value: string) =>
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

  async function save(): Promise<string | null> {
    const supabase = createClient()
    const upsertProfile = async (fields: Record<string, unknown>) =>
      (await supabase.from("profiles").upsert({ id: userId, ...fields })).error

    switch (step) {
      case 0:
        return (await upsertProfile({ diet: values.diet }))?.message ?? null
      case 1: {
        const del = await supabase.from("user_allergens").delete().eq("user_id", userId)
        if (del.error) return del.error.message
        if (values.allergens.length === 0) return null
        const ins = await supabase
          .from("user_allergens")
          .insert(values.allergens.map((allergen) => ({ user_id: userId, allergen })))
        return ins.error?.message ?? null
      }
      case 2:
        return (
          (
            await upsertProfile({
              meals_per_day: values.mealsPerDay,
              snacks_per_day: values.snacksPerDay,
              desserts_per_day: values.dessertsPerDay,
            })
          )?.message ?? null
        )
      case 3: {
        const goals = { ...values.goals }
        if (values.mode === "macros") goals.protein_g = Number(protein)
        else delete goals.protein_g
        return (
          (
            await upsertProfile({
              mode: values.mode,
              focus_nutrients: values.mode === "nutrients" ? values.focusNutrients : [],
              goals,
            })
          )?.message ?? null
        )
      }
      default:
        return (await upsertProfile({ onboarded: true }))?.message ?? null
    }
  }

  async function next() {
    const invalid = validate()
    if (invalid) return setError(invalid)

    setSaving(true)
    setError(null)
    const failed = await save()
    if (failed) {
      setError(`Couldn't save: ${failed}`)
      setSaving(false)
      return
    }

    if (step === STEPS.length - 1) {
      router.replace("/dashboard")
      router.refresh()
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
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Diet">
            {DIETS.map((d) => (
              <Choice
                key={d.value}
                role="radio"
                selected={values.diet === d.value}
                onClick={() => set("diet", d.value)}
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

        {step === 4 && <SwipeDeck userId={userId} />}

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
