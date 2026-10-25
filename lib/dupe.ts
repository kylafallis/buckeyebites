import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { isSauce, type MenuItem } from "@/lib/menu-shared"
import type { DupeIngredient } from "@/lib/dupe-shared"

// Recipe dupe, with no AI: read a recipe's schema.org data, clean each
// ingredient, and match it to Scott menu items by word overlap and synonyms.

const FETCH_TIMEOUT_MS = 10_000
const MAX_PAGE_BYTES = 3_000_000
const MAX_REDIRECTS = 3
export const MAX_INGREDIENTS = 40
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}

export class DupeError extends Error {
  constructor(message: string, public status: number, public needsIngredients = false) {
    super(message)
  }
}

const PASTE_INSTEAD = "Paste the ingredients instead."

// ---------------------------------------------------------------------------
// Fetching a recipe

/** Private, loopback, link-local and other non-public addresses. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number)
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7))
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")
}

/** Rejects anything but public http(s) URLs, so the server can't be pointed at internal hosts. */
async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DupeError("Use a link that starts with http:// or https://.", 400)
  }
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
  if (addresses.length === 0) throw new DupeError("We couldn't find that website. Check the link.", 400)
  if (addresses.some(isPrivateAddress)) throw new DupeError("That link isn't a public website.", 400)
}

async function fetchPage(link: string): Promise<string> {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    throw new DupeError("That doesn't look like a link. Paste the full address, starting with https://.", 400)
  }

  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url)
      const res = await fetch(url, { redirect: "manual", signal, headers: BROWSER_HEADERS })
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url)
        continue
      }
      if (!res.ok) {
        throw new DupeError(`That website wouldn't share the recipe (error ${res.status}). ${PASTE_INSTEAD}`, 502, true)
      }
      const reader = res.body?.getReader()
      if (!reader) return ""
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > MAX_PAGE_BYTES) {
          await reader.cancel()
          throw new DupeError(`That page is too large to read. ${PASTE_INSTEAD}`, 502, true)
        }
        chunks.push(value)
      }
      return new TextDecoder().decode(Buffer.concat(chunks))
    }
    throw new DupeError(`That link redirects too many times. ${PASTE_INSTEAD}`, 502, true)
  } catch (error) {
    if (error instanceof DupeError) throw error
    const timedOut = signal.aborted
    throw new DupeError(
      `${timedOut ? "That website took too long to answer." : "We couldn't open that link."} ${PASTE_INSTEAD}`,
      502,
      true
    )
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()

type FetchedRecipe = {
  name: string | null
  recipeIngredient: string[]
  /** schema.org NutritionInformation values as written on the page, e.g. { calories: "450 kcal" }. */
  nutrition: Record<string, string> | null
}

/** The first schema.org Recipe with ingredients in a page's application/ld+json scripts. */
function findLdRecipe(html: string): FetchedRecipe | null {
  const scripts = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)
  const isRecipe = (node: Record<string, unknown>) =>
    [node["@type"]].flat().some((t) => typeof t === "string" && t.toLowerCase() === "recipe")

  for (const [, body] of scripts) {
    let json: unknown
    try {
      json = JSON.parse(body.trim())
    } catch {
      continue
    }
    // A Recipe can be the root, in a list, or inside @graph or mainEntity.
    const queue: unknown[] = [json]
    while (queue.length > 0) {
      const node = queue.shift()
      if (Array.isArray(node)) {
        queue.push(...node)
        continue
      }
      if (!node || typeof node !== "object") continue
      const obj = node as Record<string, unknown>
      if (isRecipe(obj)) {
        const recipeIngredient = [obj.recipeIngredient ?? obj.ingredients]
          .flat()
          .filter((i): i is string => typeof i === "string")
          .map(decode)
          .filter(Boolean)
        if (recipeIngredient.length > 0) {
          let nutrition: Record<string, string> | null = null
          if (obj.nutrition && typeof obj.nutrition === "object") {
            nutrition = Object.fromEntries(
              Object.entries(obj.nutrition as Record<string, unknown>)
                .filter(([k, v]) => !k.startsWith("@") && (typeof v === "string" || typeof v === "number"))
                .map(([k, v]) => [k, decode(String(v))])
            )
          }
          return { name: typeof obj.name === "string" ? decode(obj.name) : null, recipeIngredient, nutrition }
        }
      }
      if (obj["@graph"]) queue.push(obj["@graph"])
      if (obj.mainEntity) queue.push(obj.mainEntity)
    }
  }
  return null
}

