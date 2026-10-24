/** A circular progress ring. `max` of null shows an empty track (no goal set). */
export function ProgressRing({
  value,
  max,
  label,
  detail,
  size = 88,
}: {
  value: number
  max: number | null
  label: string
  detail: string
  size?: number
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const fraction = max ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className="stroke-primary transition-[stroke-dashoffset]"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
          {detail}
        </span>
      </div>
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}
