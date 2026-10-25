// Demo data: 5 persona accounts and 150 simulated students.
//
//   npx tsx scripts/demo.ts             create them
//   npx tsx scripts/demo.ts --dry-run   plan and check only, write nothing
//   npx tsx scripts/demo.ts --today=2026-10-25   plan around another date
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local,
// migrations 006-008 run, the menu synced and the ready-made plates imported.
//
// Personas get onboarding, 12 swipes, logged meals for the two days before
// today plus today's breakfast, and tomorrow's lunch and dinner planned.
// Simulated students (profiles.is_simulated = true) get 10-20 swipes and 1-3
// plans for tomorrow, which is what the Insights page charts. Every food goes
// through the app's own allergen and diet rules. Safe to run again: existing
// emails are skipped.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { SCOTT_SLUG, todayInColumbus, MEAL_PERIODS, type MealPeriod } from "../lib/menu-shared"
import { audit, Menu, PERSONAS, planPersona, planSimulated, type DemoFood, type DemoPlate, type PersonPlan } from "./demo-plan"

try {
  process.loadEnvFile(".env.local")
} catch {
  console.error("✖ No .env.local here. Run this from the buckeyebites folder.")
  process.exit(1)
}

const DRY_RUN = process.argv.includes("--dry-run")
const TODAY = process.argv.find((a) => a.startsWith("--today="))?.slice(8) ?? todayInColumbus()
const SIMULATED = 150
const PASSWORD = process.env.DEMO_PASSWORD || "BuckeyeBite2026!"
const PAGE = 1000
const CONCURRENCY = 5

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const FOOD_COLUMNS =
  "id, name, meal_period, served_on, allergens, diet_tags, food_group, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, iron_mg, calcium_mg, vit_d_mcg, nutrient_tags, locations!inner(slug)"

async function loadMenu(db: SupabaseClient): Promise<DemoFood[]> {
  const foods: DemoFood[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("menu_items")
      .select(FOOD_COLUMNS)
      .eq("locations.slug", SCOTT_SLUG)
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) fail(`Reading menu_items failed: ${error.message}`)
    for (const row of data as unknown as (DemoFood & { locations?: unknown })[]) {
      delete row.locations
      foods.push({ ...row, allergens: row.allergens ?? [], diet_tags: row.diet_tags ?? [], nutrient_tags: row.nutrient_tags ?? [] })
    }
    if (data.length < PAGE) break
  }
  return foods
}

async function loadPlates(db: SupabaseClient): Promise<DemoPlate[]> {
  const { data, error } = await db
    .from("recipes")
    .select("id, title, tags, recipe_items(servings, menu_items(name))")
    .eq("source", "curated")
    .order("id")
  if (error) fail(`Reading recipes failed: ${error.message}`)
  type Row = { id: number; title: string | null; tags: string[] | null; recipe_items: { servings: number | null; menu_items: { name: string } | null }[] }
  return (data as unknown as Row[])
    .map((r) => ({
      id: r.id,
      title: r.title ?? "Plate",
      meals: (r.tags ?? []).filter((t): t is MealPeriod => MEAL_PERIODS.includes(t as MealPeriod)),
      items: r.recipe_items.flatMap((ri) => (ri.menu_items ? [{ name: ri.menu_items.name, servings: ri.servings ?? 1 }] : [])),
    }))
    .filter((p) => p.items.length > 0)
}

async function existingEmails(db: SupabaseClient) {
  const emails = new Set<string>()
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) fail(`Listing users failed: ${error.message}`)
    data.users.forEach((u) => u.email && emails.add(u.email.toLowerCase()))
    if (data.users.length < 1000) break
  }
  return emails
}