/** Fetches a recipe page and reads its schema.org Recipe. */
export async function fetchRecipe(url: string): Promise<FetchedRecipe> {
  const recipe = findLdRecipe(await fetchPage(url))
  if (!recipe) throw new DupeError(`We couldn't find a recipe on that page. ${PASTE_INSTEAD}`, 422, true)
  return recipe
}

// ---------------------------------------------------------------------------
// Cleaning ingredients

const UNITS = [
  "cups?", "c", "tablespoons?", "tbsps?", "tbs", "teaspoons?", "tsps?", "ounces?", "oz", "fl", "pounds?", "lbs?",
  "grams?", "g", "kg", "kilograms?", "ml", "milliliters?", "l", "liters?", "litres?", "quarts?", "qt", "pints?",
  "gallons?", "cloves?", "cans?", "jars?", "packages?", "pkgs?", "packets?", "bags?", "boxes", "box", "containers?",
  "pinch(?:es)?", "dash(?:es)?", "slices?", "stalks?", "sprigs?", "bunch(?:es)?", "heads?", "handfuls?", "pieces?",
  "inch(?:es)?", "sticks?", "scoops?", "servings?", "bottles?", "envelopes?", "drops?", "leaves", "leaf",
  "wedges?", "stems?", "cubes?", "recipes?",
]
const PREP_WORDS = [
  "diced", "chopped", "minced", "fresh", "freshly", "shredded", "cooked", "uncooked", "boneless", "skinless",
  "sliced", "thinly", "thickly", "finely", "roughly", "coarsely", "grated", "peeled", "seeded", "cored", "trimmed",
  "drained", "rinsed", "divided", "optional", "softened", "melted", "room", "temperature", "packed", "heaping",
  "level", "large", "medium", "small", "extra", "about", "approximately", "plus", "more", "needed", "taste",
  "garnish", "serving", "serve", "for", "to", "of", "and", "or", "a", "an", "the", "your", "favorite", "quality",
  "good", "homemade", "store", "bought", "store-bought", "prepared", "warm", "cold", "hot", "cubed", "halved",
  "quartered", "crumbled", "torn", "julienned", "smashed", "beaten", "whisked", "lightly", "well",
  "low-sodium", "reduced-sodium", "organic", "raw", "whole", "into", "cut", "bite-size", "bite-sized", "pieces",
  "inch", "thick", "thin", "lean", "frozen", "thawed", "canned", "dry", "dried", "zest", "zested", "juiced",
  "floret", "florets", "light",
]
const UNIT_RE = new RegExp(`\\b(?:${UNITS.join("|")})\\b\\.?`, "g")
const PREP = new Set(PREP_WORDS)

function cleanPart(part: string) {
  return part
    .replace(UNIT_RE, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "-" && !PREP.has(w))
    .join(" ")
    .trim()
}

/**
 * "2 cups shredded cheddar cheese (8 oz)" -> "cheddar cheese". Drops quantities,
 * fractions, units, prep words, notes in brackets and anything after a comma.
 * Of alternatives ("800g / 28 oz crushed tomato", "cornflour / corn starch"),
 * keeps the first one that still names a food.
 */
// "jalapeño" -> "jalapeno", so accented letters aren't dropped as symbols.
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

function cleanIngredient(text: string): string {
  let s = plain(text).toLowerCase()
  s = s.replace(/\([^)]*\)/g, " ") // (8 oz), (optional)
  s = s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/g, " ")
  s = s.replace(/\d+(?:\s*[./–-]\s*\d+)*/g, " ") // 1, 1/2, 1.5, 5 - 6
  s = s.split(/[,;]| - | – /)[0] // "chicken breast, diced"
  const parts = s.split(/\/|\s+or\s+/).map(cleanPart)
  return parts.find(Boolean) ?? ""
}

