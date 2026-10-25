import { ShieldCheckIcon } from "@phosphor-icons/react/ssr"
import Link from "next/link"
import { Logo } from "@/components/logo"

const POINTS = [
  "Only food that's safe for your allergies and diet",
  "A ready-made plate and the route to get it",
  "Plan your week and track your goals",
]

/**
 * Login and signup layout: on wide screens a buckeye-brown panel with the
 * tagline sits beside the form; on phones the logo sits above it.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-stretch">
      <section className="hidden flex-1 flex-col justify-between bg-buckeye p-12 text-white lg:flex" aria-label="About BuckeyeBites">
        <Link href="/" className="font-heading text-2xl font-extrabold text-nut">
          BuckeyeBites
        </Link>
        <div>
          <p className="font-heading text-5xl leading-[1.05] font-extrabold">
            Your plate,
            <br />
            <span className="text-nut">planned.</span>
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-lg">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <ShieldCheckIcon className="mt-1 size-5 shrink-0 text-nut" weight="fill" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/80">Built at HackOHI/O 2026 for Traditions at Scott.</p>
      </section>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block lg:hidden" aria-label="BuckeyeBites home">
            <Logo priority className="-ml-2 h-14" />
          </Link>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
