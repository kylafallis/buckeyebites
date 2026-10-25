import { createClient } from "@/lib/supabase/server"
import { pickPlate, PlateError } from "@/lib/plate"

/** Feed me: returns a ready-made plate for the current meal. Body (optional): { exclude: recipeId }. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return Response.json({ error: "Sign in to build a plate." }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { exclude?: unknown }
  const exclude = Number.isInteger(body.exclude) ? (body.exclude as number) : undefined

  try {
    return Response.json(await pickPlate(supabase, userId, exclude))
  } catch (error) {
    if (error instanceof PlateError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error("POST /api/plate failed:", error)
    return Response.json({ error: "Something went wrong building your plate." }, { status: 500 })
  }
}
