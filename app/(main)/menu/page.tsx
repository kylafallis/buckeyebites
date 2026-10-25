import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSafeItems } from "@/lib/menu.server"
import { currentMealPeriod, MEAL_PERIODS, todayInColumbus } from "@/lib/menu-shared"
import { PageContainer } from "@/components/page-container"
import { MenuBrowser } from "./menu-browser"

export const metadata: Metadata = {
  title: "Scott menu · BuckeyeBites",
}

async function ScottMenu() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect("/login")

  const date = todayInColumbus()
  const [profile, ...lists] = await Promise.all([
    supabase.from("profiles").select("mode").eq("id", userId).maybeSingle(),
    ...MEAL_PERIODS.map((p) => getSafeItems(userId, p, date)),
  ])

  return (
    <MenuBrowser
      menus={{ breakfast: lists[0], lunch: lists[1], dinner: lists[2] }}
      defaultPeriod={currentMealPeriod()}
      showCalories={profile.data?.mode === "macros"}
    />
  )
}

export default function MenuPage() {
  return (
    <PageContainer>
      <h1 className="text-xl font-semibold">Scott</h1>
      <p className="text-sm text-muted-foreground">Today&apos;s menu, filtered for you.</p>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading menu…</p>}>
        <ScottMenu />
      </Suspense>
    </PageContainer>
  )
}
