// Pure planning for scripts/demo.ts: who the demo people are and what they
// swipe, eat and plan. No database calls here, so it can be tested offline.
// Every food choice goes through the app's own rules (fitsDiet, isSauce,
// isPlateItem), so personas and simulated students only get food that's safe
// for their allergies and diet.

import { fitsDiet, foodKey, isPlateItem, isSauce, type MealPeriod } from "../lib/menu-shared"
import { computeTotals, type Totals } from "../lib/totals"

export type DemoFood = {
  id: number
  name: string
  meal_period: MealPeriod
  served_on: string
  allergens: string[]
  diet_tags: string[]
  food_group: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  sugar_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  iron_mg: number | null
  calcium_mg: number | null
  vit_d_mcg: number | null
  nutrient_tags: string[]
}

export type DemoPlate = { id: number; title: string; meals: MealPeriod[]; items: { name: string; servings: number }[] }

export type Person = {
  email: string
  displayName: string
  diets: string[]
  allergens: string[]
  mode: "balanced" | "nutrients" | "macros"
  focusNutrients: string[]
  goals: Record<string, number>
  simulated: boolean
}

export type PersonPlan = {
  person: Person
  swipes: { menuItemId: number; liked: boolean }[]
  logs: { eatenOn: string; meal: MealPeriod; recipeId: number; totals: Totals; createdAt: string }[]
  plans: { planDate: string; meal: MealPeriod; recipeId: number }[]
}

export const PERSONAS: Person[] = [
  { email: "rachel@buckeyebite.test", displayName: "Rachel", diets: ["vegetarian"], allergens: [], mode: "balanced", focusNutrients: [], goals: {}, simulated: false },
  { email: "maddie@buckeyebite.test", displayName: "Maddie", diets: [], allergens: ["milk", "egg"], mode: "balanced", focusNutrients: [], goals: {}, simulated: false },
  { email: "lily@buckeyebite.test", displayName: "Lily", diets: [], allergens: [], mode: "nutrients", focusNutrients: ["iron"], goals: {}, simulated: false },
  { email: "victoria@buckeyebite.test", displayName: "Victoria", diets: [], allergens: [], mode: "nutrients", focusNutrients: ["vit_d"], goals: {}, simulated: false },
  { email: "hanna@buckeyebite.test", displayName: "Hanna", diets: [], allergens: [], mode: "macros", focusNutrients: [], goals: { protein_g: 120 }, simulated: false },
]

const MEALS: MealPeriod[] = ["breakfast", "lunch", "dinner"]
const MEAL_HOUR: Record<MealPeriod, number> = { breakfast: 8, lunch: 12, dinner: 18 }

/** Small seeded random generator, so reruns plan the same things. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rand = () => number
const pick = <T>(rand: Rand, list: T[]) => list[Math.floor(rand() * list.length)]
function weighted<T>(rand: Rand, options: [T, number][]): T {
  let r = rand() * options.reduce((s, [, w]) => s + w, 0)
  for (const [v, w] of options) if ((r -= w) <= 0) return v
  return options[options.length - 1][0]
}

/** The same filter getSafeItems applies, for one person. */
export function isSafeFor(food: DemoFood, p: Pick<Person, "allergens" | "diets">) {
  if (food.allergens.some((a) => p.allergens.includes(a))) return false
  if (p.allergens.length > 0 && food.allergens.length === 0 && food.diet_tags.length === 0) return false
  return fitsDiet(food, p.diets)
}

export class Menu {
  private bySlot = new Map<string, DemoFood[]>()
  constructor(public foods: DemoFood[]) {
    for (const f of foods) {
      const key = `${f.served_on}|${f.meal_period}`
      this.bySlot.set(key, [...(this.bySlot.get(key) ?? []), f])
    }
  }
  slot(date: string, meal: MealPeriod) {
    return this.bySlot.get(`${date}|${meal}`) ?? []
  }
  /**
   * Like safeCuratedPlates: the plate's meal tags include `meal`, and every
   * food on it is on that day's menu for that meal and safe for the person.
   * Returns the menu rows used, for totals.
   */
  plateFor(plate: DemoPlate, p: Person, date: string, meal: MealPeriod) {
    if (plate.meals.length > 0 && !plate.meals.includes(meal)) return null
    const byName = new Map<string, DemoFood>()
    for (const f of this.slot(date, meal)) {
      if (isPlateItem(f) && isSafeFor(f, p) && !byName.has(foodKey(f.name))) byName.set(foodKey(f.name), f)
    }
    const parts = plate.items.map((i) => ({ item: byName.get(foodKey(i.name)), servings: i.servings }))
    return parts.every((x) => x.item) ? (parts as { item: DemoFood; servings: number }[]) : null
  }
}