/** Rough singular form so "tomatoes" matches "tomato" and "berries" matches "berry". */
function stem(word: string) {
  if (word.length <= 3) return word
  if (word.endsWith("ies")) return word.slice(0, -3) + "y"
  if (word.endsWith("oes")) return word.slice(0, -2)
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2)
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
  return word
}
const words = (s: string) => plain(s).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).map(stem)

// ---------------------------------------------------------------------------
// Pantry and synonyms

// Assumed to be on hand (or at Scott's condiment area); never matched.
const PANTRY = new Set(
  [
    "salt", "pepper", "salt and pepper", "oil", "olive oil", "vegetable oil", "canola oil", "avocado oil", "sesame oil",
    "coconut oil", "cooking spray", "nonstick cooking spray", "butter", "unsalted butter", "garlic", "garlic powder",
    "onion powder", "chili powder", "cumin", "paprika", "smoked paprika", "oregano", "thyme", "rosemary", "cinnamon",
    "nutmeg", "ginger powder", "cayenne", "cayenne pepper", "red pepper flake", "crushed red pepper", "italian seasoning",
    "taco seasoning", "seasoning", "spice", "spices", "bay", "water", "ice", "sugar", "brown sugar", "white sugar",
    "granulated sugar", "powdered sugar", "flour", "all-purpose flour", "vinegar", "white vinegar", "apple cider vinegar",
    "red wine vinegar", "rice vinegar", "balsamic vinegar", "baking soda", "baking powder", "cornstarch", "vanilla",
    "vanilla extract", "kosher salt", "sea salt", "black pepper", "white pepper", "ground black pepper", "garlic salt",
    "lime juice", "lemon juice", "corn starch", "cornflour", "bi carb", "bicarbonate of soda",
    "cooking oil", "neutral oil", "stock", "broth", "bouillon",
  ].map((p) => words(p).join(" "))
)
const PANTRY_QUALIFIERS = new Set(
  ["kosher", "sea", "black", "white", "ground", "extra", "virgin", "granulated", "fine", "coarse", "flaky", "cooking",
   "table", "neutral", "chicken", "beef", "vegetable", "low", "sodium"].map(stem)
)

function isPantry(cleaned: string) {
  const w = words(cleaned)
  if (w.length === 0) return false
  const core = w.filter((x) => !PANTRY_QUALIFIERS.has(x))
  if (PANTRY.has(w.join(" ")) || PANTRY.has(core.join(" "))) return true
  // "sea salt and black pepper": only staples and their qualifiers.
  return core.length > 0 && core.every((x) => PANTRY.has(x))
}

