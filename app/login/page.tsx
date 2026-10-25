import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthShell } from "@/components/auth-shell"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Log in · BuckeyeBites",
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to see what's safe for you at Scott today.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
