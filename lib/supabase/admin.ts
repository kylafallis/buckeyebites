import { createClient } from "@supabase/supabase-js"

/**
 * Service-role client that bypasses RLS. Server code only: never import this
 * from a client component, and never expose the key to the browser.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only run on the server")
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
