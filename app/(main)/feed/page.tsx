import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { currentMealPeriod, MEAL_PERIODS, profileDiets, type MealPeriod } from "@/lib/menu-shared"
import { rankedPlates } from "@/lib/plate"
import { ALLERGENS, DIETS, labelFor } from "@/lib/preferences"
import { PageContainer } from "@/components/page-container"
import { SafeStrip } from "@/components/safe-strip"
import { PlateDeck, type DeckPlate } from "./plate-deck"

export const metadata: Metadata = {
  title: "Feed me · BuckeyeBites",
}

const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }
const isMealPeriod = (v: unknown): v is MealPeriod => MEAL_PERIODS.includes(v as MealPeriod)

async function Feed({ meal }: { meal: MealPeriod }) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const [plates, profile, allergens] = await Promise.all([
    rankedPlates(supabase, userId, meal),
    // "*" so this works before and after migration 007 adds profiles.diets.
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_allergens").select("allergen").eq("user_id", userId),
  ])

  const deck: DeckPlate[] = plates.map((p) => ({
    id: p.id,
    title: p.title ?? "Scott plate",
    blurb: p.blurb,
    stations: [...new Set(p.parts.map((x) => x.item.station?.name ?? "Scott"))],
    protein: Math.round(p.parts.reduce((sum, x) => sum + (x.item.protein_g ?? 0) * x.servings, 0)),
    foods: p.parts.map((x) => ({
      name: x.item.name,
      food_group: x.item.food_group,
      calories: x.item.calories,
      servings: x.servings,
    })),
  }))

  return (
    <>
      <SafeStrip
        allergens={(allergens.data ?? []).map((a) => labelFor(ALLERGENS, a.allergen))}
        diets={profileDiets(profile.data).map((d) => labelFor(DIETS, d))}
        className="mt-3"
      />
      {deck.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-medium">No ready-made {meal} plate fits you on today&apos;s menu.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another meal, or browse the menu.</p>
          <Link href="/menu" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary">
            Open the menu
          </Link>
        </div>
      ) : (
        <PlateDeck plates={deck} meal={meal} />
      )}
    </>
  )
}

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const asked = (await searchParams).meal
  const meal = isMealPeriod(asked) ? asked : currentMealPeriod()
  return (
    <PageContainer narrow>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{MEAL_LABELS[meal]}</h1>
        <nav aria-label="Meal" className="flex gap-1 rounded-full bg-muted p-1">
          {MEAL_PERIODS.map((m) => (
            <Link
              key={m}
              href={`/feed?meal=${m}`}
              aria-current={m === meal ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-full px-3 text-sm font-semibold ${
                m === meal ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {MEAL_LABELS[m]}
            </Link>
          ))}
        </nav>
      </div>
      <Suspense key={meal} fallback={<p className="py-16 text-center text-sm text-muted-foreground">Finding plates that fit you…</p>}>
        <Feed meal={meal} />
      </Suspense>
    </PageContainer>
  )
}
