import { daysUntil, scale, type InvRow } from "./kitchen";
import { convert, type Unit } from "./units";

/* ---------- Date helpers (plain "YYYY-MM-DD" strings, no time zones) ---------- */

/** "2026-11-16" + 1 -> "2026-11-17" */
export function shiftDate(date: string, days: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

/** Monday of the week that contains `date`. */
export function weekStart(date: string): string {
  const dow = new Date(date + "T12:00:00Z").getUTCDay(); // 0 = Sunday
  return shiftDate(date, dow === 0 ? -6 : 1 - dow);
}

/* ---------- Thaw reminders ---------- */

/** Freezer items in these categories don't need thawing (frozen peas go straight in the pot). */
export const NO_THAW_CATEGORIES = ["frozen", "produce"];

export interface StockRow extends InvRow { id: string; ingredient?: { name: string; category: string } | undefined }
export interface PlannedMeal { id: string; plan_date: string; meal_type: string; recipe_id: string; servings: number }
export interface PlannerRecipe {
  id: string; name: string; servings: number;
  recipe_ingredients: { ingredient_id: string; quantity: number | null; unit: string | null }[];
}

export interface ThawReminder {
  key: string;            // unique per meal + ingredient (used to dismiss)
  meal: PlannedMeal;
  recipe_name: string;
  ingredient_id: string;
  ingredient_name: string;
  freezer_row: StockRow;
  amount: number | null;  // how much to take out, in the freezer row's unit (null = "enough for the recipe")
  remind_on: string;      // the night before the meal
}

/**
 * For each planned meal, find ingredients you only have frozen.
 * If the fridge/pantry already has enough, there's nothing to thaw.
 */
export function thawReminders(meals: PlannedMeal[], recipes: PlannerRecipe[], inventory: StockRow[], unitMap: Map<string, Unit>): ThawReminder[] {
  const out: ThawReminder[] = [];
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipe_id);
    if (!recipe) continue;
    for (const ri of recipe.recipe_ingredients) {
      const freezer = inventory.find((r) => r.ingredient_id === ri.ingredient_id && r.location === "freezer" && Number(r.quantity) > 0);
      if (!freezer) continue;
      if (NO_THAW_CATEGORIES.includes(freezer.ingredient?.category ?? "")) continue;
      const thawed = inventory.filter((r) => r.ingredient_id === ri.ingredient_id && r.location !== "freezer" && Number(r.quantity) > 0);

      let amount: number | null = null;
      if (ri.quantity == null || !ri.unit) {
        if (thawed.length > 0) continue; // "to taste" and you have some unfrozen: fine
      } else {
        const need = scale(Number(ri.quantity), Number(recipe.servings), Number(meal.servings));
        const needUnit = unitMap.get(ri.unit);
        let have = 0;
        for (const r of thawed) {
          const u = unitMap.get(r.unit);
          const c = u && needUnit ? convert(Number(r.quantity), u, needUnit) : null;
          if (c != null) have += c;
        }
        if (have + 1e-9 >= need) continue;
        const fu = unitMap.get(freezer.unit);
        const inFreezerUnit = needUnit && fu ? convert(need - have, needUnit, fu) : null;
        amount = inFreezerUnit == null ? null : Math.min(Math.round(inFreezerUnit * 100) / 100, Number(freezer.quantity));
      }

      out.push({
        key: `${meal.id}:${ri.ingredient_id}`,
        meal,
        recipe_name: recipe.name,
        ingredient_id: ri.ingredient_id,
        ingredient_name: freezer.ingredient?.name ?? "ingredient",
        freezer_row: freezer,
        amount,
        remind_on: shiftDate(meal.plan_date, -1),
      });
    }
  }
  return out.sort((a, b) => a.meal.plan_date.localeCompare(b.meal.plan_date));
}

/**
 * "Moved to fridge": how the freezer and fridge rows should change.
 * Moves `amount` (or the whole freezer row if amount is unknown).
 */
export function planThawMove(freezer: StockRow, fridge: StockRow | undefined, amount: number | null, unitMap: Map<string, Unit>) {
  const move = amount == null ? Number(freezer.quantity) : Math.min(amount, Number(freezer.quantity));
  const freezerQty = Math.round((Number(freezer.quantity) - move) * 1000) / 1000;
  if (!fridge) return { freezerQty, fridge: { id: undefined, quantity: move, unit: freezer.unit } };
  const from = unitMap.get(freezer.unit), to = unitMap.get(fridge.unit);
  const c = from && to ? convert(move, from, to) : null;
  if (c == null) return { freezerQty, fridge: null }; // units can't be combined; only the freezer is updated
  return { freezerQty, fridge: { id: fridge.id, quantity: Math.round((Number(fridge.quantity) + c) * 1000) / 1000, unit: fridge.unit } };
}

/* ---------- "Use it up" suggestions ---------- */

/** recipe id -> names of its ingredients that expire within `days` days. Recipes with none are left out. */
export function recipesUsingSoon(recipes: PlannerRecipe[], inventory: (StockRow & { expiration_date: string | null })[], today: string, days = 5): Map<string, string[]> {
  const soon = new Map<string, string>();
  for (const r of inventory) {
    if (!r.expiration_date || Number(r.quantity) <= 0) continue;
    const d = daysUntil(r.expiration_date, today);
    if (d >= 0 && d <= days) soon.set(r.ingredient_id, r.ingredient?.name ?? "");
  }
  const out = new Map<string, string[]>();
  for (const recipe of recipes) {
    const names = [...new Set(recipe.recipe_ingredients.map((ri) => soon.get(ri.ingredient_id)).filter((n): n is string => !!n))];
    if (names.length) out.set(recipe.id, names);
  }
  return out;
}