// Ingredient phrase -> menu name phrases it can stand in for. A synonym match
// is a "swapped" match. The phrase must end with the ingredient's main word.
const SYNONYMS: Record<string, string[]> = {
  chicken: ["chicken breast", "chicken"],
  "rotisserie chicken": ["chicken breast"],
  "chicken thigh": ["chicken breast"],
  turkey: ["chicken breast"],
  "ground beef": ["taco beef", "beef burger", "bolognese"],
  beef: ["taco beef", "beef burger", "bolognese"],
  steak: ["beef burger", "bolognese"],
  "ground turkey": ["beef burger", "bolognese"],
  "beef mince": ["beef burger", "bolognese"],
  mince: ["beef burger", "bolognese"],
  spaghetti: ["penne pasta"],
  linguine: ["penne pasta"],
  fettuccine: ["penne pasta"],
  rigatoni: ["penne pasta"],
  noodle: ["penne pasta"],
  "egg noodle": ["penne pasta"],
  "lo mein noodle": ["penne pasta"],
  pasta: ["penne pasta"],
  macaroni: ["penne pasta"],
  "tomato sauce": ["marinara"],
  "crushed tomato": ["marinara"],
  "diced tomato": ["marinara"],
  "pasta sauce": ["marinara"],
  "tomato paste": ["marinara"],
  cheddar: ["cheese"],
  "cheddar cheese": ["cheese"],
  mozzarella: ["cheese"],
  "mozzarella cheese": ["cheese"],
  parmesan: ["cheese"],
  "parmesan cheese": ["cheese"],
  "monterey jack": ["cheese"],
  "mexican cheese": ["cheese"],
  "cheese blend": ["cheese"],
  feta: ["cheese"],
  tortilla: ["flour tortilla", "whole wheat tortilla"],
  "corn tortilla": ["flour tortilla", "taco shell"],
  "taco shell": ["taco shell"],
  "hard taco shell": ["taco shell"],
  "tortilla chip": ["tortilla chip"],
  // Burger and taco toppings.
  pickle: ["pickle chip"],
  "dill pickle": ["pickle chip"],
  jalapeno: ["jalapeno"],
  onion: ["red onion", "yellow onion", "onion"],
  "red onion": ["red onion", "onion"],
  "white onion": ["yellow onion", "red onion", "onion"],
  "yellow onion": ["yellow onion", "onion"],
  tomato: ["tomato"],
  "roma tomato": ["tomato"],
  "bbq sauce": ["barbecue sauce"],
  "barbecue sauce": ["barbecue sauce"],
  ketchup: ["ketchup"],
  mustard: ["mustard"],
  "dijon mustard": ["mustard"],
  "hamburger bun": ["hamburger bun", "bun"],
  "burger bun": ["hamburger bun", "bun"],
  bun: ["hamburger bun", "bun"],
  "hot sauce": ["hot sauce"],
  queso: ["queso"],
  "greek yogurt": ["yogurt"],
  yogurt: ["yogurt"],
  berry: ["frozen berry", "berry"],
  blueberry: ["frozen berry"],
  strawberry: ["frozen berry"],
  raspberry: ["frozen berry"],
  tofu: ["plant based chicken tender"],
  chickpea: ["plant based chicken tender"],
  "garbanzo bean": ["plant based chicken tender"],
  // Extras for common recipes.
  "brown rice": ["rice"],
  "white rice": ["rice"],
  "jasmine rice": ["rice"],
  "basmati rice": ["rice"],
  "cilantro lime rice": ["rice"],
  "pinto bean": ["bean"],
  "kidney bean": ["bean"],
  "romaine lettuce": ["lettuce", "salad"],
  lettuce: ["lettuce", "salad"],
  "mixed green": ["salad", "lettuce"],
  spinach: ["spinach", "salad"],
  "bell pepper": ["pepper"],
  "red bell pepper": ["pepper"],
  "green bell pepper": ["pepper"],
  "pico de gallo": ["salsa"],
  salsa: ["salsa", "pico de gallo"],
  "ranch dressing": ["ranch"],
  ranch: ["ranch"],
  dressing: ["dressing", "vinaigrette", "ranch"],
  mayo: ["mayonnaise", "mayo"],
  mayonnaise: ["mayonnaise", "mayo"],
  avocado: ["guacamole"],
  "sour cream": ["sour cream"],
  "broccoli floret": ["broccoli"],
  "snap pea": ["pea"],
  "snow pea": ["pea"],
  "soy sauce": ["soy sauce", "teriyaki"],
  "teriyaki sauce": ["teriyaki"],
  "green onion": ["onion"],
  scallion: ["onion"],
  egg: ["egg"],
}
const SYNONYM_KEYS = Object.keys(SYNONYMS)
  .map((k) => ({ key: words(k), targets: SYNONYMS[k].map(words) }))
  .sort((a, b) => b.key.length - a.key.length)

// Cheeses are interchangeable: any cheese ingredient can use any plain cheese
// item (shredded, sliced, crumbled), but not a cheese dish like Grilled Cheese.
const CHEESE_WORDS =
  /\b(?:cheese|cheddar|mozzarella|parmesan|parmigiano|pecorino|romano|feta|swiss|provolone|monterey|jack|colby|gouda|brie|queso|cotija|asiago|gruyere|havarti|muenster|chihuahua|manchego|fontina|oaxaca)\b/
const NOT_PLAIN_CHEESE =
  /\b(?:grilled|macaroni|mac|pizza|tortellini|blintz|cream|cheesy|bites|sauce|frosting|cake|cupcake|cottage|ricotta|elevated|empanada|frittata|soup|lasagna|parmesan roasted|queso|blanco|dip)\b/
const isCheeseIngredient = (cleaned: string) => {
  const s = cleaned.toLowerCase()
  return CHEESE_WORDS.test(s) && !/\b(?:cream cheese|cottage|ricotta|mascarpone)\b/.test(s)
}
const isPlainCheese = (item: MenuItem) => {
  const s = plain(item.name).toLowerCase()
  return CHEESE_WORDS.test(s) && !NOT_PLAIN_CHEESE.test(s)
}

