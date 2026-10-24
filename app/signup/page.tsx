import type { Metadata } from "next"
import { SignupForm } from "./signup-form"

export const metadata: Metadata = {
  title: "Sign up · BuckeyeBites",
}

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <SignupForm />
    </main>
  )
}
