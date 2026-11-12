import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Purchase } from "./receipts";
import type { Unit } from "./units";

// All database access lives here; pages only call these.
function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export interface Ingredient { id: string; name: string; category: string; default_unit: string; est_price: number | null; est_price_unit: string | null; is_staple: boolean }
export interface InventoryItem { id: string; ingredient_id: string; location: "pantry" | "fridge" | "freezer"; quantity: number; unit: string; low_stock_threshold: number | null; expiration_date: string | null; purchased_date: string | null; notes: string | null; ingredient?: Ingredient }
export interface RecipeIngredient { id?: string; ingredient_id: string; quantity: number | null; unit: string | null; prep_note: string | null; sort_order: number; ingredient?: Ingredient }
export interface Recipe { id: string; name: string; description: string | null; photo_path: string | null; prep_minutes: number | null; cook_minutes: number | null; servings: number; category: string; instructions: string[]; recipe_ingredients: RecipeIngredient[] }
export interface GroceryItem { id: string; grocery_list_id: string; ingredient_id: string | null; custom_name: string | null; quantity: number | null; unit: string | null; estimated_price: number | null; is_purchased: boolean; added_manually: boolean; ingredient?: Ingredient | null }
export interface GroceryList { id: string; name: string; status: string; source: string; created_at: string }
export interface MealPlan { id: string; plan_date: string; meal_type: "breakfast" | "lunch" | "dinner"; recipe_id: string; servings: number }

export const unitsQuery = queryOptions({ queryKey: ["units"], staleTime: Infinity, queryFn: async () => ok(await supabase.from("units").select("*").order("dimension")) as Unit[] });
export const ingredientsQuery = queryOptions({ queryKey: ["ingredients"], queryFn: async () => ok(await supabase.from("ingredients").select("*").order("name")) as Ingredient[] });
export const inventoryQuery = queryOptions({ queryKey: ["inventory"], queryFn: async () => ok(await supabase.from("inventory").select("*, ingredient:ingredients(*)")) as InventoryItem[] });
export const recipesQuery = queryOptions({ queryKey: ["recipes"], queryFn: async () => ok(await supabase.from("recipes").select("*, recipe_ingredients(*, ingredient:ingredients(*))").order("name")) as Recipe[] });
export const groceryListsQuery = queryOptions({ queryKey: ["grocery_lists"], queryFn: async () => ok(await supabase.from("grocery_lists").select("*").order("created_at", { ascending: false })) as GroceryList[] });
export const groceryItemsQuery = (listId: string) => queryOptions({ queryKey: ["grocery_items", listId], queryFn: async () => ok(await supabase.from("grocery_list_items").select("*, ingredient:ingredients(*)").eq("grocery_list_id", listId).order("created_at")) as GroceryItem[] });
export const mealPlansQuery = (from: string, to: string) => queryOptions({ queryKey: ["meal_plans", from, to], queryFn: async () => ok(await supabase.from("meal_plans").select("*").gte("plan_date", from).lte("plan_date", to).order("plan_date")) as MealPlan[] });

export const purchasesQuery = queryOptions({ queryKey: ["purchases"], queryFn: async () => ok(await supabase.from("purchase_history").select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false })) as Purchase[] });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export async function createIngredient(name: string, default_unit: string, category = "other") {
  const clean = name.trim().toLowerCase();
  return ok(await supabase.from("ingredients").insert({ name: clean, default_unit, category }).select().single()) as Ingredient;
}
export async function updateIngredient(id: string, patch: Partial<Ingredient>) { ok(await supabase.from("ingredients").update(patch).eq("id", id)); }

export async function upsertInventory(row: Omit<InventoryItem, "id" | "ingredient"> & { id?: string | undefined }) {
  if (row.id) { const { id, ...rest } = row; ok(await supabase.from("inventory").update(rest).eq("id", id)); }
  else ok(await supabase.from("inventory").insert(row));
}
export async function setInventoryQuantity(id: string, quantity: number) { ok(await supabase.from("inventory").update({ quantity }).eq("id", id)); }
export async function insertInventoryRow(row: Omit<InventoryItem, "id" | "ingredient">) { return ok(await supabase.from("inventory").insert(row).select().single()) as InventoryItem; }
export async function deleteInventory(id: string) { ok(await supabase.from("inventory").delete().eq("id", id)); }

