import "server-only"
import { GoogleGenAI } from "@google/genai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSafeItems } from "@/lib/menu.server"
import {
  currentMealPeriod,
  NUTRIENT_TAGS,
  SCOTT_SLUG,
  todayInColumbus,
  type MealPeriod,
  type MenuItem,
} from "@/lib/menu-shared"
import { PLATE_SYSTEM_PROMPT } from "@/lib/prompts"
import { computeTotals, focusField } from "@/lib/totals"

const DEFAULT_MODEL = "gemini-flash-latest"
const MIN_ITEMS = 2
const MAX_ITEMS = 4
const MAX_REASON_WORDS = 25
const PREVIOUS_PLATE_COUNT = 5

// What each DIET value means in AVAILABLE_ITEMS' Tags, so the model's tag
// check matches getSafeItems (which has already applied it).
const DIET_DESCRIPTIONS: Record<string, string> = {
  none: "none (no restrictions; every item is allowed)",
  vegetarian: "vegetarian",
  vegan: "vegan",
  pescatarian: 'pescatarian (tags "pescatarian", "vegetarian" or "vegan")',
  halal_friendly: 'halal-friendly (tags "halal" or "vegetarian")',
}

export class PlateError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

type Context = {
  userId: string
  meal: MealPeriod
  diet: string
  mode: string
  focusNutrients: string[]
  proteinTarget: number | null
  allergens: Set<string>
  likes: string[]
  dislikes: string[]
  /** Item ids of this user's recent AI plates, most recent first. */
  previousPlates: number[][]
  items: MenuItem[]
}

type Plate = {
  title: string
  reason: string
  order: string[]
  items: { item: MenuItem; servings: number }[]
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    items: {
      type: "array",
      minItems: MIN_ITEMS,
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        properties: { id: { type: "integer" }, name: { type: "string" }, servings: { type: "number" } },
        required: ["id", "name", "servings"],
      },
    },
    total_protein_g: { type: "number" },
    reason: { type: "string" },
    order: { type: "array", items: { type: "string" } },
    repeat: { type: "boolean" },
  },
  required: ["title", "items", "total_protein_g", "reason", "order", "repeat"],
}

async function loadContext(supabase: SupabaseClient, userId: string): Promise<Context> {
  const meal = currentMealPeriod()
  const [profile, allergens, swipes, previous, items] = await Promise.all([
    supabase
      .from("profiles")
      .select("diet, mode, focus_nutrients, goals, meals_per_day")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_allergens").select("allergen").eq("user_id", userId),
    supabase.from("food_swipes").select("liked, menu_items(name)").eq("user_id", userId),
    supabase
      .from("recipes")
      .select("recipe_items(menu_item_id)")
      .eq("created_by", userId)
      .eq("source", "ai")
      .order("created_at", { ascending: false })
      .limit(PREVIOUS_PLATE_COUNT),
    getSafeItems(userId, meal, todayInColumbus(), { forPlate: true }),
  ])
  if (profile.error) throw profile.error
  if (allergens.error) throw allergens.error
  if (swipes.error) throw swipes.error
  if (previous.error) throw previous.error

  const p = profile.data
  const mode = p?.mode ?? "balanced"
  const dailyProtein = Number((p?.goals as Record<string, unknown> | null)?.protein_g)
  const meals = Math.max(1, p?.meals_per_day ?? 3)

  const names = (liked: boolean) => [
    ...new Set(
      (swipes.data as unknown as { liked: boolean; menu_items: { name: string } | null }[])
        .filter((s) => s.liked === liked && s.menu_items)
        .map((s) => s.menu_items!.name)
    ),
  ].slice(0, 30)

  return {
    userId,
    meal,
    diet: p?.diet ?? "none",
    mode,
    focusNutrients: p?.focus_nutrients ?? [],
    proteinTarget:
      mode === "macros" && Number.isFinite(dailyProtein) && dailyProtein > 0
        ? Math.round(dailyProtein / meals)
        : null,
    allergens: new Set(allergens.data.map((a) => a.allergen)),
    likes: names(true),
    dislikes: names(false),
    previousPlates: (previous.data as { recipe_items: { menu_item_id: number }[] }[]).map((r) =>
      r.recipe_items.map((ri) => ri.menu_item_id)
    ),
    items,
  }
}

