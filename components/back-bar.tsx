"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeftIcon, XIcon } from "@phosphor-icons/react"

// Set once the user has moved between pages inside the app, so "back" is
// known to stay in BuckeyeBites. history.length can't tell: a tab opened on
// another site, then on a plate link, has history that leaves the app.
let navigatedInApp = false

/** Mounted in the (main) layout: notes client-side navigations between pages. */
export function useTrackInAppNavigation() {
  const pathname = usePathname()
  const first = useRef(pathname)
  useEffect(() => {
    if (pathname !== first.current) navigatedInApp = true
  }, [pathname])
}

function cameFromApp() {
  if (navigatedInApp) return true
  try {
    return document.referrer !== "" && new URL(document.referrer).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Back arrow and close X that return to the previous page, or to /dashboard
 * when the page wasn't reached from inside the app (e.g. opened directly).
 */
export function BackBar() {
  const router = useRouter()
  const leave = () => {
    if (cameFromApp() && window.history.length > 1) router.back()
    else router.push("/dashboard")
  }
  const button = "flex size-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
  return (
    <div className="-mx-2 mb-2 flex items-center justify-between">
      <button type="button" onClick={leave} aria-label="Go back" className={button}>
        <ArrowLeftIcon className="size-5" />
      </button>
      <button type="button" onClick={leave} aria-label="Close" className={button}>
        <XIcon className="size-5" />
      </button>
    </div>
  )
}
