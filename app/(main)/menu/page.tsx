import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSafeItems, getSafeSampleItems } from "@/lib/menu.server"
import { currentMealPeriod, MEAL_PERIODS, SCOTT_SLUG, todayInColumbus } from "@/lib/menu-shared"
import { FeedMeButton } from "@/components/feed-me-button"
import { NutrientBadges } from "@/components/nutrient-badges"
import { PageContainer } from "@/components/page-container"
import { MenuBrowser } from "./menu-browser"

export const metadata: Metadata = {
  title: "Menu · BuckeyeBites",
}

type Location = { id: number; name: string; slug: string; is_live: boolean | null }

async function Menu({ searchParams }: { searchParams: PageProps<"/menu">["searchParams"] }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect("/login")

  const { data: rows, error } = await supabase.from("locations").select("id, name, slug, is_live").order("name")
  if (error) throw error
  // Scott first, then the rest by name.
  const locations = [...(rows as Location[])].sort((a, b) => Number(b.slug === SCOTT_SLUG) - Number(a.slug === SCOTT_SLUG))
  const wanted = (await searchParams).location
  const location = locations.find((l) => l.slug === wanted) ?? locations.find((l) => l.slug === SCOTT_SLUG) ?? locations[0]
  if (!location) return <p className="py-12 text-center text-sm text-muted-foreground">No dining locations yet.</p>

  return (
    <>
      <nav aria-label="Dining location" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {locations.map((l) => {
          const active = l.id === location.id
          return (
            <Link
              key={l.id}
              href={l.slug === SCOTT_SLUG ? "/menu" : `/menu?location=${encodeURIComponent(l.slug)}`}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {l.name}
            </Link>
          )
        })}
      </nav>

      {location.is_live ? (
        <LiveMenu userId={userId} slug={location.slug} />
      ) : (
        <ComingSoon userId={userId} slug={location.slug} />
      )}
    </>
  )
}

async function LiveMenu({ userId, slug }: { userId: string; slug: string }) {
  const supabase = await createClient()
  const date = todayInColumbus()
  const [profile, ...lists] = await Promise.all([
    supabase.from("profiles").select("mode").eq("id", userId).maybeSingle(),
    ...MEAL_PERIODS.map((p) => getSafeItems(userId, p, date, { location: slug })),
  ])

  return (
    <>
      {/* Feed me builds plates from Scott's menu only. */}
      {slug === SCOTT_SLUG && (
        <div className="mt-4 md:max-w-sm">
          <FeedMeButton />
        </div>
      )}
      <MenuBrowser
        menus={{ breakfast: lists[0], lunch: lists[1], dinner: lists[2] }}
        defaultPeriod={currentMealPeriod()}
        showCalories={profile.data?.mode === "macros"}
      />
    </>
  )
}

async function ComingSoon({ userId, slug }: { userId: string; slug: string }) {
  const items = await getSafeSampleItems(userId, slug)
  return (
    <>
      <p className="mt-4 border-l-2 border-primary bg-primary/5 px-3 py-2 text-sm font-medium" role="status">
        Coming soon: full menu and Feed me
      </p>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Sample items aren&apos;t posted yet.</p>
      ) : (
        <>
          <h2 className="pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sample items</h2>
          <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className="border bg-card px-3 py-2">
                <span className="block text-sm font-medium">{item.name}</span>
                {item.station?.name && <span className="block text-xs text-muted-foreground">{item.station.name}</span>}
                <NutrientBadges tags={item.nutrient_tags} className="mt-1" />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export default function MenuPage({ searchParams }: PageProps<"/menu">) {
  return (
    <PageContainer>
      <h1 className="text-xl font-semibold">Menu</h1>
      <p className="text-sm text-muted-foreground">Today&apos;s menus, filtered for you.</p>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading menu…</p>}>
        <Menu searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}