function userPrompt(ctx: Context) {
  // Keys match the column names the system prompt refers to. Nutrition is per serving.
  const available = ctx.items.map((i) => ({
    id: i.id,
    name: i.name,
    Station: i.station?.name ?? null,
    Serving: i.serving_size,
    Tags: i.diet_tags,
    Food_group: i.food_group,
    Calories: i.calories,
    Protein_g: i.protein_g,
    Carbs_g: i.carbs_g,
    Fat_g: i.fat_g,
    Fiber_g: i.fiber_g,
    nutrient_tags: i.nutrient_tags,
  }))
  return [
    `MEAL: ${ctx.meal}`,
    `DIET: ${DIET_DESCRIPTIONS[ctx.diet] ?? ctx.diet}`,
    `MODE: ${ctx.mode}`,
    `PROTEIN_TARGET: ${ctx.proteinTarget != null ? `${ctx.proteinTarget}g` : "none"}`,
    `FOCUS_NUTRIENTS: ${JSON.stringify(ctx.focusNutrients)}`,
    `LIKES: ${JSON.stringify(ctx.likes)}`,
    `DISLIKES: ${JSON.stringify(ctx.dislikes)}`,
    `PREVIOUS_PLATES: ${JSON.stringify(ctx.previousPlates)}`,
    `AVAILABLE_ITEMS: ${JSON.stringify(available)}`,
  ].join("\n")
}

async function askModel(ctx: Context, feedback?: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const ai = new GoogleGenAI({ apiKey })
  const contents = feedback
    ? `${userPrompt(ctx)}\n\nYour previous answer was rejected: ${feedback}. Fix it and answer again.`
    : userPrompt(ctx)

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents,
    config: {
      systemInstruction: PLATE_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    },
  })
  return JSON.parse(response.text ?? "")
}

/** Checks the model's answer against the items we sent. Returns problems, or the plate. */
function validate(raw: unknown, ctx: Context): { plate: Plate } | { problems: string } {
  const r = raw as { title?: unknown; items?: unknown; reason?: unknown; order?: unknown; repeat?: unknown } | null
  if (!r || typeof r !== "object" || !Array.isArray(r.items)) return { problems: "response was not the expected JSON" }

  const byId = new Map(ctx.items.map((i) => [i.id, i]))
  const problems: string[] = []
  const seen = new Set<number>()
  const items: Plate["items"] = []

  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  for (const entry of r.items as { id?: unknown; name?: unknown; servings?: unknown }[]) {
    const item = byId.get(Number(entry?.id))
    if (!item) {
      problems.push(`id ${String(entry?.id)} is not in AVAILABLE_ITEMS`)
      continue
    }
    // The name is there to catch miscopied ids.
    if (typeof entry.name === "string" && !sameName(entry.name, item.name)) {
      problems.push(`id ${item.id} is "${item.name}", not "${entry.name}"`)
      continue
    }
    if (seen.has(item.id)) {
      problems.push(`id ${item.id} is listed twice`)
      continue
    }
    const overlap = item.allergens.filter((a) => ctx.allergens.has(a))
    if (overlap.length > 0) problems.push(`${item.name} contains ${overlap.join(", ")}`)
    seen.add(item.id)

    const servings = Number(entry?.servings)
    items.push({
      item,
      servings: Number.isFinite(servings) ? Math.min(3, Math.max(0.5, Math.round(servings * 2) / 2)) : 1,
    })
  }
  if (items.length < MIN_ITEMS || items.length > MAX_ITEMS) {
    problems.push(`plate must have ${MIN_ITEMS} to ${MAX_ITEMS} items, got ${items.length}`)
  }
  const ids = [...seen].sort((a, b) => a - b).join(",")
  const repeated = ctx.previousPlates.some((plate) => [...plate].sort((a, b) => a - b).join(",") === ids)
  if (repeated && r.repeat !== true) {
    problems.push("that plate matches one in PREVIOUS_PLATES; build a different one or set repeat to true")
  }
  if (problems.length > 0) return { problems: problems.join("; ") }

  return {
    plate: {
      title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 80) : "Your plate",
      reason:
        typeof r.reason === "string"
          ? r.reason.trim().split(/\s+/).slice(0, MAX_REASON_WORDS).join(" ")
          : "",
      order: walkingOrder(Array.isArray(r.order) ? r.order.map(String) : [], items),
      items,
    },
  }
}

/** The model's station order, limited to stations on the plate, plus any it missed. */
function walkingOrder(proposed: string[], items: Plate["items"]) {
  const onPlate = [...new Set(items.map(({ item }) => item.station?.name).filter((s): s is string => !!s))]
  const ordered = [...new Set(proposed)].filter((s) => onPlate.includes(s))
  return [...ordered, ...onPlate.filter((s) => !ordered.includes(s))]
}

// Rough daily references, only used to rank curated fallbacks.
const DAILY_REFERENCE: Record<string, number> = { iron_mg: 18, calcium_mg: 1300, fiber_g: 28, vit_d_mcg: 20 }

