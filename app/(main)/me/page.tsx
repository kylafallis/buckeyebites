import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { SignOutIcon } from "@phosphor-icons/react/ssr"
import { createClient } from "@/lib/supabase/server"
import { ALLERGENS, DIETS, labelFor, MODES, NUTRIENTS } from "@/lib/preferences"
import { PageContainer } from "@/components/page-container"
import { Button, buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Me · BuckeyeBites",
}

async function Me() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const [{ data: profile }, { data: allergens }] = await Promise.all([
    supabase.from("profiles").select("display_name, diet, mode, focus_nutrients, goals").eq("id", userId).maybeSingle(),
    supabase.from("user_allergens").select("allergen").eq("user_id", userId),
  ])

  const signupName = (claims?.claims?.user_metadata as { display_name?: unknown } | undefined)?.display_name
  const name = profile?.display_name?.trim() || (typeof signupName === "string" ? signupName.trim() : "")
  const mode = profile?.mode ?? "balanced"
  const protein = Number((profile?.goals as Record<string, unknown> | null)?.protein_g)
  const goalDetail =
    mode === "nutrients" && (profile?.focus_nutrients ?? []).length > 0
      ? (profile!.focus_nutrients as string[]).map((n) => labelFor(NUTRIENTS, n)).join(", ")
      : mode === "macros" && Number.isFinite(protein) && protein > 0
        ? `${protein} g protein a day`
        : null

  const rows: [string, string][] = [
    ["Name", name || "Not set"],
    ["Email", typeof claims?.claims?.email === "string" ? claims.claims.email : "—"],
    ["Diet", labelFor(DIETS, profile?.diet ?? "none")],
    [
      "Allergies",
      (allergens ?? []).length > 0 ? allergens!.map((a) => labelFor(ALLERGENS, a.allergen)).join(", ") : "None",
    ],
    ["Goal", [labelFor(MODES, mode), goalDetail].filter(Boolean).join(": ")],
  ]

  return (
    <>
      <dl className="mt-4 divide-y border-y bg-card">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-3 py-3 text-sm">
            <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link href="/onboarding" className={buttonVariants({ className: "h-11 px-5 text-sm" })}>
          Edit preferences
        </Link>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" className="h-11 w-full px-5 text-sm">
            <SignOutIcon /> Sign out
          </Button>
        </form>
      </div>
    </>
  )
}

export default function MePage() {
  return (
    <PageContainer narrow>
      <h1 className="text-xl font-semibold">Me</h1>
      <p className="text-sm text-muted-foreground">Your preferences. Plates and menus are filtered with these.</p>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
        <Me />
      </Suspense>
    </PageContainer>
  )
}