// Two-word foods that must match as a whole, so "cream" can't match "Ice Cream"
// and "butter" can't match "Peanut Butter".
const COMPOUNDS = [
  "ice cream", "sour cream", "cream cheese", "peanut butter", "almond butter", "sunflower butter", "soy sauce",
  "hot sauce", "bell pepper", "green onion", "sweet potato", "hot dog", "corn dog", "cream puff", "fish stick",
  "bean sprout", "brussels sprout", "oyster sauce", "fish sauce", "worcestershire sauce", "hoisin sauce",
].map(words)
const hasPhrase = (haystack: string[], phrase: string[]) => phrase.every((w) => haystack.includes(w))

// ---------------------------------------------------------------------------
// Matching

type Candidate = { index: number; item: MenuItem; score: number; status: "matched" | "swapped" }

// Main words too vague to swap on alone: "oyster sauce" shouldn't become "Pub Sauce".
const GENERIC_HEADS = new Set(
  ["sauce", "juice", "soup", "seasoning", "mix", "paste", "wine", "stock", "broth", "spread", "dressing", "powder",
   "oil", "vinegar", "extract", "syrup", "sprout", "leaf", "green"].map(stem)
)

/**
 * How well a menu item fits a cleaned ingredient, or null if it doesn't.
 * Tiers: every word matches (matched, 2+) > a known synonym for the whole
 * ingredient (swapped, ~1) > same main word (swapped, ~0.9) > a synonym for
 * part of it (swapped, ~0.8). Within a tier, items with fewer extra words win.
 */
function scoreItem(ingWords: string[], item: MenuItem): Omit<Candidate, "index" | "item"> | null {
  const itemWords = words(item.name)
  const itemCore = itemWords.filter((w) => !PREP.has(w))
  // A compound food on either side has to appear whole on the other.
  for (const c of COMPOUNDS) {
    if (hasPhrase(itemWords, c) && !hasPhrase(ingWords, c)) return null
    if (hasPhrase(ingWords, c) && !hasPhrase(itemWords, c)) return null
  }
  const head = ingWords.at(-1)!
  // Words the ingredient "covers", including its synonyms' menu words.
  const synonyms = SYNONYM_KEYS.filter(({ key }) => key.at(-1) === head && hasPhrase(ingWords, key))
  const known = new Set([...ingWords, ...synonyms.flatMap((s) => s.targets.flat())])
  const itemFit = itemCore.length === 0 ? 0 : itemCore.filter((w) => known.has(w)).length / itemCore.length

  // Matched: every word of the ingredient is in the item's name.
  if (ingWords.every((w) => itemWords.includes(w))) return { score: 2 + itemFit, status: "matched" }

  // Any plain cheese for a cheese ("mozzarella" -> Shredded Cheddar Cheese, Crumbled Feta).
  if (isCheeseIngredient(ingWords.join(" ")) && isPlainCheese(item)) {
    const ingCoverage = ingWords.filter((w) => itemWords.includes(w)).length / ingWords.length
    return { score: 0.9 + ingCoverage / 20 + itemFit / 40, status: "swapped" }
  }

  // Synonym: a known stand-in. Covering the whole ingredient beats a shared main word.
  for (const { key, targets } of synonyms) {
    if (!targets.some((t) => hasPhrase(itemWords, t))) continue
    const whole = key.length === ingWords.length
    return { score: (whole ? 0.95 : 0.8) + itemFit / 20, status: "swapped" }
  }

  // Same main word, different kind ("cheddar cheese" -> "American Cheese").
  if (itemWords.includes(head) && !GENERIC_HEADS.has(head)) {
    const ingCoverage = ingWords.filter((w) => itemWords.includes(w)).length / ingWords.length
    return { score: 0.85 + ingCoverage / 20 + itemFit / 40, status: "swapped" }
  }
  return null
}

/**
 * Matches recipe ingredients to safe menu items. Pantry staples are skipped.
 * Best pairs are assigned first and each menu item is used once, unless an
 * ingredient has nothing else that fits.
 */
