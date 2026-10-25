import { isSauce } from "@/lib/menu-shared"

// A plate drawn from above: each food is a slice sized by how much of the
// plate it is (calories x servings), colored like the food itself, with sauces
// in a small dish in the middle. Server-safe: no state, plain markup.

export type DrawnFood = { name: string; food_group: string | null; calories: number | null; servings: number }

// First match wins, so specific names come before general ones.
const FOOD_COLORS: [RegExp, string][] = [
  [/sweet potato/i, "#E07B39"],
  [/green (?:bell )?pepper|green bean|green onion|jalapen/i, "#6E9E4E"],
  [/salmon|fish|pollock|shrimp|tuna/i, "#E8A07E"],
  [/black bean/i, "#3E2C2A"],
  [/red bean|kidney/i, "#7A3B2E"],
  [/lentil/i, "#A0784F"],
  [/chickpea|hummus|falafel/i, "#C9A46A"],
  [/tofu/i, "#EFE6D2"],
  [/egg/i, "#F3D35B"],
  [/beef|burger|steak|bolognese|meatball|chorizo|sausage|pork|bacon|ham\b|carnitas|birria|bulgogi|pepperoni|hot dog|churrasc/i, "#8A4B2E"],
  [/chicken|turkey|tender|wing|nugget|chick'n/i, "#D29B5C"],
  [/rice|quinoa|grits|oat|couscous|risotto/i, "#EADFC2"],
  [/noodle|pasta|penne|tortellini|lo mein|mac|ramen|orzo|lasagna/i, "#E9CF8E"],
  [/potato|fries|tots|hash brown/i, "#E3B550"],
  [/corn/i, "#EFC23E"],
  [/carrot|squash|pumpkin/i, "#E58A3A"],
  [/tomato|marinara|salsa|pico|red pepper|beet/i, "#D4472E"],
  [/broccoli|spinach|kale|lettuce|greens|salad|cabbage|pea|brussels|cucumber|zucchini|cilantro|asparagus|slaw|sprout/i, "#6E9E4E"],
  [/mushroom|onion|chestnut/i, "#B39B84"],
  [/cheese|queso|cheddar|feta|parmesan|mozzarella/i, "#F2B84B"],
  [/yogurt|cottage|milk|cream/i, "#F4F1E8"],
  [/blueberr|berries|berry|grape|blackberr/i, "#5B4C8A"],
  [/apple|watermelon|strawberr|raspberr|cherry/i, "#C9374B"],
  [/banana|pineapple|lemon/i, "#F2D45C"],
  [/orange|clementine|cantaloupe|mango|peach/i, "#F0973A"],
  [/honeydew|lime|kiwi|pesto|avocado|guac/i, "#A9C77C"],
  [/bread|bun|bagel|tortilla|toast|waffle|pancake|biscuit|naan|roll|crouton|tabouli|empanada|pizza|cookie|brownie|cake|muffin|cereal|granola|flake/i, "#D9B27C"],
]
const GROUP_COLORS: Record<string, string> = {
  protein: "#B07A4E",
  veg: "#6E9E4E",
  fruit: "#E07A5F",
  grain: "#E3CFA0",
  dairy: "#F4F1E8",
  treat: "#B9856B",
  condiment: "#C0563A",
}

export function foodColor(food: Pick<DrawnFood, "name" | "food_group">) {
  return FOOD_COLORS.find(([re]) => re.test(food.name))?.[1] ?? GROUP_COLORS[food.food_group ?? ""] ?? "#C8BFAE"
}

// Light colors get an outline so the legend dot shows on white.
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 200
}

export function splitPlate(foods: DrawnFood[]) {
  return {
    mains: foods.filter((f) => !isSauce(f)),
    sauces: foods.filter((f) => isSauce(f)),
  }
}

/** conic-gradient stops: one slice per color, sized in percent, with thin white gaps between. */
function gradientStops(colors: string[], sizes: number[]) {
  const gap = colors.length > 1 ? 0.8 : 0
  const stops: string[] = []
  let at = 0
  colors.forEach((color, i) => {
    const end = at + sizes[i]
    stops.push(`${color} ${at}% ${end - gap}%`)
    if (gap) stops.push(`#ffffff ${end - gap}% ${end}%`)
    at = end
  })
  return stops
}

/** The drawn plate. `size` is the outer diameter in px. */
export function PlateDrawing({ foods, size = 260, className = "" }: { foods: DrawnFood[]; size?: number; className?: string }) {
  const { mains, sauces } = splitPlate(foods)
  const slices = mains.length > 0 ? mains : sauces
  // Bigger portions get bigger slices, but every food stays visible (8% minimum).
  const weights = slices.map((f) => Math.max((f.calories ?? 60) * f.servings, 40))
  const total = weights.reduce((a, b) => a + b, 0) || 1
  const shares = weights.map((w) => Math.max(w / total, 0.08))
  const scale = shares.reduce((a, b) => a + b, 0)
  const stops = gradientStops(slices.map(foodColor), shares.map((x) => (x / scale) * 100))
  const center = mains.length > 0 ? sauces[0] : undefined
  const label = `Drawing of the plate: ${mains.map((f) => f.name).join(", ")}${
    center ? `, with ${sauces.map((s) => s.name).join(" and ")} in the middle` : ""
  }`

  const rim = Math.round(size * 0.045)
  const inner = size - rim * 2 - Math.round(size * 0.12)
  return (
    <div
      role="img"
      aria-label={label}
      className={`grid shrink-0 place-items-center rounded-full bg-white shadow-[0_10px_30px_rgba(31,42,35,0.10)] ${className}`}
      style={{ width: size, height: size, border: `${rim}px solid #E9ECE4` }}
    >
      <div
        className="grid place-items-center rounded-full"
        style={{ width: inner, height: inner, background: `conic-gradient(${stops.join(", ")})` }}
      >
        {center && (
          <div
            className="rounded-full border-4 border-white"
            style={{ width: inner * 0.27, height: inner * 0.27, background: foodColor(center) }}
          />
        )}
      </div>
    </div>
  )
}

/** The color key under a drawn plate: one dot and name per food. */
export function PlateLegend({ foods, className = "" }: { foods: DrawnFood[]; className?: string }) {
  const { mains, sauces } = splitPlate(foods)
  return (
    <ul className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm ${className}`}>
      {[...mains, ...sauces].map((f) => {
        const color = foodColor(f)
        return (
          <li key={f.name} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ background: color, boxShadow: isLight(color) ? "inset 0 0 0 1px #CBD0C6" : undefined }}
            />
            <span className="truncate">
              {f.name}
              {f.servings !== 1 && <span className="text-muted-foreground"> ×{f.servings}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