/** Plates a person can have at one meal, with a score for how well they fit. */
function options(menu: Menu, plates: DemoPlate[], p: Person, date: string, meal: MealPeriod, liked: Set<string>) {
  const out: { plate: DemoPlate; totals: Totals; score: number }[] = []
  for (const plate of plates) {
    const parts = menu.plateFor(plate, p, date, meal)
    if (!parts) continue
    const totals = computeTotals(parts)
    let score = parts.filter((x) => liked.has(foodKey(x.item.name))).length * 2
    if (p.focusNutrients.includes("iron")) score += parts.filter((x) => x.item.nutrient_tags.includes("high_iron")).length * 2
    if (p.focusNutrients.includes("vit_d")) score += parts.filter((x) => x.item.nutrient_tags.includes("vit_d")).length * 2
    if (p.goals.protein_g) score -= Math.abs(totals.protein_g - p.goals.protein_g / 3) / 10
    out.push({ plate, totals, score })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** A good plate, but not always the very best one, so days look varied. */
function choosePlate(rand: Rand, list: ReturnType<typeof options>, avoid: Set<number>) {
  const fresh = list.filter((o) => !avoid.has(o.plate.id))
  const pool = (fresh.length > 0 ? fresh : list).slice(0, 6)
  return pool.length === 0 ? null : pick(rand, pool)
}

/** Foods to swipe on: real foods (no sauces) from the swipe days, one per name, safe for the person. */
function swipeCandidates(menu: Menu, p: Person, days: string[]) {
  const seen = new Set<string>()
  const out: DemoFood[] = []
  for (const f of menu.foods) {
    if (!days.includes(f.served_on) || isSauce(f) || f.calories == null || !isSafeFor(f, p)) continue
    const key = foodKey(f.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

/** How likely someone is to like a food: higher protein and plant-forward foods do better. */
function likeChance(f: DemoFood, p: Person) {
  let chance = 0.45
  if ((f.protein_g ?? 0) >= 15) chance += 0.2
  if (f.diet_tags.includes("vegetarian") && ["veg", "fruit", "grain"].includes(f.food_group ?? "")) chance += 0.15
  if (p.focusNutrients.includes("iron") && f.nutrient_tags.includes("high_iron")) chance += 0.15
  if (p.focusNutrients.includes("vit_d") && f.nutrient_tags.includes("vit_d")) chance += 0.15
  if (f.food_group === "treat") chance -= 0.1
  return Math.min(0.9, Math.max(0.1, chance))
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Noon-ish Columbus time on a date as an ISO timestamp (EDT, UTC-4, in late October). */
const at = (date: string, hour: number, minute: number) =>
  `${date}T${String(hour + 4).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`

/**
 * A persona's demo history: 12 swipes, logged meals for the two days before
 * `today` (breakfast, lunch, dinner) plus today's breakfast, and plans for
 * tomorrow's lunch and dinner.
 */
export function planPersona(menu: Menu, plates: DemoPlate[], p: Person, today: string, seed: number): PersonPlan {
  const rand = rng(seed)
  const swipeDays = [addDays(today, -1), today, addDays(today, 1)]
  const candidates = swipeCandidates(menu, p, swipeDays)
  const swipes = shuffle(rand, candidates).slice(0, 12).map((f) => ({ menuItemId: f.id, liked: rand() < likeChance(f, p) }))
  const liked = new Set(swipes.filter((s) => s.liked).map((s) => foodKey(menu.foods.find((f) => f.id === s.menuItemId)!.name)))

  const logs: PersonPlan["logs"] = []
  const used = new Set<number>()
  const slots: [string, MealPeriod][] = [
    ...[-2, -1].flatMap((d) => MEALS.map((m): [string, MealPeriod] => [addDays(today, d), m])),
    [today, "breakfast"],
  ]
  for (const [date, meal] of slots) {
    const choice = choosePlate(rand, options(menu, plates, p, date, meal, liked), used)
    if (!choice) continue
    used.add(choice.plate.id)
    logs.push({ eatenOn: date, meal, recipeId: choice.plate.id, totals: choice.totals, createdAt: at(date, MEAL_HOUR[meal], Math.floor(rand() * 50)) })
  }

  const plans: PersonPlan["plans"] = []
  const tomorrow = addDays(today, 1)
  for (const meal of ["lunch", "dinner"] as MealPeriod[]) {
    const choice = choosePlate(rand, options(menu, plates, p, tomorrow, meal, liked), new Set())
    if (choice) plans.push({ planDate: tomorrow, meal, recipeId: choice.plate.id })
  }
  return { person: p, swipes, logs, plans }
}

function shuffle<T>(rand: Rand, list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DIET_MIX: [string[], number][] = [
  [[], 60], [["vegetarian"], 14], [["vegan"], 6], [["pescatarian"], 5], [["halal_friendly"], 8], [["gluten_free"], 5], [["vegetarian", "gluten_free"], 2],
]
const ALLERGEN_MIX: [string, number][] = [
  ["milk", 4], ["egg", 3], ["peanut", 3], ["tree_nut", 2], ["soy", 2], ["wheat", 2], ["fish", 1], ["shellfish", 2], ["sesame", 1],
]

/** One simulated student: random diet and allergies, 10-20 swipes, 1-3 plans for tomorrow. */
export function planSimulated(menu: Menu, plates: DemoPlate[], n: number, today: string): PersonPlan {
  const rand = rng(1000 + n)
  const allergens = new Set<string>()
  if (rand() < 0.25) {
    allergens.add(weighted(rand, ALLERGEN_MIX))
    if (rand() < 0.3) allergens.add(weighted(rand, ALLERGEN_MIX))
  }
  const mode = weighted<Person["mode"]>(rand, [["balanced", 60], ["nutrients", 20], ["macros", 20]])
  const person: Person = {
    email: `sim${String(n).padStart(3, "0")}@buckeyebite.test`,
    displayName: `Student ${String(n).padStart(3, "0")}`,
    diets: weighted(rand, DIET_MIX),
    allergens: [...allergens],
    mode,
    focusNutrients: mode === "nutrients" ? [pick(rand, ["iron", "vit_d", "calcium", "fiber"])] : [],
    goals: mode === "macros" ? { protein_g: pick(rand, [90, 100, 120, 140, 160]) } : {},
    simulated: true,
  }

  const tomorrow = addDays(today, 1)
  const candidates = swipeCandidates(menu, person, [today, tomorrow])
  const swipeCount = 10 + Math.floor(rand() * 11)
  const swipes = shuffle(rand, candidates).slice(0, swipeCount).map((f) => ({ menuItemId: f.id, liked: rand() < likeChance(f, person) }))
  const liked = new Set(swipes.filter((s) => s.liked).map((s) => foodKey(menu.foods.find((f) => f.id === s.menuItemId)!.name)))

  const planCount = 1 + Math.floor(rand() * 3)
  const meals = shuffle(rand, [...MEALS]).slice(0, planCount)
  const plans: PersonPlan["plans"] = []
  for (const meal of meals) {
    const choice = choosePlate(rand, options(menu, plates, person, tomorrow, meal, liked), new Set())
    if (choice) plans.push({ planDate: tomorrow, meal, recipeId: choice.plate.id })
  }
  return { person, swipes, logs: [], plans }
}

/**
 * Allergen audit over everything planned: returns one line per logged or
 * planned food that conflicts with that person's allergies (should be none).
 */
export function audit(menu: Menu, plates: DemoPlate[], plans: PersonPlan[]) {
  const problems: string[] = []
  const byId = new Map(plates.map((p) => [p.id, p]))
  for (const { person, logs, plans: future, swipes } of plans) {
    const check = (recipeId: number, date: string, meal: MealPeriod, what: string) => {
      const plate = byId.get(recipeId)!
      const parts = menu.plateFor(plate, person, date, meal)
      if (!parts) problems.push(`${person.email}: ${what} "${plate.title}" isn't safe or isn't on the ${date} ${meal} menu`)
    }
    logs.forEach((l) => check(l.recipeId, l.eatenOn, l.meal, "logged"))
    future.forEach((l) => check(l.recipeId, l.planDate, l.meal, "planned"))
    for (const s of swipes) {
      const f = menu.foods.find((x) => x.id === s.menuItemId)!
      if (!isSafeFor(f, person)) problems.push(`${person.email}: swiped ${f.name}, which isn't safe for them`)
    }
  }
  return problems
}
