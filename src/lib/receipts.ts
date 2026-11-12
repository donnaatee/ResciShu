import { convert, type Unit } from "./units";

/* ---------- Types ---------- */

export interface Purchase {
  id: string; receipt_id: string; store: string; purchase_date: string; created_at: string;
  ingredient_id: string | null; product_name: string; quantity: number | null; unit: string | null; total_price: number;
}

/** One line on the review screen, before it's saved. */
export interface ReceiptLine {
  key: string;
  include: boolean;          // false = skip this line entirely
  receipt_text: string;      // as printed, e.g. "RSST POTATO 1LB"
  name: string;              // readable name, e.g. "russet potatoes"
  ingredient_id: string | null;
  quantity: number | null;
  unit: string | null;
  total_price: number | null;
  location: "pantry" | "fridge" | "freezer";
  add_to_inventory: boolean;
}

interface IngredientLike { id: string; name: string; category: string; default_unit: string; est_price_unit: string | null }
interface InventoryLike { id: string; ingredient_id: string; location: string; quantity: number; unit: string }

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/* ---------- Matching receipt names to your ingredients ---------- */

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean)
    .map((w) => (w.endsWith("ies") ? w.slice(0, -3) + "y" : w.endsWith("oes") ? w.slice(0, -2) : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * Finds the ingredient a receipt line most likely is.
 * `suggested` is the AI's pick from your ingredient list; otherwise compare words.
 */
export function matchIngredient<T extends { id: string; name: string }>(name: string, suggested: string, ingredients: T[]): T | null {
  const exact = (n: string) => ingredients.find((i) => i.name === n.trim().toLowerCase());
  const hit = (suggested && exact(suggested)) || exact(name);
  if (hit) return hit;
  const target = new Set(words(name));
  if (!target.size) return null;
  let best: T | null = null, bestScore = 0;
  for (const ing of ingredients) {
    const w = words(ing.name);
    if (!w.length) continue;
    const overlap = w.filter((x) => target.has(x)).length;
    const score = overlap / w.length; // every word of "green onion" must appear to score 1
    if (score > bestScore) { best = ing; bestScore = score; }
  }
  return bestScore >= 1 ? best : null;
}

/** Where a new purchase most likely goes: where you already keep it, otherwise by category. */
export function defaultLocation(ingredient: IngredientLike | undefined, inventory: InventoryLike[]): ReceiptLine["location"] {
  if (!ingredient) return "pantry";
  const rows = inventory.filter((r) => r.ingredient_id === ingredient.id).sort((a, b) => Number(b.quantity) - Number(a.quantity));
  const loc = rows[0]?.location;
  if (loc === "pantry" || loc === "fridge" || loc === "freezer") return loc;
  if (ingredient.category === "frozen") return "freezer";
  if (["meat", "seafood", "dairy"].includes(ingredient.category)) return "fridge";
  return "pantry";
}

/* ---------- Saving to inventory ---------- */

/** Adds a bought amount to the row already at that location, in that row's unit. */
export function inventoryAfterPurchase(existing: InventoryLike | undefined, quantity: number, unit: string, unitMap: Map<string, Unit>):
  { kind: "update"; id: string; quantity: number } | { kind: "insert"; quantity: number; unit: string } | { kind: "mismatch" } {
  if (!existing) return { kind: "insert", quantity: r3(quantity), unit };
  const from = unitMap.get(unit), to = unitMap.get(existing.unit);
  const c = from && to ? convert(quantity, from, to) : null;
  if (c == null) return { kind: "mismatch" };
  return { kind: "update", id: existing.id, quantity: r3(Number(existing.quantity) + c) };
}

/* ---------- Prices ---------- */

/** Price per one `target` unit, e.g. 2 lb for $6 -> $3 per lb, or $0.19 per oz. */
export function pricePer(p: Pick<Purchase, "quantity" | "unit" | "total_price">, target: string, unitMap: Map<string, Unit>): number | null {
  if (!p.quantity || p.quantity <= 0 || !p.unit) return null;
  const from = unitMap.get(p.unit), to = unitMap.get(target);
  const q = from && to ? convert(Number(p.quantity), from, to) : null;
  if (!q) return null;
  return Number(p.total_price) / q;
}

const newestFirst = (a: Purchase, b: Purchase) => b.purchase_date.localeCompare(a.purchase_date) || b.created_at.localeCompare(a.created_at);

/** Latest purchase of an ingredient that can be priced in `unit`, optionally at one store. */
export function latestPurchase(purchases: Purchase[], ingredientId: string, unit: string, unitMap: Map<string, Unit>, store?: string | null): Purchase | null {
  return purchases
    .filter((p) => p.ingredient_id === ingredientId && (!store || p.store === store) && pricePer(p, unit, unitMap) != null)
    .sort(newestFirst)[0] ?? null;
}

/** What `quantity unit` of an ingredient costs at your latest price (at a store, or anywhere). */
export function priceAt(ingredientId: string, quantity: number, unit: string, purchases: Purchase[], unitMap: Map<string, Unit>, store?: string | null): number | null {
  const p = latestPurchase(purchases, ingredientId, unit, unitMap, store);
  const per = p ? pricePer(p, unit, unitMap) : null;
  return per == null ? null : r2(per * quantity);
}

export interface StoreRow { store: string; latest: Purchase; per: number; previousPer: number | null; change: number | null; cheapest: boolean }

/** For one ingredient: latest price per unit at each store, change since the previous buy there, and the cheapest store. */
export function storePrices(purchases: Purchase[], ingredientId: string, unit: string, unitMap: Map<string, Unit>): StoreRow[] {
  const mine = purchases.filter((p) => p.ingredient_id === ingredientId && pricePer(p, unit, unitMap) != null).sort(newestFirst);
  const byStore = new Map<string, Purchase[]>();
  for (const p of mine) byStore.set(p.store, [...(byStore.get(p.store) ?? []), p]);
  const rows: StoreRow[] = [...byStore].map(([store, list]) => {
    const per = pricePer(list[0]!, unit, unitMap)!;
    const previousPer = list[1] ? pricePer(list[1], unit, unitMap) : null;
    return { store, latest: list[0]!, per, previousPer, change: previousPer ? (per - previousPer) / previousPer : null, cheapest: false };
  });
  const min = Math.min(...rows.map((r) => r.per));
  if (rows.length > 1) for (const r of rows) r.cheapest = r.per <= min + 1e-9;
  return rows.sort((a, b) => a.per - b.per);
}

/** The unit to compare an ingredient's prices in. */
export function priceUnit(ingredient: Pick<IngredientLike, "est_price_unit" | "default_unit">, purchases: Purchase[], ingredientId: string, unitMap: Map<string, Unit>): string {
  for (const u of [ingredient.est_price_unit, ingredient.default_unit]) {
    if (u && purchases.some((p) => p.ingredient_id === ingredientId && pricePer(p, u, unitMap) != null)) return u;
  }
  return purchases.find((p) => p.ingredient_id === ingredientId && p.unit)?.unit ?? ingredient.default_unit;
}

/** Grocery list total at each store. Items with no price history at a store are counted, not guessed. */
export function compareStores(items: { ingredient_id: string | null; quantity: number | null; unit: string | null }[], purchases: Purchase[], unitMap: Map<string, Unit>) {
  const stores = [...new Set(purchases.map((p) => p.store))];
  return stores.map((store) => {
    let total = 0, priced = 0, missing = 0;
    for (const it of items) {
      const price = it.ingredient_id && it.quantity && it.unit ? priceAt(it.ingredient_id, Number(it.quantity), it.unit, purchases, unitMap, store) : null;
      if (price == null) missing++; else { total += price; priced++; }
    }
    return { store, total: r2(total), priced, missing };
  }).sort((a, b) => b.priced - a.priced || a.total - b.total);
}

/** Receipt lines that look like a receipt you already saved (same store, date and total). */
export function looksLikeDuplicate(store: string, date: string, total: number, purchases: Purchase[]): boolean {
  const sums = new Map<string, number>();
  for (const p of purchases) if (p.store.toLowerCase() === store.trim().toLowerCase() && p.purchase_date === date) sums.set(p.receipt_id, (sums.get(p.receipt_id) ?? 0) + Number(p.total_price));
  return [...sums.values()].some((s) => Math.abs(s - total) < 0.01);
}