export async function saveRecipe(r: Omit<Recipe, "id" | "recipe_ingredients"> & { id?: string | undefined }, items: RecipeIngredient[]) {
  const { id, ...fields } = r;
  let recipeId = id;
  if (id) ok(await supabase.from("recipes").update(fields).eq("id", id));
  else recipeId = (ok(await supabase.from("recipes").insert(fields).select("id").single()) as { id: string }).id;
  ok(await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId!));
  if (items.length) ok(await supabase.from("recipe_ingredients").insert(items.map((it, i) => ({ recipe_id: recipeId!, ingredient_id: it.ingredient_id, quantity: it.quantity, unit: it.unit, prep_note: it.prep_note, sort_order: i }))));
  return recipeId!;
}
export async function deleteRecipe(id: string) { ok(await supabase.from("recipes").delete().eq("id", id)); }

export async function uploadPhoto(file: File): Promise<string> {
  const blob = await resizeImage(file, 1200);
  const path = `${crypto.randomUUID()}.jpg`;
  ok(await supabase.storage.from("recipe-photos").upload(path, blob, { contentType: "image/jpeg" }));
  return path;
}
export const photoUrlQuery = (path: string) => queryOptions({ queryKey: ["photo", path], staleTime: 50 * 60 * 1000, queryFn: async () => (ok(await supabase.storage.from("recipe-photos").createSignedUrl(path, 3600)) as { signedUrl: string }).signedUrl });

export async function addPurchases(rows: Omit<Purchase, "id" | "created_at">[]) { if (rows.length) ok(await supabase.from("purchase_history").insert(rows)); }
export async function deleteReceipt(receiptId: string) { ok(await supabase.from("purchase_history").delete().eq("receipt_id", receiptId)); }

/** Shrinks a photo and returns it as base64 JPEG (receipts stay readable at 2000px). */
export async function photoToBase64(file: File, max = 2000): Promise<{ data: string; mimeType: string }> {
  const blob = await resizeImage(file, max);
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(new Error("Couldn't read that photo."));
    r.readAsDataURL(blob);
  });
  return { data, mimeType: "image/jpeg" };
}

async function resizeImage(file: File, max: number): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export async function createGroceryList(name: string, source: string) { return ok(await supabase.from("grocery_lists").insert({ name, source }).select().single()) as GroceryList; }
export async function replaceGeneratedItems(listId: string, items: Omit<GroceryItem, "id" | "grocery_list_id" | "is_purchased" | "added_manually" | "ingredient">[]) {
  ok(await supabase.from("grocery_list_items").delete().eq("grocery_list_id", listId).eq("added_manually", false));
  if (items.length) ok(await supabase.from("grocery_list_items").insert(items.map((i) => ({ ...i, grocery_list_id: listId, added_manually: false }))));
}
export async function addGroceryItem(row: Partial<Omit<GroceryItem, "ingredient">> & { grocery_list_id: string }) { ok(await supabase.from("grocery_list_items").insert({ ...row, added_manually: true })); }
export async function updateGroceryItem(id: string, patch: Partial<Omit<GroceryItem, "ingredient">>) { ok(await supabase.from("grocery_list_items").update(patch).eq("id", id)); }
export async function deleteGroceryItem(id: string) { ok(await supabase.from("grocery_list_items").delete().eq("id", id)); }
export async function updateGroceryList(id: string, patch: Partial<GroceryList>) { ok(await supabase.from("grocery_lists").update(patch).eq("id", id)); }
export async function deleteGroceryList(id: string) { ok(await supabase.from("grocery_lists").delete().eq("id", id)); }

export async function addMeal(m: Omit<MealPlan, "id">) { ok(await supabase.from("meal_plans").insert(m)); }
export async function deleteMeal(id: string) { ok(await supabase.from("meal_plans").delete().eq("id", id)); }
