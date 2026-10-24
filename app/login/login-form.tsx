"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Status =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; email: string }
  | { state: "error"; message: string }

export function LoginForm() {
  const callbackError = useSearchParams().get("error")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>(
    callbackError
      ? { state: "error", message: "That sign-in link didn't work. Request a new one." }
      : { state: "idle" }
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus({ state: "sending" })

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    setStatus(
      error ? { state: "error", message: error.message } : { state: "sent", email }
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg text-primary">BuckeyeBites</CardTitle>
        <CardDescription>Sign in with your email. We&apos;ll send you a magic link.</CardDescription>
      </CardHeader>
      <CardContent>
        {status.state === "sent" ? (
          <p className="text-sm" role="status">
            Check <span className="font-medium">{status.email}</span> for your sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-xs font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="brutus.1@osu.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={status.state === "error" || undefined}
            />
            {status.state === "error" && (
              <p className="text-xs text-destructive" role="alert">
                {status.message}
              </p>
            )}
            <Button type="submit" disabled={status.state === "sending"}>
              {status.state === "sending" ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
