import type { Metadata } from "next"
import Link from "next/link"
import { HandPlatter, ShieldCheck, Sprout, type LucideIcon } from "lucide-react"
import { LANDING_STATS } from "@/lib/landing-stats"
import { Logo } from "@/components/logo"
import { buttonVariants } from "@/components/ui/button"

// Signed-in users never see this page: proxy.ts redirects them to /dashboard.

export const metadata: Metadata = {
  title: "BuckeyeBites · Your plate, planned.",
  description:
    "One tap turns today's Traditions at Scott menu into a full plate built for your diet, allergies and goals.",
}

const FEATURES: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: HandPlatter,
    title: "Feed me",
    body: "Swipe through plates that fit you, then follow the route through Scott.",
  },
  {
    Icon: ShieldCheck,
    title: "Allergy-safe by design",
    body: "Foods with your allergens never show up, anywhere in the app.",
  },
  {
    Icon: Sprout,
    title: "Nutrients, not numbers",
    body: "Balanced by default, with iron, vitamin D or macro tracking if you want it.",
  },
]

const STEPS = ["Tell us what you eat", "Swipe foods you love", "Tap Feed me and follow the route"]

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 pt-8 pb-14 md:px-8 md:pt-14 md:pb-20">
          <Logo priority className="-ml-2 h-16 md:h-24" />
          <h1 className="mt-6 text-[2.5rem] leading-[1.05] font-extrabold tracking-tight md:text-6xl">
            Your plate, <span className="text-primary">planned.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/80 md:text-lg">
            One tap turns today&apos;s Traditions at Scott menu into a full plate built for your diet, allergies and
            goals.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ className: "h-12 rounded-xl px-6 text-base font-bold sm:w-48" })}>
              Create account
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", className: "h-12 rounded-xl border-2 border-foreground px-6 text-base font-bold sm:w-48" })}
            >
              Log in
            </Link>
          </div>
        </section>

        <section aria-label="Features" className="mx-auto w-full max-w-5xl px-4 md:px-8">
          <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
            {FEATURES.map(({ Icon, title, body }) => (
              <li key={title} className="rounded-2xl bg-card p-5">
                <Icon className="size-6 text-primary" aria-hidden strokeWidth={1.75} />
                <h2 className="mt-3 text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground/75">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 bg-buckeye text-white md:mt-20">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8 md:py-12">
            <h2 className="text-lg font-extrabold">How it works</h2>
            <ol className="mt-5 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-nut font-heading text-base font-extrabold text-buckeye">
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
              <li key={label} className="rounded-2xl bg-card px-3 py-4 md:px-5 md:py-6">
                <span className="block font-heading text-3xl font-extrabold text-primary tabular-nums md:text-5xl">{value}</span>
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
