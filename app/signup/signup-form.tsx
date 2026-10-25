"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { authErrorMessage } from "@/lib/supabase/auth-errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authButton, authInput, authLabel } from "@/components/auth-styles"

const MIN_PASSWORD_LENGTH = 6

export function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setPending(true)
    setError(null)

    const displayName = name.trim()
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The signup trigger copies this into profiles.display_name.
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(authErrorMessage(error))
      setPending(false)
      return
    }

    // With email confirmation on, Supabase hides duplicate emails by returning
    // a user with no identities instead of an error.
    if (data.user && data.user.identities?.length === 0) {
      setError("An account with this email already exists. Try logging in.")
      setPending(false)
      return
    }

    if (!data.session) {
      setConfirmEmail(email)
      setPending(false)
      return
    }

    await supabase.from("profiles").update({ display_name: displayName }).eq("id", data.user!.id)
    router.replace("/onboarding")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {confirmEmail ? (
          <p className="text-sm" role="status">
            Check <span className="font-medium">{confirmEmail}</span> to confirm your account,
            then log in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <label htmlFor="name" className={`${authLabel} mt-2 first:mt-0`}>
              Name
            </label>
            <Input
              className={authInput}
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
            />
            <label htmlFor="password" className={`${authLabel} mt-2 first:mt-0`}>
              Password
            </label>
            <Input
              className={authInput}
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-sm text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending} className={`${authButton} mt-3`}>
              {pending ? "Creating account…" : "Sign up"}
            </Button>
          </form>
        )}
      </div>
      <p className="flex justify-center gap-1 text-sm">
        Already have an account?
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
