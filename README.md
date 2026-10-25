# BuckeyeBite

**Live site:** https://buckeyebites.vercel.app

BuckeyeBite helps Ohio State students eat well at Traditions at Scott. Tell it your allergies, diets and goals once, and it only ever shows you food that is safe for you. Tap **Feed me** for a ready-made plate from today's menu, with the stations to visit and how much of each item to take.

Built at HackOHI/O 2026 by team Dominatrices: Kyla (tech lead), Hanna (data), Victoria (testing and AI), Maddie (design).

## What it does

- **Feed me:** picks a plate for breakfast, lunch or dinner from 215 ready-made plates written by the team. A plate is only offered when every food on it is on today's menu and safe for you. The pick is random, weighted toward foods you liked, your focus nutrients (iron, vitamin D, calcium, fiber) or your protein goal.
- **Swipe to set preferences:** onboarding shows real Scott foods to like or skip. Sauces and condiments aren't shown.
- **Menu:** today's Scott menu by meal and station, already filtered for you. A location toggle shows sample foods for Kennedy Commons, Morrill Tower and Union Market, which are coming soon.
- **Recipe dupe:** paste a link to any recipe and BuckeyeBite finds the closest foods served at Scott this week, such as swapping in any cheese for the one in the recipe. You then save it to your recipe book.
- **Recipe book and meal plan:** save plates and plan meals for the coming days.
- **Insights for OSU Dining:** the most-liked foods and how many servings students plan to eat tomorrow, so the kitchen can cook closer to real demand and waste less. It shows counts only, never who ate what.
- **Installs as an app:** works on phones as a PWA (Add to Home Screen).

## How allergen safety works

Every list of food in the app goes through one filter on the server (`filterSafe` in `lib/menu.server.ts`) before you see it:

1. **Your allergens are removed.** Any food tagged with one of your allergens is dropped. Tags come from the dining hall's own published allergen labels: milk, egg, fish, soy, wheat, sesame and tree nuts (coconut).
2. **Untagged foods are hidden if you have any allergy.** A food with no allergen tags and no diet tags might have missing information, so it is treated as unsafe for anyone with an allergy.
3. **Every diet must fit.** You can choose several diets (vegetarian, vegan, pescatarian, halal-friendly, gluten-free), and a food has to fit all of them.

Feed me, the menu, swipes, the meal plan and the recipe dupe all use this same filter. The AI in the recipe dupe only ever sees foods that already passed it, so it can't suggest something unsafe. The data scripts also check the tags, `scripts/allergen-audit.sql` confirms that no logged or planned plate contains a user's allergen, and the demo data script refuses to write anything if its own audit finds a problem.

BuckeyeBite is a helper, not a medical guarantee. Students with severe allergies should still confirm with dining staff.

## Where AI is used

Only in the recipe dupe. Gemini (`gemini-flash-lite`) matches the ingredients in a pasted recipe to foods on Scott's menu. If Gemini is slow or unavailable, a rule-based matcher (`lib/dupe.ts`) takes over. Feed me uses no AI: the team wrote the plates and the code picks between them.

## What's real, estimated and simulated

| Real | Estimated | Simulated |
|---|---|---|
| Scott's menu, stations, nutrition and allergen labels for Oct 24–31, 2026 | Iron, vitamin D and calcium badges, which are tagged from food names. Nutrition for the Salad Bar, Grains and Greens and Mongolian Grill, which are typical values. Sample foods for the coming-soon locations. | Demand on the Insights page, from 150 simulated students marked `is_simulated` |

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript), **Tailwind CSS 4**, shadcn components and Recharts
- **Supabase**: Postgres, auth and row-level security, so each user can read and write only their own profile, swipes, logs and plans
- **Google Gemini** through `@google/genai`, for the recipe dupe only
- **Vercel**: every push to `main` deploys

## Data pipeline

1. The menu is kept in a Google Sheet, with one tab per day and a Foods tab of nutrition and tags.
2. `npx tsx scripts/sync-sheet.ts` copies it into `menu_items`, mapping the sheet's tags to allergens and diets.
3. `npx tsx scripts/import-recipes.ts` loads the ready-made plates from `data/recipes.csv`.
4. `scripts/sample-locations.sql` adds sample foods for the coming-soon locations.
5. `npx tsx scripts/demo.ts` creates the demo personas and simulated students. Use `--dry-run` to check without writing.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

`.env.local` needs:

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the app |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts only, never browser code |
| `GEMINI_API_KEY` | the recipe dupe (optional; without it, the rule-based matcher is used) |
| `MENU_SHEET_ID` | `scripts/sync-sheet.ts` |

Run the files in `supabase/migrations/` in order in the Supabase SQL Editor before the first sync.
