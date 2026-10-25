"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { MealPeriod } from "@/lib/menu-shared"

// Single series: the brand red (3:1+ on white). Meals: the first three slots of
// the reference categorical palette, in fixed order, validated together on white.
// Aqua is under 3:1 there, so bars carry value labels and a table view exists.
const LIKED_COLOR = "#c92c20"
export const MEAL_COLORS: Record<MealPeriod, string> = { breakfast: "#2a78d6", lunch: "#eb6834", dinner: "#1baf7a" }
const MEAL_LABELS: Record<MealPeriod, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 }
const truncate = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-muted-foreground">
          {r.color && <span className="size-2.5 rounded-sm" style={{ background: r.color }} aria-hidden />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

export type LikedRow = { name: string; likes: number; dislikes: number; like_rate: number | null }

/** Horizontal bars: the 10 most-liked foods by likes. */
export function TopLikedChart({ rows }: { rows: LikedRow[] }) {
  const height = rows.length * 34 + 24
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" domain={[0, "dataMax"]} allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={AXIS_TICK}
          tickFormatter={(v: string) => truncate(v)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const row = active ? (payload?.[0]?.payload as LikedRow | undefined) : undefined
            if (!row) return null
            return (
              <TooltipBox
                title={row.name}
                rows={[
                  { label: "Likes", value: String(row.likes) },
                  { label: "Passes", value: String(row.dislikes) },
                  ...(row.like_rate != null ? [{ label: "Like rate", value: `${Math.round(row.like_rate)}%` }] : []),
                ]}
              />
            )
          }}
        />
        <Bar dataKey="likes" fill={LIKED_COLOR} maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="likes" position="right" fill="var(--foreground)" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Vertical bars: total planned servings for breakfast, lunch and dinner. */
export function MealTotalsChart({ rows }: { rows: { meal: MealPeriod; servings: number }[] }) {
  const data = rows.map((r) => ({ ...r, label: MEAL_LABELS[r.meal], fill: MEAL_COLORS[r.meal] }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const row = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
            if (!row) return null
            return <TooltipBox title={row.label} rows={[{ label: "Planned servings", value: String(row.servings), color: row.fill }]} />
          }}
        />
        <Bar dataKey="servings" maxBarSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.meal} fill={d.fill} />
          ))}
          <LabelList dataKey="servings" position="top" fill="var(--foreground)" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
