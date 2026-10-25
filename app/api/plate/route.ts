import { createClient } from "@/lib/supabase/server"
import { isIsoDate, MEAL_PERIODS, type MealPeriod } from "@/lib/menu-shared"
import { pickPlate, PlateError } from "@/lib/plate"

/**
 * Feed me: returns a ready-made plate. Body (all optional):
 * { exclude: recipeId, date: "YYYY-MM-DD", meal_period: "breakfast" | "lunch" | "dinner" }.
 * Defaults to the current meal on today's menu.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return Response.json({ error: "Sign in to build a plate." }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { exclude?: unknown; date?: unknown; meal_period?: unknown }
  const exclude = Number.isInteger(body.exclude) ? (body.exclude as number) : undefined
  if (body.date != null && !isIsoDate(body.date)) {
    return Response.json({ error: "date must be YYYY-MM-DD." }, { status: 400 })
  }
  if (body.meal_period != null && !MEAL_PERIODS.includes(body.meal_period as MealPeriod)) {
    return Response.json({ error: "meal_period must be breakfast, lunch or dinner." }, { status: 400 })
  }
  const slot = { date: body.date ?? undefined, meal: (body.meal_period as MealPeriod | undefined) ?? undefined }

  try {
    return Response.json(await pickPlate(supabase, userId, exclude, slot))
  } catch (error) {
    if (error instanceof PlateError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error("POST /api/plate failed:", error)
    return Response.json({ error: "Something went wrong building your plate." }, { status: 500 })
  }
}
