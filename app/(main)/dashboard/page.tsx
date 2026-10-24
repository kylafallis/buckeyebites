import { Suspense } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Dashboard · BuckeyeBites",
}

async function SignedInAs() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return <>Signed in as {data?.claims?.email ?? "unknown"}</>
}

export default function DashboardPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-primary">Dashboard</CardTitle>
          <CardDescription>
            <Suspense fallback="Loading…">
              <SignedInAs />
            </Suspense>
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