/** True when an ingredient line is itself a sauce or condiment ("2 tbsp soy sauce", "sour cream"). */
export function isSauceIngredient(ingredient: string) {
  return isSauce({ name: cleanIngredient(ingredient), food_group: null })
}

export function matchIngredients(ingredients: string[], safeItems: MenuItem[], recipeName?: string | null): DupeIngredient[] {
  const cleaned = ingredients.map(cleanIngredient)
  // The recipe's name and other ingredients break ties between swaps, so
  // "ground beef" picks the burger patty in a burger and taco beef in tacos.
  const HINTS: Record<string, string> = {
    bun: "burger", slider: "burger", tortilla: "taco", shell: "taco", nacho: "taco",
    mexican: "chihuahua", jack: "chihuahua", monterey: "chihuahua", quesadilla: "chihuahua",
  }
  const context = new Set(
    [recipeName ?? "", ...cleaned]
      .flatMap((t) => words(t))
      .flatMap((w) => [w, ...(w.endsWith("burger") ? ["burger"] : []), ...(HINTS[w] ? [HINTS[w]] : [])])
  )
  const sauceIngredient = cleaned.map((text) => isSauce({ name: text, food_group: null }))
  const results: DupeIngredient[] = ingredients.map((ingredient, i) => ({
    ingredient,
    status: isPantry(cleaned[i]) ? "pantry" : "missing",
    item: null,
    reason: "",
  }))

  const candidates: Candidate[] = []
  cleaned.forEach((text, index) => {
    if (results[index].status === "pantry") return
    const ingWords = words(text)
    if (ingWords.length === 0) return
    for (const item of safeItems) {
      // A sauce item can only stand in for a sauce ingredient.
      if (isSauce(item) && !sauceIngredient[index]) continue
      const s = scoreItem(ingWords, item)
      if (!s) continue
      // Shared prep words from the line ("shredded lettuce" -> Shredded Iceberg Lettuce).
      const raw = new Set(words(ingredients[index]))
      s.score += Math.min(words(item.name).filter((w) => raw.has(w) && !ingWords.includes(w)).length, 2) * 0.02
      if (s.status === "swapped") {
        const shared = words(item.name).filter((w) => context.has(w) && !ingWords.includes(w)).length
        s.score += Math.min(shared, 2) * 0.03
      }
      candidates.push({ index, item, ...s })
    }
  })
  candidates.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)

  const assign = (c: Candidate) => {
    results[c.index] = {
      ingredient: ingredients[c.index],
      status: c.status,
      item: { id: c.item.id, name: c.item.name, station: c.item.station?.name ?? null },
      reason: c.status === "swapped" ? `Scott has ${c.item.name} instead of ${cleaned[c.index]}` : "",
    }
  }
  const used = new Set<number>()
  const done = new Set<number>()
  for (const c of candidates) {
    if (done.has(c.index) || used.has(c.item.id)) continue
    assign(c)
    done.add(c.index)
    used.add(c.item.id)
  }
  // Nothing unused fits: reuse the best item rather than call it missing.
  for (const c of candidates) {
    if (done.has(c.index)) continue
    assign(c)
    done.add(c.index)
  }
  return results
}

/** 3 to 5 steps: one per station (in menu order), then season and combine. */
export function buildSteps(matches: DupeIngredient[]): string[] {
  const stations = new Map<string, string[]>()
  for (const m of matches) {
    if (!m.item) continue
    const station = m.item.station ?? "Scott"
    const names = stations.get(station) ?? []
    if (!names.includes(m.item.name)) names.push(m.item.name)
    stations.set(station, names)
  }
  if (stations.size === 0) return []

  const list = (names: string[]) =>
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
  const visits = [...stations].map(([station, names]) => `${station}: grab ${list(names)}`)
  // At most 3 station steps; fold the rest into the last one.
  const stationSteps =
    visits.length <= 3 ? visits : [...visits.slice(0, 2), `Then ${visits.slice(2).map((v) => v.replace(": grab", " for")).join("; ")}`]

  const steps = [...stationSteps]
  if (matches.some((m) => m.status === "pantry")) {
    steps.push("Season with salt, pepper and spices from the condiment area")
  }
  if (steps.length < 2) steps.unshift("Grab a plate and utensils")
  steps.push("Combine at your table")
  return steps.slice(0, 5)
}
