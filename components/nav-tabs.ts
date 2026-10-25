import {
  BookOpenIcon,
  CalendarBlankIcon,
  CookingPotIcon,
  ForkKnifeIcon,
  HouseIcon,
  UserIcon,
  type Icon,
} from "@phosphor-icons/react"

/** The app's main tabs, shared by the phone bottom bar and the desktop top bar. */
export const TABS: { href: string; label: string; Icon: Icon }[] = [
  { href: "/dashboard", label: "Home", Icon: HouseIcon },
  { href: "/menu", label: "Menu", Icon: ForkKnifeIcon },
  { href: "/recipes", label: "Recipes", Icon: BookOpenIcon },
  { href: "/plan", label: "Plan", Icon: CalendarBlankIcon },
  { href: "/dupe", label: "Dupe", Icon: CookingPotIcon },
  { href: "/me", label: "Me", Icon: UserIcon },
]

/** A tab is current on its own page and its subpages. Plate pages match none. */
export const isActiveTab = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)
