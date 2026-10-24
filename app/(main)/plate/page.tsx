import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Plate · BuckeyeBites",
}

export default function PlatePage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-xl font-semibold">Plate</h1>
      <p className="mt-1 text-sm text-muted-foreground">Build a plate from today&apos;s menu. Coming soon.</p>
    </main>
  )
}
