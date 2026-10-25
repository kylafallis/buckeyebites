import type { Metadata } from "next"
import { AuthShell } from "@/components/auth-shell"
import { SignupForm } from "./signup-form"

export const metadata: Metadata = {
  title: "Sign up · BuckeyeBites",
}

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Two minutes of setup, then one tap to a plate that fits you.">
      <SignupForm />
    </AuthShell>
  )
}