/** Creates one account and everything planned for it. Returns an error message, or null. */
async function write(db: SupabaseClient, plan: PersonPlan): Promise<string | null> {
  const p = plan.person
  const created = await db.auth.admin.createUser({
    email: p.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: p.displayName },
  })
  if (created.error) return `creating the account: ${created.error.message}`
  const userId = created.data.user.id

  const steps: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    [
      "the profile",
      db.from("profiles").upsert({
        id: userId,
        display_name: p.displayName,
        diet: p.diets[0] ?? "none",
        diets: p.diets,
        mode: p.mode,
        focus_nutrients: p.focusNutrients,
        goals: p.goals,
        meals_per_day: 3,
        snacks_per_day: 1,
        desserts_per_day: 0,
        onboarded: true,
        is_simulated: p.simulated,
      }),
    ],
  ]
  if (p.allergens.length > 0) {
    steps.push(["allergies", db.from("user_allergens").insert(p.allergens.map((allergen) => ({ user_id: userId, allergen })))])
  }
  if (plan.swipes.length > 0) {
    steps.push([
      "swipes",
      db.from("food_swipes").upsert(
        plan.swipes.map((s) => ({ user_id: userId, menu_item_id: s.menuItemId, liked: s.liked })),
        { onConflict: "user_id,menu_item_id" }
      ),
    ])
  }
  if (plan.logs.length > 0) {
    steps.push([
      "logged meals",
      db.from("meal_logs").insert(
        plan.logs.map((l) => ({ user_id: userId, eaten_on: l.eatenOn, meal_period: l.meal, recipe_id: l.recipeId, totals: l.totals, created_at: l.createdAt }))
      ),
    ])
  }
  if (plan.plans.length > 0) {
    steps.push([
      "meal plans",
      db.from("meal_plans").insert(plan.plans.map((m) => ({ user_id: userId, plan_date: m.planDate, meal_period: m.meal, recipe_id: m.recipeId }))),
    ])
  }
  for (const [what, step] of steps) {
    const { error } = await step
    if (error) return `saving ${what}: ${error.message}`
  }
  return null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local")
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // Columns from migrations 007 and 008.
  const probe = await db.from("profiles").select("diets, is_simulated").limit(1)
  if (probe.error) {
    fail(`profiles is missing a column (${probe.error.message}). Run supabase/migrations/007_profile_diets.sql and 008_simulated_profiles.sql in the Supabase SQL Editor first.`)
  }

  const [foods, plates] = await Promise.all([loadMenu(db), loadPlates(db)])
  if (foods.length === 0) fail("menu_items has no Scott foods. Run the sheet sync first.")
  if (plates.length === 0) fail("There are no ready-made plates. Run npx tsx scripts/import-recipes.ts first.")
  const menu = new Menu(foods)
  console.log(`Planning around ${TODAY}: ${foods.length} menu rows, ${plates.length} ready-made plates`)

  const plans = [
    ...PERSONAS.map((p, i) => planPersona(menu, plates, p, TODAY, i + 1)),
    ...Array.from({ length: SIMULATED }, (_, i) => planSimulated(menu, plates, i + 1, TODAY)),
  ]

  const problems = audit(menu, plates, plans)
  if (problems.length > 0) {
    console.error(`\n✖ Allergen audit failed (${problems.length}). Nothing was written.`)
    problems.slice(0, 20).forEach((p) => console.error(`  - ${p}`))
    process.exit(1)
  }

  console.log("\nPersonas:")
  for (const { person, swipes, logs, plans: future } of plans.slice(0, PERSONAS.length)) {
    const who = [person.diets.join(", "), person.allergens.length ? `no ${person.allergens.join(" or ")}` : "", person.mode].filter(Boolean).join(" · ")
    console.log(`  ${person.displayName.padEnd(9)} ${who.padEnd(32)} ${swipes.length} swipes, ${logs.length} meals logged, ${future.length} planned`)
  }
  const sims = plans.slice(PERSONAS.length)
  const planned = sims.reduce((s, p) => s + p.plans.length, 0)
  const withAllergy = sims.filter((p) => p.person.allergens.length > 0).length
  console.log(`Simulated students: ${sims.length} (${withAllergy} with allergies), ${sims.reduce((s, p) => s + p.swipes.length, 0)} swipes, ${planned} meals planned for tomorrow`)
  const unplanned = plans.filter((p) => p.plans.length === 0).length
  if (unplanned > 0) console.log(`  (${unplanned} people had no safe plate for their meals tomorrow and plan nothing)`)
  console.log("✔ Allergen audit: 0 problems across every swipe, logged meal and plan")

  if (DRY_RUN) {
    console.log("\nDry run: nothing was written.")
    return
  }

  const existing = await existingEmails(db)
  const todo = plans.filter((p) => !existing.has(p.person.email))
  console.log(`\nCreating ${todo.length} accounts (${plans.length - todo.length} already exist and are skipped)...`)

  let done = 0
  const failures: string[] = []
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((p) => write(db, p)))
    results.forEach((err, j) => (err ? failures.push(`${batch[j].person.email}: ${err}`) : done++))
    process.stdout.write(`\r  ${done + failures.length}/${todo.length}`)
  }
  console.log("")

  if (failures.length > 0) {
    console.error(`\n✖ ${failures.length} failed:`)
    failures.slice(0, 20).forEach((f) => console.error(`  - ${f}`))
  }
  console.log(`\n✔ Created ${done} accounts.`)
  console.log(`\nPersona logins (password for all: ${PASSWORD}):`)
  PERSONAS.forEach((p) => console.log(`  ${p.displayName.padEnd(9)} ${p.email}`))
  console.log("\nShare these privately with the team, not in a public channel.")
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
