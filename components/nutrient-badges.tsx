import { NUTRIENT_TAGS } from "@/lib/menu-shared"
import { Badge } from "@/components/ui/badge"

/** "Iron", "Vitamin D" or "Calcium" badges for an item's nutrient_tags. Renders nothing if none. */
export function NutrientBadges({ tags, className }: { tags: string[]; className?: string }) {
  const found = NUTRIENT_TAGS.filter((n) => tags.includes(n.tag))
  if (found.length === 0) return null
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {found.map((n) => (
        <Badge key={n.tag} variant="outline" className="h-4 px-1.5 text-[0.625rem]">
          {n.label}
        </Badge>
      ))}
      <span className="text-[0.625rem] text-muted-foreground">Good source (estimated)</span>
    </span>
  )
}
