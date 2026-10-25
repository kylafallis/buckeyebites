import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { recipeBook } from "@/lib/recipes"
import { PageContainer } from "@/components/page-container"
import { RecipeBook } from "./recipe-book"

export const metadata: Metadata = {
  title: "Recipe book · BuckeyeBites",
}

async function Recipes() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const [cards, saved] = await Promise.all([
    recipeBook(supabase, userId),
    supabase.from("saved_recipes").select("recipe_id").eq("user_id", userId),
  ])
  // Before migration 005 runs the table doesn't exist; hearts are disabled then.
  if (saved.error) console.error("Loading saved recipes failed:", saved.error.message)

  return (
    <RecipeBook
      userId={userId}
      cards={cards}
      savedIds={saved.error ? null : saved.data.map((r) => r.recipe_id as number)}
    />
  )
}

export default function RecipesPage() {
  return (
    <PageContainer>
      <h1 className="text-xl font-semibold">Recipe book</h1>
      <p className="text-sm text-muted-foreground">Plates that fit you on today&apos;s Scott menu.</p>
      <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading recipes…</p>}>
        <Recipes />
      </Suspense>
    </PageContainer>
  )
}
