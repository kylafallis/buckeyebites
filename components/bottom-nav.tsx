"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignOutIcon } from "@phosphor-icons/react"
import { useTrackInAppNavigation } from "@/components/back-bar"
import { isActiveTab, TABS } from "@/components/nav-tabs"

/** Phones (below md): fixed tab bar at the bottom. Always mounted, so it also tracks in-app navigation. */
export function BottomNav() {
  const pathname = usePathname()
  useTrackInAppNavigation()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-6">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActiveTab(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-6" weight={active ? "fill" : "regular"} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** md and up: sticky bar at the top with the wordmark, tabs and Sign out. */
export function TopNav() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 hidden border-b bg-background/95 backdrop-blur md:block">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="BuckeyeBite home">
          <span className="flex size-7 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <span className="text-base font-bold tracking-tight">
            Buckeye<span className="text-primary">Bite</span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex flex-1 justify-center">
          <ul className="flex items-center gap-1">
            {TABS.map(({ href, label, Icon }) => {
              const active = isActiveTab(pathname, href)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-9 items-center gap-1.5 px-2.5 text-sm font-medium transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {/* Icons only from lg, so the bar fits at 768px. */}
                    <Icon className="hidden size-4 lg:block" weight={active ? "fill" : "regular"} />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <form action="/auth/signout" method="post" className="shrink-0">
          <button
            type="submit"
            className="flex h-9 items-center gap-1.5 px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SignOutIcon className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
