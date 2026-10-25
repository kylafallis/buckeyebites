/**
 * Shared page wrapper for the signed-in app: full width with 16px side padding
 * on phones, centered at max-w-5xl on desktop. `narrow` (max-w-2xl) keeps
 * reading pages like a plate or a dupe from getting too wide.
 */
export function PageContainer({
  narrow = false,
  className = "",
  children,
}: {
  narrow?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={`mx-auto w-full px-4 py-6 ${narrow ? "max-w-2xl" : "max-w-5xl"} ${className}`}>{children}</main>
  )
}
