"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { authErrorMessage } from "@/lib/supabase/auth-errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg text-primary">BuckeyeBites</CardTitle>
        <CardDescription>Create your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {confirmEmail ? (
          <p className="text-sm" role="status">
            Check <span className="font-medium">{confirmEmail}</span> to confirm your account,
            then log in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="name" className="text-xs font-medium">
              Name
            </label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="email" className="text-xs font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password" className="text-xs font-medium">
              Password
            </label>
            <Input
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
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Creating account…" : "Sign up"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center gap-1 text-xs">
        Already have an account?
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </CardFooter>
    </Card>
  )
}
