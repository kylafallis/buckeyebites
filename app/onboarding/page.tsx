import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingFlow, type OnboardingValues } from "./onboarding-flow"

export const metadata: Metadata = {
  title: "Welcome · BuckeyeBites",
}

async function OnboardingLoader() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect("/login")

  const [{ data: profile }, { data: allergens }] = await Promise.all([
    supabase
      .from("profiles")
      .select("diet, mode, focus_nutrients, goals, meals_per_day, snacks_per_day, desserts_per_day")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_allergens").select("allergen").eq("user_id", userId),
  ])

  const goals = (profile?.goals ?? {}) as Record<string, unknown>
  const initial: OnboardingValues = {
    diet: profile?.diet ?? "none",
    allergens: (allergens ?? []).map((a) => a.allergen),
    mealsPerDay: profile?.meals_per_day ?? 3,
    snacksPerDay: profile?.snacks_per_day ?? 1,
    dessertsPerDay: profile?.desserts_per_day ?? 0,
    mode: profile?.mode ?? "balanced",
    focusNutrients: profile?.focus_nutrients ?? [],
    goals,
  }

  return <OnboardingFlow userId={userId} initial={initial} />
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
    >
      <OnboardingLoader />
    </Suspense>
  )
}
