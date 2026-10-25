"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { authErrorMessage } from "@/lib/supabase/auth-errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authButton, authInput, authLabel } from "@/components/auth-styles"

export function LoginForm() {
  const router = useRouter()
  const callbackError = useSearchParams().get("error")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(
    callbackError ? "That confirmation link didn't work. Try logging in." : null
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(authErrorMessage(error))
      setPending(false)
      return
    }
    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="email" className={`${authLabel} mt-2 first:mt-0`}>
            Email
          </label>
          <Input
            className={authInput}
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          <label htmlFor="password" className={`${authLabel} mt-2 first:mt-0`}>
            Password
          </label>
          <Input
            className={authInput}
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className={`${authButton} mt-3`}>
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
      <p className="flex justify-center gap-1 text-sm">
        New here?
        <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
