import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    // Handles the link in the signup confirmation email (when "Confirm email" is on).
    if (!error) {
      // proxy.ts sends users who haven't onboarded on to /onboarding.
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", request.url))
}
