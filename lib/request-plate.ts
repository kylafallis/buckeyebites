/** Client helper: asks /api/plate for a new plate and returns its recipe id. */
export async function requestPlate(): Promise<number> {
  let res: Response
  try {
    res = await fetch("/api/plate", { method: "POST" })
  } catch {
    throw new Error("You're offline. Check your connection and try again.")
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok || typeof body.recipeId !== "number") {
    throw new Error(body.error ?? "Something went wrong building your plate.")
  }
  return body.recipeId
}
