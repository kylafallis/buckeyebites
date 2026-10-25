import type { Metadata } from "next"
import Link from "next/link"
import {
  CalendarCheck,
  ChartColumn,
  HandPlatter,
  Link2,
  Route,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { LANDING_STATS } from "@/lib/landing-stats"
import { Logo } from "@/components/logo"
import { buttonVariants } from "@/components/ui/button"

// Signed-in users never see this page: proxy.ts redirects them to /dashboard.

export const metadata: Metadata = {
  title: "BuckeyeBites · Your plate, planned.",
  description:
    "BuckeyeBites picks a plate from today's Traditions at Scott menu that fits your allergies, diet and goals, then walks you to it.",
}

const PROBLEMS = [
  {
    title: "Too much to sort through",
    body: "Scott runs more than a dozen stations, from the Grill to the Mongolian Grill. Building a balanced plate means checking each one.",
  },
  {
    title: "Allergies and diets make it harder",
    body: "Students with allergies, vegetarian or halal diets, or a nutrient to watch read labels station by station. Too often the easy choice is the same safe meal, or skipping it.",
  },
  {
    title: "Dining has to guess",
    body: "Scott discarded about 4,700 pounds of food a month, and at the OSU halls that tracked why, overproduction topped the list.",
  },
]

const CUSTOMERS = [
  {
    who: "Students who eat at Scott",
    examples: [
      "A first-year with milk and egg allergies",
      "A vegetarian tired of the same three options",
      "Someone low on iron or vitamin D",
      "An athlete hitting a daily protein goal",
    ],
  },
  {
    who: "OSU Dining",
    examples: [
      "Sees which foods students like and plan to eat tomorrow",
      "Can cook closer to real demand and waste less",
      "Gets counts only, never who ate what",
    ],
  },
]

const SOLUTION: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: HandPlatter,
    title: "Feed me",
    body: "Swipe through ready-made plates from today's real Scott menu, ranked by the foods you like and your goals.",
  },
  {
    Icon: Route,
    title: "A route, not a list",
    body: "Pick a plate and get the stations in walking order, with how much to take at each one.",
  },
  {
    Icon: ShieldCheck,
    title: "Safe by default",
    body: "Foods with your allergens never show up, anywhere in the app. Unlabeled foods are hidden too if you have any allergy.",
  },
  {
    Icon: CalendarCheck,
    title: "Plan and track",
    body: "Plan the week ahead, look back at past days, and see how often you hit your nutrient or protein goal.",
  },
  {
    Icon: Link2,
    title: "Recipe dupe",
    body: "Paste any recipe link and get the closest version you can build at Scott this week.",
  },
  {
    Icon: ChartColumn,
    title: "Insights for Dining",
    body: "Likes and planned servings, added up for the kitchen so it can prep for what students will actually eat.",
  },
]

const STEPS = ["Tell us what you can't eat and what you're aiming for", "Swipe foods you love", "Tap Feed me and follow the route"]

const TRUST = [
  "Feed me uses no AI. It chooses from 215 plates our team built.",
  "AI is used only to match recipe links, and it only sees foods already safe for you.",
  "Nutrition comes from Scott's menu data. Calories stay hidden unless you set a protein goal.",
]

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
            BuckeyeBites picks a plate from today&apos;s Traditions at Scott menu that fits your allergies, diet and
            goals, then walks you to it, station by station.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ className: "h-12 rounded-xl px-6 text-base font-bold sm:w-48" })}>
              Create account
            </Link>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                className: "h-12 rounded-xl border-2 border-foreground px-6 text-base font-bold sm:w-48",
              })}
            >
              Log in
            </Link>
          </div>
        </section>

        <section aria-labelledby="problem" className="mx-auto w-full max-w-5xl px-4 md:px-8">
          <h2 id="problem" className="text-2xl font-extrabold md:text-3xl">
            The problem
          </h2>
          <p className="mt-2 max-w-2xl text-base text-foreground/80">
            Scott&apos;s menu is big and changes every meal, and every student has to work out their own plate from scratch.
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map(({ title, body }) => (
              <li key={title} className="rounded-2xl bg-card p-5">
                <h3 className="text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="customers" className="mx-auto mt-14 w-full max-w-5xl px-4 md:mt-20 md:px-8">
          <h2 id="customers" className="text-2xl font-extrabold md:text-3xl">
            Who it&apos;s for
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {CUSTOMERS.map(({ who, examples }) => (
              <div key={who} className="rounded-2xl bg-card p-5">
                <h3 className="text-lg font-extrabold">{who}</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {examples.map((e) => (
                    <li key={e} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-buckeye" aria-hidden />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="solution" className="mx-auto mt-14 w-full max-w-5xl px-4 md:mt-20 md:px-8">
          <h2 id="solution" className="text-2xl font-extrabold md:text-3xl">
            The solution
          </h2>
          <p className="mt-2 max-w-2xl text-base text-foreground/80">
            One app that knows what you can eat, picks the plate, and tells Dining what&apos;s coming.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTION.map(({ Icon, title, body }) => (
              <li key={title} className="rounded-2xl bg-card p-5">
                <Icon className="size-6 text-primary" aria-hidden strokeWidth={1.75} />
                <h3 className="mt-3 text-base font-extrabold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 bg-buckeye text-white md:mt-20">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8 md:py-12">
            <h2 className="text-2xl font-extrabold">How it works</h2>
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
          <h2 className="text-2xl font-extrabold md:text-3xl">Built for Scott</h2>
          <ul className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
            {LANDING_STATS.map(({ value, label }) => (
              <li key={label} className="rounded-2xl bg-card px-3 py-4 md:px-5 md:py-6">
                <span className="block font-heading text-3xl font-extrabold text-primary tabular-nums md:text-5xl">{value}</span>
                <span className="mt-1 block text-xs text-foreground/75 md:text-sm">{label}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-14 text-2xl font-extrabold md:text-3xl">How we use AI, and how we don&apos;t</h2>
          <ul className="mt-4 flex max-w-2xl flex-col gap-3">
            {TRUST.map((t) => (
              <li key={t} className="flex gap-2.5 text-base leading-relaxed">
                <ShieldCheck className="mt-1 size-5 shrink-0 text-sage" aria-hidden strokeWidth={2} />
                {t}
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
