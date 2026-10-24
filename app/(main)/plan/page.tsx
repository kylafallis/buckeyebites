import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Plan · BuckeyeBites",
}

export default function PlanPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-xl font-semibold">Plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Plan your meals for the week. Coming soon.</p>
    </main>
  )
}