export type CuratedPlate = { id: number; title: string | null; parts: { item: MenuItem; servings: number }[] }

/**
 * Curated recipes whose items are all in `items`. Pass items from
 * getSafeItems(..., { forPlate: true }) so every plate is safe for the user.
 */
export async function safeCuratedPlates(supabase: SupabaseClient, items: MenuItem[]): Promise<CuratedPlate[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, recipe_items(menu_item_id, servings)")
    .eq("source", "curated")
    .order("id")
  if (error) throw error

  const byId = new Map(items.map((i) => [i.id, i]))
  const plates: CuratedPlate[] = []
  for (const recipe of data as {
    id: number
    title: string | null
    recipe_items: { menu_item_id: number; servings: number | null }[]
  }[]) {
    if (recipe.recipe_items.length === 0) continue
    const parts = recipe.recipe_items.map((ri) => ({ item: byId.get(ri.menu_item_id), servings: ri.servings ?? 1 }))
    if (parts.some((p) => !p.item)) continue
    plates.push({ id: recipe.id, title: recipe.title, parts: parts as CuratedPlate["parts"] })
  }
  return plates
}

/** Best curated recipe whose items are all safe for this user right now. */
async function curatedFallback(supabase: SupabaseClient, ctx: Context): Promise<number | null> {
  let plates: CuratedPlate[]
  try {
    plates = await safeCuratedPlates(supabase, ctx.items)
  } catch {
    return null
  }

  let best: { id: number; score: number } | null = null
  for (const { id, parts } of plates) {
    const totals = computeTotals(parts)
    let score = 0
    for (const { item } of parts) {
      if (ctx.likes.includes(item.name)) score += 2
      if (ctx.dislikes.includes(item.name)) score -= 3
    }
    for (const nutrient of ctx.focusNutrients) {
      const tag = NUTRIENT_TAGS.find((n) => n.focus === nutrient)?.tag
      const key = focusField(nutrient)
      if (tag) score += parts.filter(({ item }) => item.nutrient_tags.includes(tag)).length * 2
      else if (key) score += (totals[key] / (DAILY_REFERENCE[key] ?? 1)) * 5
    }
    if (ctx.proteinTarget != null) score -= Math.abs(totals.protein_g - ctx.proteinTarget) / 10

    if (!best || score > best.score) best = { id, score }
  }
  return best?.id ?? null
}

async function saveRecipe(ctx: Context, plate: Plate): Promise<number> {
  const admin = createAdminClient()
  const { data: location } = await admin.from("locations").select("id").eq("slug", SCOTT_SLUG).maybeSingle()

  const { data: recipe, error } = await admin
    .from("recipes")
    .insert({
      title: plate.title,
      blurb: plate.reason,
      source: "ai",
      location_id: location?.id ?? null,
      steps: plate.order,
      tags: [ctx.meal],
      totals: computeTotals(plate.items),
      created_by: ctx.userId,
    })
    .select("id")
    .single()
  if (error) throw error

  const { error: itemsError } = await admin.from("recipe_items").insert(
    plate.items.map(({ item, servings }) => ({ recipe_id: recipe.id, menu_item_id: item.id, servings }))
  )
  if (itemsError) {
    await admin.from("recipes").delete().eq("id", recipe.id)
    throw itemsError
  }
  return recipe.id
}

/**
 * Builds a plate for the signed-in user's current meal: asks the model (one
 * retry on an invalid answer), else falls back to the best curated recipe.
 */
export async function buildPlate(
  supabase: SupabaseClient,
  userId: string
): Promise<{ recipeId: number; source: "ai" | "curated" }> {
  const ctx = await loadContext(supabase, userId)

  if (ctx.items.length >= MIN_ITEMS) {
    let feedback: string | undefined
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = validate(await askModel(ctx, feedback), ctx)
        if ("plate" in result) return { recipeId: await saveRecipe(ctx, result.plate), source: "ai" }
        feedback = result.problems
        console.warn(`Plate attempt ${attempt + 1} rejected: ${feedback}`)
      } catch (error) {
        console.error(`Plate attempt ${attempt + 1} failed:`, error)
        feedback = "the response could not be parsed as the required JSON"
      }
    }
  }

  const curatedId = await curatedFallback(supabase, ctx)
  if (curatedId != null) return { recipeId: curatedId, source: "curated" }

  throw new PlateError(
    ctx.items.length < MIN_ITEMS
      ? "There aren't enough items on Scott's menu for you right now."
      : "We couldn't build a plate right now. Try again in a minute.",
    ctx.items.length < MIN_ITEMS ? 422 : 503
  )
}
