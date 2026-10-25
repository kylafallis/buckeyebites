"use client"

import { useState } from "react"
import { ArrowsLeftRightIcon, CheckCircleIcon, CircleNotchIcon, MinusCircleIcon, XCircleIcon } from "@phosphor-icons/react"
import type { DupeIngredient, DupeResult } from "@/lib/dupe-shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlateActions } from "../plate/[id]/plate-actions"

type Mode = "link" | "paste"

export function DupeMaker({ userId }: { userId: string }) {
  const [mode, setMode] = useState<Mode>("link")
  const [url, setUrl] = useState("")
  const [pasted, setPasted] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DupeResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/dupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "link" ? { url } : { ingredients: pasted }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Something went wrong making your dupe.")
        // The link had no readable recipe: let them paste the ingredients.
        if (body.needsIngredients) setMode("paste")
        return
      }
      setResult(body as DupeResult)
    } catch {
      setError("You're offline. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  const canSubmit = mode === "link" ? url.trim() !== "" : pasted.trim() !== ""

  return (
    <div className="mt-4 flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-2">
        {mode === "link" ? (
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Recipe link
            <Input
              type="url"
              inputMode="url"
              placeholder="https://www.example.com/recipe"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11 text-base md:text-sm"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Ingredients, one per line
            <textarea
              rows={7}
              placeholder={"2 cups cooked rice\n1 cup black beans\n1/2 cup salsa"}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              className="border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-sm"
            />
          </label>
        )}
        <Button type="submit" className="h-12 text-sm" disabled={pending || !canSubmit}>
          {pending ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" /> Making it at Scott...
            </>
          ) : (
            "Make it at Scott"
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "link" ? "paste" : "link")
            setError(null)
          }}
          className="self-start py-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          {mode === "link" ? "Paste ingredients instead" : "Use a recipe link instead"}
        </button>
        <p className="sr-only" aria-live="polite">
          {pending ? "Making it at Scott" : ""}
        </p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && <DupeResultView result={result} userId={userId} />}
    </div>
  )
}

const STATUS = {
  matched: { Icon: CheckCircleIcon, className: "text-[#4C9A5A]", label: "Matched" },
  swapped: { Icon: ArrowsLeftRightIcon, className: "text-[#B98900]", label: "Swapped" },
  pantry: { Icon: MinusCircleIcon, className: "text-muted-foreground", label: "Pantry" },
  missing: { Icon: XCircleIcon, className: "text-muted-foreground", label: "Missing" },
} as const

function DupeResultView({ result, userId }: { result: DupeResult; userId: string }) {
  const counts = (s: DupeIngredient["status"]) => result.ingredients.filter((i) => i.status === s).length
  const hasItems = result.ingredients.some((i) => i.item)
  const calories = result.sourceNutrition?.calories

  return (
    <section aria-label="Your dupe" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{result.title}</h2>
        <p className="text-xs text-muted-foreground capitalize">
          {result.meal} at Scott · {counts("matched")} matched, {counts("swapped")} swapped,{" "}
          {counts("pantry")} pantry, {counts("missing")} missing
        </p>
        {calories && <p className="text-xs text-muted-foreground">Original recipe: {calories} per serving</p>}
      </div>

      <ul className="divide-y border-y bg-card">
        {result.ingredients.map((ing, i) => {
          const { Icon, className, label } = STATUS[ing.status]
          return (
            <li key={`${ing.ingredient}-${i}`} className="flex gap-3 px-3 py-2.5">
              <Icon weight="fill" className={`mt-0.5 size-5 shrink-0 ${className}`} aria-label={label} />
              <div className="min-w-0 text-sm">
                <p className={ing.status === "missing" || ing.status === "pantry" ? "text-muted-foreground" : "font-medium"}>
                  {ing.ingredient}
                </p>
                {ing.item && (
                  <p className="text-xs text-muted-foreground">
                    {ing.status === "swapped" ? "Use " : ""}
                    {ing.item.name}
                    {ing.item.station && ` · ${ing.item.station}`}
                  </p>
                )}
                {ing.status === "swapped" && ing.reason && <p className="text-xs text-[#8A6700]">{ing.reason}</p>}
                {ing.status === "missing" && <p className="text-xs text-muted-foreground">Not at Scott right now</p>}
                {ing.status === "pantry" && <p className="text-xs text-muted-foreground">Pantry staple, skip it</p>}
              </div>
            </li>
          )
        })}
      </ul>

      {result.steps.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">At the table</h3>
          <ol className="flex flex-col gap-2">
            {result.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.recipeId == null ? (
        <p className="text-sm text-muted-foreground">
          {hasItems
            ? "Only sauces matched, so there's no plate to save."
            : "Nothing in this recipe is at Scott for you right now."}
        </p>
      ) : (
        <PlateActions
          recipeId={result.recipeId}
          userId={userId}
          meal={result.meal}
          planDate={result.date}
          totals={result.totals}
          canLog={hasItems}
          retry={false}
        />
      )}
    </section>
  )
}
