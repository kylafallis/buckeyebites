import type { AuthError } from "@supabase/supabase-js"

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email first. Check your inbox for the link.",
  user_already_exists: "An account with this email already exists. Try logging in.",
  email_exists: "An account with this email already exists. Try logging in.",
  weak_password: "Password must be at least 6 characters.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
}

export function authErrorMessage(error: AuthError) {
  return (error.code && MESSAGES[error.code]) || error.message
}
