import { buildGroceryList } from "./kitchen";
import { replaceGeneratedItems, type Ingredient, type InventoryItem, type Recipe } from "./api";
import type { Unit } from "./units";

export async function generateIntoList(listId: string, picks: { recipe: Recipe; servings: number }[], inv: InventoryItem[], ingredients: Ingredient[], unitMap: Map<string, Unit>) {
  const lines = buildGroceryList(
    picks.map((p) => ({ servings: Number(p.recipe.servings), wanted: p.servings, items: p.recipe.recipe_ingredients })),
    inv, new Map(ingredients.map((i) => [i.id, i])), unitMap);
  await replaceGeneratedItems(listId, lines.map((l) => ({ ingredient_id: l.ingredient_id, custom_name: l.note ?? null, quantity: l.quantity, unit: l.unit, estimated_price: l.estimated_price })));
  return lines.length;
}
