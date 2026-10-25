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

// SVG geometry, in a 200 x 200 box centered on (100, 100).
const C = 100
const point = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`

/** One ring slice from angle a0 to a1 (radians), between radius r and R. */
function slicePath(r: number, R: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${point(R, a0)} A ${R} ${R} 0 ${large} 1 ${point(R, a1)} L ${point(r, a1)} A ${r} ${r} 0 ${large} 0 ${point(r, a0)} Z`
}

/**
 * The drawn plate: every food gets an equal slice of a ring, in the food's own
 * color, with even white gaps between slices. Sauces sit in a small dish in
 * the middle. `size` is the diameter in px.
 */
export function PlateDrawing({ foods, size = 260, className = "" }: { foods: DrawnFood[]; size?: number; className?: string }) {
  const { mains, sauces } = splitPlate(foods)
  const slices = mains.length > 0 ? mains : sauces
  const center = mains.length > 0 ? sauces[0] : undefined
  const label = `Drawing of the plate: ${mains.map((f) => f.name).join(", ")}${
    center ? `, with ${sauces.map((x) => x.name).join(" and ")} in the middle` : ""
  }`

  const R = 80 // outer edge of the food
  const r = center ? 34 : 24 // inner edge: room for the sauce dish, or a small clean center
  const step = (2 * Math.PI) / Math.max(slices.length, 1)
  const start = -Math.PI / 2 // first slice starts at 12 o'clock

  return (
    <div
      role="img"
      aria-label={label}
      className={`shrink-0 rounded-full shadow-[0_10px_30px_rgba(31,42,35,0.10)] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden>
        <circle cx={C} cy={C} r={99} fill="#E9ECE4" />
        <circle cx={C} cy={C} r={91} fill="#FFFFFF" />
        {slices.length === 1 ? (
          <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={foodColor(slices[0])} strokeWidth={R - r} />
        ) : (
          slices.map((f, i) => (
            <path
              key={`${f.name}-${i}`}
              d={slicePath(r, R, start + i * step, start + (i + 1) * step)}
              fill={foodColor(f)}
              stroke="#FFFFFF"
              strokeWidth={3.5}
              strokeLinejoin="round"
            />
          ))
        )}
        {center && <circle cx={C} cy={C} r={25} fill={foodColor(center)} stroke="#FFFFFF" strokeWidth={4} />}
      </svg>
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
