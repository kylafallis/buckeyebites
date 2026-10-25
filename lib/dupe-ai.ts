import "server-only"
import { GoogleGenAI } from "@google/genai"
import { isSauce, type MealPeriod, type MenuItem } from "@/lib/menu-shared"
import { isSauceIngredient } from "@/lib/dupe"
import type { DupeIngredient } from "@/lib/dupe-shared"
import { DUPE_SYSTEM_PROMPT } from "@/lib/prompts"

// Flash-lite answered in ~1.5 s in testing; full flash took 70-100 s.
const DEFAULT_MODEL = "gemini-flash-lite-latest"
const TIMEOUT_MS = 20_000
const MAX_STEPS = 5
const STATUSES = ["matched", "swapped", "pantry", "missing"] as const

const nullable = (type: string) => ({ type: [type, "null"] })
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    recipe: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ingredient: { type: "string" },
          quantity: nullable("string"),
          status: { type: "string", enum: STATUSES },
          id: nullable("integer"),
          name: nullable("string"),
          station: nullable("string"),
          reason: nullable("string"),
        },
        required: ["ingredient", "quantity", "status", "id", "name", "station", "reason"],
      },
    },
    steps: { type: "array", items: { type: "string" } },
    stations: { type: "array", items: { type: "string" } },
  },
  required: ["recipe", "ingredients", "steps", "stations"],
}

type RawEntry = { status?: unknown; id?: unknown; reason?: unknown; quantity?: unknown }

/**
 * Asks Gemini to match ingredients (DUPE_SYSTEM_PROMPT) to the user's safe
 * items. Returns null if AI isn't configured or the call fails or times out,
 * so the caller can fall back to the keyword matcher.
 *
 * The answer is never trusted: every id must be in `safeItems` (otherwise
 * that line becomes "missing"), a sauce item can only match a sauce
 * ingredient, names and stations come from the menu rows, and there is
 * exactly one entry per ingredient line, in order.
 */
export async function aiMatchIngredients(
  recipeName: string | null,
  ingredients: string[],
  meal: MealPeriod,
  safeItems: MenuItem[]
): Promise<{ matches: DupeIngredient[]; steps: string[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const available = safeItems.map((i) => ({
    id: i.id,
    name: i.name,
    station: i.station?.name ?? null,
    serving: i.serving_size,
    tags: i.diet_tags,
    is_sauce: isSauce(i),
  }))
  const contents = [
    `RECIPE_NAME: ${recipeName ?? ""}`,
    `MEAL: ${meal}`,
    "RECIPE_INGREDIENTS:",
    ...ingredients,
    `AVAILABLE_ITEMS: ${JSON.stringify(available)}`,
  ].join("\n")

  let raw: { ingredients?: unknown; steps?: unknown; error?: unknown }
  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: process.env.DUPE_MODEL || DEFAULT_MODEL,
      contents,
      config: {
        systemInstruction: DUPE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    })
    raw = JSON.parse(response.text ?? "")
  } catch (error) {
    console.error("Dupe AI call failed, using keyword matcher:", error instanceof Error ? error.message : error)
    return null
  }
  if (!raw || typeof raw !== "object" || raw.error || !Array.isArray(raw.ingredients)) return null

  const entries = raw.ingredients as RawEntry[]
  if (entries.length !== ingredients.length) {
    console.warn(`Dupe AI returned ${entries.length} entries for ${ingredients.length} ingredients`)
  }
  const safe = new Map(safeItems.map((i) => [i.id, i]))
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "")

  // One entry per input line, by position; a line the model skipped is missing.
  const matches = ingredients.map((ingredient, i): DupeIngredient => {
    const entry = entries[i] ?? {}
    const quantity = text(entry.quantity, 40) || null
    const status = STATUSES.includes(entry.status as (typeof STATUSES)[number])
      ? (entry.status as DupeIngredient["status"])
      : "missing"
    if (status === "pantry") return { ingredient, quantity, status, item: null, reason: "" }
    if (status === "missing") return { ingredient, quantity, status, item: null, reason: text(entry.reason, 120) }

    const item = safe.get(Number(entry.id))
    if (!item) return { ingredient, quantity, status: "missing", item: null, reason: "Not on today's menu for you" }
    if (isSauce(item) && !isSauceIngredient(ingredient)) {
      return { ingredient, quantity, status: "missing", item: null, reason: "Only a sauce is available for this" }
    }
    return {
      ingredient,
      quantity,
      status,
      item: { id: item.id, name: item.name, station: item.station?.name ?? null },
      reason: status === "swapped" ? text(entry.reason, 120) : "",
    }
  })

  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s) => text(s, 200))
    .filter(Boolean)
    .slice(0, MAX_STEPS)
  return { matches, steps }
}
