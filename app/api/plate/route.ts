import { createClient } from "@/lib/supabase/server"
import { buildPlate, PlateError } from "@/lib/plate"

// Two 25s Gemini tries plus saving: stop well before the platform limit.
export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return Response.json({ error: "Sign in to build a plate." }, { status: 401 })

  try {
    return Response.json(await buildPlate(supabase, userId))
  } catch (error) {
    if (error instanceof PlateError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error("POST /api/plate failed:", error)
    return Response.json({ error: "Something went wrong building your plate." }, { status: 500 })
  }
}
