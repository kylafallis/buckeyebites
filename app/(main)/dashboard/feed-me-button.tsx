"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CircleNotchIcon } from "@phosphor-icons/react"
import { requestPlate } from "@/lib/request-plate"
import { Button } from "@/components/ui/button"

export function FeedMeButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function feedMe() {
    setPending(true)
    setError(null)
    try {
      router.push(`/plate/${await requestPlate()}`)
    } catch (e) {
      setError((e as Error).message)
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={feedMe} disabled={pending} className="h-16 w-full text-lg font-semibold">
        {pending ? (
          <>
            <CircleNotchIcon className="size-5 animate-spin" />
            Finding your plate...
          </>
        ) : (
          "Feed me"
        )}
      </Button>
      <p className="sr-only" aria-live="polite">
        {pending ? "Finding your plate" : ""}
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
