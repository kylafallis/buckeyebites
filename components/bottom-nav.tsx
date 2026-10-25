"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BowlFoodIcon,
  CalendarBlankIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  HouseIcon,
  UserIcon,
} from "@phosphor-icons/react"

const TABS = [
  { href: "/dashboard", label: "Home", Icon: HouseIcon },
  { href: "/menu", label: "Menu", Icon: ForkKnifeIcon },
  { href: "/plate", label: "Plate", Icon: BowlFoodIcon },
  { href: "/plan", label: "Plan", Icon: CalendarBlankIcon },
  { href: "/dupe", label: "Dupe", Icon: CookingPotIcon },
  { href: "/onboarding", label: "Me", Icon: UserIcon },
]

export function BottomNav() {
  return <NavBar pathname={usePathname()} />
}

function NavBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-6">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
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
