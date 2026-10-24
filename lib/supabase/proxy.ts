import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/signup", "/auth"]

function isPublic(pathname: string) {
  if (pathname === "/") return true // landing page
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    }
  )

  // Refreshes the session if needed. Don't run code between client creation and this call.
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  const { pathname } = request.nextUrl

  // Redirects must carry any refreshed auth cookies, or the session is lost.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") redirect.headers.set(key, value)
    })
    return redirect
  }

  const isApi = pathname.startsWith("/api/")

  if (!userId) {
    if (isApi) return Response.json({ error: "Not signed in" }, { status: 401 })
    return isPublic(pathname) ? response : redirectTo("/login")
  }

  // The callback and sign-out routes handle their own redirects; API routes
  // return JSON and check auth themselves.
  if (pathname.startsWith("/auth/") || isApi) return response

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", userId)
    .maybeSingle()
  const onboarded = profile?.onboarded ?? false

  if (!onboarded) {
    return pathname === "/onboarding" ? response : redirectTo("/onboarding")
  }
  // Onboarded users may revisit /onboarding (the "Me" tab) to edit preferences.
  if (["/", "/login", "/signup"].includes(pathname)) {
    return redirectTo("/dashboard")
  }

  return response
}
