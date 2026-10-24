import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Welcome · BuckeyeBites",
}

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-primary">Welcome to BuckeyeBites</CardTitle>
          <CardDescription>
            Onboarding is coming soon. You&apos;ll set your diet, allergens and goals here.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  )
}
