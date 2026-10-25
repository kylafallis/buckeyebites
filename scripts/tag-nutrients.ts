// Fills menu_items.nutrient_tags from keywords in each food's name.
// Tags are ESTIMATES based on the name only, not real nutrition data.
//
//   npx tsx scripts/tag-nutrients.ts             update the database
//   npx tsx scripts/tag-nutrients.ts --dry-run   show results, change nothing
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or service role key in .env.local");
  process.exit(1);
}
const supabase = createClient(url, key);
const dryRun = process.argv.includes("--dry-run");

// Keywords that match in any food.
// "dairy" keywords are ignored when the name says it is plant-based (oat milk, etc.)
const RULES = [
  {
    tag: "high_iron",
    words: [
      "beef", "burger", "bolognese", "bean", "chickpea", "hummus", "falafel",
      "lentil", "spinach", "tofu", "pumpkin seed", "chia", "oatmeal", "cereal",
    ],
    dairy: [] as string[],
  },
  {
    tag: "vit_d",
    words: ["egg", "fish", "salmon", "tuna"],
    dairy: ["milk", "yogurt"],
  },
  {
    tag: "calcium",
    words: ["broccoli", "tofu", "chia"],
    dairy: ["milk", "yogurt", "cheese"],
  },
];

const PLANT_BASED = /\b(oat|almond|soy|coconut|rice|cashew|plant[- ]based|vegan)\b/i;

function hasWord(name: string, word: string): boolean {
  return new RegExp(`\\b${word}s?\\b`, "i").test(name);
}

function tagsFor(name: string): string[] {
  const tags: string[] = [];
  for (const rule of RULES) {
    const plain = rule.words.some((w) => hasWord(name, w));
    const dairy =
      !PLANT_BASED.test(name) && rule.dairy.some((w) => hasWord(name, w));
    if (plain || dairy) tags.push(rule.tag);
  }
  return tags.sort();
}

async function main() {
  // Read every row (the database returns 1000 at a time)
  const rows: { id: number; name: string; nutrient_tags: string[] | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id,name,nutrient_tags")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Read ${rows.length} rows.`);

  // Group the rows that need changing by their new tag list
  const groups = new Map<string, number[]>();
  const foodsByTag = new Map<string, Set<string>>();
  for (const row of rows) {
    const tags = tagsFor(row.name);
    for (const t of tags) {
      if (!foodsByTag.has(t)) foodsByTag.set(t, new Set());
      foodsByTag.get(t)!.add(row.name);
    }
    const current = [...(row.nutrient_tags ?? [])].sort().join(",");
    if (current === tags.join(",")) continue; // already correct
    const k = tags.join(",");
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row.id);
  }

  // Show what was found so a person can review it
  for (const [tag, names] of foodsByTag) {
    console.log(`\n${tag}: ${names.size} foods`);
    console.log([...names].sort().join(", "));
  }

  const toChange = [...groups.values()].reduce((n, ids) => n + ids.length, 0);
  console.log(`\n${toChange} rows need updating.`);
  if (dryRun) {
    console.log("Dry run: nothing was written.");
    return;
  }

  for (const [k, ids] of groups) {
    const tags = k === "" ? [] : k.split(",");
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase
        .from("menu_items")
        .update({ nutrient_tags: tags })
        .in("id", chunk);
      if (error) throw error;
    }
  }
  console.log("Done. nutrient_tags updated.");
}

main().catch((err) => {
  console.error("tag-nutrients failed:", err.message ?? err);
  process.exit(1);
});