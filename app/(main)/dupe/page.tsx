import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DupeMaker } from "./dupe-maker"

export const metadata: Metadata = {
  title: "Recipe dupe · BuckeyeBites",
}

export default async function DupePage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-xl font-semibold">Recipe dupe</h1>
      <p className="text-sm text-muted-foreground">
        Found a recipe online? We&apos;ll make it from what&apos;s at Scott right now.
      </p>
      <DupeMaker userId={userId} />
    </main>
  )
}
