import { redirect } from "next/navigation"

// Plates are reached through Feed me or the recipe book; old links to /plate land there.
export default function PlatePage() {
  redirect("/recipes")
}
