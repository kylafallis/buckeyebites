// Imports Victoria's ready-made plates from data/recipes.csv into recipes and
// recipe_items (source "curated"), which is what Feed me picks from.
//
//   npx tsx scripts/import-recipes.ts             import
//   npx tsx scripts/import-recipes.ts --dry-run   check names only, write nothing
//
// CSV columns: title, meal_period, item_names, why, plus optional servings,
// steps (or "station order", stations separated by ">"), tags.
// item_names, steps and tags hold several values separated by ";"; servings
// is one number per food, in the same order, separated by "," or ";".
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Safe to run again: titles that already exist are skipped.

import { readFileSync } from "node:fs"
import Papa from "papaparse"
import { createClient } from "@supabase/supabase-js"
import { computeTotals } from "../lib/totals"

try {
  process.loadEnvFile(".env.local")
} catch {
  console.error("✖ No .env.local here. Run this from the buckeyebites folder.")
  process.exit(1)
}

const CSV_PATH = "data/recipes.csv"
const SCOTT_SLUG = "scott"
const MEALS = ["breakfast", "lunch", "dinner"]
const dryRun = process.argv.includes("--dry-run")

type Row = Record<string, string | undefined>
type MenuRow = {
  id: number
  name: string
  meal_period: string
  served_on: string
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
}

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
const list = (s: string | undefined) =>
  (s ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local")
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Read the CSV.
  let csv: string
  try {
    csv = readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "")
  } catch {
    fail(`Couldn't read ${CSV_PATH}. Put the CSV there (a "data" folder next to package.json).`)
  }
  const parsed = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  const missingCols = ["title", "meal_period", "item_names"].filter((c) => !parsed.meta.fields?.includes(c))
  if (missingCols.length > 0) fail(`The CSV is missing column(s): ${missingCols.join(", ")}`)
  const rows = parsed.data.filter((r) => r.title?.trim())
  console.log(`Read ${rows.length} plates from ${CSV_PATH}`)

  // 2. Load every Scott menu row (paged; Supabase returns 1000 at a time).
  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", SCOTT_SLUG)
    .single()
  if (locError) fail(`Couldn't find the Scott location: ${locError.message}`)

  const menu: MenuRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, meal_period, served_on, calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, iron_mg, calcium_mg, vit_d_mcg")
      .eq("location_id", location.id)
      .order("id")
      .range(from, from + 999)
    if (error) fail(`Reading menu_items failed: ${error.message}`)
    menu.push(...(data as MenuRow[]))
    if (data.length < 1000) break
  }
  if (menu.length === 0) fail("menu_items has no Scott foods. Run the sheet sync first.")

  const byName = new Map<string, MenuRow[]>()
  for (const m of menu) byName.set(key(m.name), [...(byName.get(key(m.name)) ?? []), m])

  // 3. Check every plate before writing anything.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  const problems: string[] = []
  const plates = rows.map((r, i) => {
    const line = i + 2 // header is line 1
    const title = r.title!.trim()
    const meal = key(r.meal_period ?? "")
    if (!MEALS.includes(meal)) problems.push(`Line ${line} "${title}": meal_period "${r.meal_period ?? ""}" must be breakfast, lunch or dinner`)
    const names = list(r.item_names)
    const servingsList = (r.servings ?? "").split(/[;,]/).map((x) => x.trim()).filter(Boolean).map(Number)
    if (servingsList.length > 0 && (servingsList.length !== names.length || servingsList.some((n) => !(n > 0 && n <= 3)))) {
      problems.push(`Line ${line} "${title}": servings "${r.servings}" needs one number from 0.5 to 3 per food`)
    }
    if (names.length < 2 || names.length > 4) problems.push(`Line ${line} "${title}": has ${names.length} foods, needs 2 to 4`)

    const items = names.map((name) => {
      const rows = byName.get(key(name))
      if (!rows) {
        problems.push(`Line ${line} "${title}": "${name}" is not on the Scott menu (check the spelling)`)
        return null
      }
      // The soonest upcoming row at this meal, else any row for the food.
      const sorted = [...rows].sort((a, b) => a.served_on.localeCompare(b.served_on))
      return (
        sorted.find((m) => m.meal_period === meal && m.served_on >= today) ??
        sorted.find((m) => m.meal_period === meal) ??
        sorted.find((m) => m.served_on >= today) ??
        sorted[0]
      )
    })

    // Days on which every food is served at this meal: Feed me only offers the plate then.
    const days = [...new Set(menu.filter((m) => m.meal_period === meal).map((m) => m.served_on))].filter((d) =>
      names.every((n) => (byName.get(key(n)) ?? []).some((m) => m.served_on === d && m.meal_period === meal))
    )

    return {
      title,
      meal,
      why: r.why?.trim() || null,
      steps: r.steps?.trim()
        ? list(r.steps)
        : (r["station order"] ?? "").split(">").map((x) => x.trim()).filter(Boolean),
      tags: [...new Set([...list(r.tags).map(key), meal])],
      items: items.flatMap((item, j) => (item ? [{ item, servings: servingsList[j] ?? 1 }] : [])),
      days,
    }
  })

  if (problems.length > 0) {
    console.error(`\n✖ Fix these ${problems.length} problem(s) in the sheet, download the CSV again, and rerun. Nothing was imported.\n`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }

  console.log("\nDays each plate can come up in Feed me (all its foods served at that meal):")
  for (const p of plates) {
    const flag = p.days.length === 0 ? "  ⚠ never" : p.days.includes(today) ? "" : "  (not today)"
    console.log(`  ${p.meal.padEnd(9)} ${String(p.days.length).padStart(2)} day(s)  ${p.title}${flag}`)
  }
  const never = plates.filter((p) => p.days.length === 0)
  if (never.length > 0) {
    console.warn(`\n⚠ ${never.length} plate(s) will never show in Feed me: their foods are never all served at that meal on the same day. Swap a food or change meal_period.`)
  }

  if (dryRun) {
    console.log("\nDry run: nothing written.")
    return
  }

  // 4. Insert, skipping titles that already exist.
  const { data: existing, error: exError } = await supabase.from("recipes").select("title").eq("source", "curated")
  if (exError) fail(`Reading recipes failed: ${exError.message}`)
  const existingTitles = new Set(existing.map((r) => key(r.title ?? "")))

  let imported = 0
  let skipped = 0
  for (const p of plates) {
    if (existingTitles.has(key(p.title))) {
      skipped++
      continue
    }
    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({
        title: p.title,
        blurb: p.why,
        source: "curated",
        location_id: location.id,
        steps: p.steps,
        tags: p.tags,
        totals: computeTotals(p.items),
      })
      .select("id")
      .single()
    if (error) fail(`Inserting "${p.title}" failed: ${error.message}`)

    const { error: itemsError } = await supabase
      .from("recipe_items")
      .insert(p.items.map(({ item, servings }) => ({ recipe_id: recipe.id, menu_item_id: item.id, servings })))
    if (itemsError) {
      await supabase.from("recipes").delete().eq("id", recipe.id)
      fail(`Inserting foods for "${p.title}" failed: ${itemsError.message}`)
    }
    existingTitles.add(key(p.title))
    imported++
  }

  console.log(`\n✔ Imported ${imported} plate(s), skipped ${skipped} that already existed.`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
