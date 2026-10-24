import type { Metadata } from "next"
import Link from "next/link"
import { HandPlatter, ShieldCheck, Sprout, type LucideIcon } from "lucide-react"
import { LANDING_STATS } from "@/lib/landing-stats"
import { buttonVariants } from "@/components/ui/button"

// Signed-in users never see this page: proxy.ts redirects them to /dashboard.

export const metadata: Metadata = {
  title: "BuckeyeBite · Your plate, planned.",
  description:
    "One tap turns today's Traditions at Scott menu into a full plate built for your diet, allergies and goals.",
}

const FEATURES: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: HandPlatter,
    title: "Feed me",
    body: "A full plate from real Scott stations in one tap.",
  },
  {
    Icon: ShieldCheck,
    title: "Allergy-safe by design",
    body: "Allergens are removed before the AI ever sees the menu.",
  },
  {
    Icon: Sprout,
    title: "Nutrients, not numbers",
    body: "Balanced by default, with iron, vitamin D or macro tracking if you want it.",
  },
]

const STEPS = ["Tell us what you eat", "Swipe foods you love", "Tap Feed me"]

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pt-5 md:px-8">
        <span className="flex size-8 items-center justify-center bg-primary text-base font-bold text-primary-foreground">
          B
        </span>
        <span className="text-lg font-bold tracking-tight">
          Buckeye<span className="text-primary">Bite</span>
        </span>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 pt-12 pb-14 md:px-8 md:pt-20 md:pb-20">
          <h1 className="text-[2.5rem] leading-[1.05] font-bold tracking-tight md:text-6xl">
            Your plate, <span className="text-primary">planned.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/80 md:text-lg">
            One tap turns today&apos;s Traditions at Scott menu into a full plate built for your diet, allergies and
            goals.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ className: "h-12 px-6 text-sm sm:w-48" })}>
              Create account
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", className: "h-12 px-6 text-sm sm:w-48" })}
            >
              Log in
            </Link>
          </div>
        </section>

        <section aria-label="Features" className="mx-auto w-full max-w-5xl px-4 md:px-8">
          <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
            {FEATURES.map(({ Icon, title, body }) => (
              <li key={title} className="border bg-card p-5">
                <Icon className="size-6 text-primary" aria-hidden strokeWidth={1.75} />
                <h2 className="mt-3 text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground/75">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 bg-brand-brown text-[#FAF7F2] md:mt-20">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8 md:py-12">
            <h2 className="text-xs font-semibold tracking-widest uppercase opacity-80">How it works</h2>
            <ol className="mt-5 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center bg-[#FAF7F2] text-sm font-bold text-brand-brown">
                    {i + 1}
                  </span>
                  <span className="text-base font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-14 md:px-8 md:py-20">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Built for Scott</h2>
          <ul className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
            {LANDING_STATS.map(({ value, label }) => (
              <li key={label} className="border-t-4 border-brand-green bg-card px-3 py-4 md:px-5 md:py-6">
                <span className="block text-3xl font-bold text-brand-green tabular-nums md:text-5xl">{value}</span>
                <span className="mt-1 block text-xs text-foreground/75 md:text-sm">{label}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm md:px-8">
          <p className="font-medium">Built at HackOHI/O 2026 by the Dominatrices</p>
          <p className="mt-2 text-xs text-foreground/65">
            Menu data from Traditions at Scott. Always confirm allergens with dining staff.
          </p>
        </div>
      </footer>
    </div>
  )
}
