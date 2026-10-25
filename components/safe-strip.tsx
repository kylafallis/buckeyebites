import { ShieldCheckIcon } from "@phosphor-icons/react/ssr"

/**
 * "Safe for you": says what the allergen and diet filter is doing, instead of
 * showing unsafe food with a warning. Pass labels, e.g. ["Milk", "Egg"].
 */
export function SafeStrip({ allergens, diets, className = "" }: { allergens: string[]; diets: string[]; className?: string }) {
  const rules = [...allergens.map((a) => `no ${a.toLowerCase()}`), ...diets.map((d) => d.toLowerCase())]
  return (
    <p className={`flex items-start gap-2 rounded-xl bg-safe px-3 py-2.5 text-sm leading-snug ${className}`}>
      <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-sage" weight="fill" aria-hidden />
      <span>
        {rules.length > 0 ? (
          <>
            <strong>Safe for you:</strong> {rules.join(", ")}. Everything shown here fits.
          </>
        ) : (
          <>
            <strong>No allergies or diets set.</strong> Add them on the Me tab and we&apos;ll filter for you.
          </>
        )}
      </span>
    </p>
  )
}
