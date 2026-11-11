import { convert, type Unit } from "./units";

export interface InvRow { ingredient_id: string; quantity: number; unit: string; location: string }
export interface Need { ingredient_id: string; quantity: number | null; unit: string | null }

export function scale(qty: number, originalServings: number, newServings: number): number {
  if (!originalServings) return qty;
  return (qty * newServings) / originalServings;
}

export type Availability =
  | { status: "available" }
  | { status: "short"; need: number; unit: string }
  | { status: "missing" }
  | { status: "check" };

export function availability(need: Need, inventory: InvRow[], unitMap: Map<string, Unit>): Availability {
  const rows = inventory.filter((r) => r.ingredient_id === need.ingredient_id && Number(r.quantity) > 0);
  if (rows.length === 0) return { status: "missing" };
  if (need.quantity == null || !need.unit) return { status: "available" };
  const target = unitMap.get(need.unit);
  if (!target) return { status: "check" };
  let have = 0;
  for (const r of rows) {
    const u = unitMap.get(r.unit);
    const c = u ? convert(Number(r.quantity), u, target) : null;
    if (c == null) return { status: "check" };
    have += c;
  }
  if (have + 1e-9 >= need.quantity) return { status: "available" };
  return { status: "short", need: need.quantity - have, unit: need.unit };
}

export interface IngredientInfo { id: string; name: string; default_unit: string; est_price: number | null; est_price_unit: string | null; is_staple: boolean }
export interface GroceryLine { ingredient_id: string; name: string; quantity: number | null; unit: string; estimated_price: number | null; note?: string }

/** recipes: each with servings wanted and its ingredient list (already at original servings). */
export function buildGroceryList(
  recipes: { servings: number; wanted: number; items: Need[] }[],
  inventory: InvRow[],
  ingredients: Map<string, IngredientInfo>,
  unitMap: Map<string, Unit>,
): GroceryLine[] {
  const totals = new Map<string, { qty: number; unit: string; mismatch: boolean; anyQty: boolean }>();
  for (const r of recipes) {
    for (const it of r.items) {
      const ing = ingredients.get(it.ingredient_id);
      if (!ing) continue;
      const cur = totals.get(it.ingredient_id) ?? { qty: 0, unit: it.unit ?? ing.default_unit, mismatch: false, anyQty: false };
      if (it.quantity != null && it.unit) {
        const q = scale(Number(it.quantity), r.servings, r.wanted);
        const from = unitMap.get(it.unit), to = unitMap.get(cur.unit);
        const c = from && to ? convert(q, from, to) : null;
        if (c == null) cur.mismatch = true; else { cur.qty += c; cur.anyQty = true; }
      }
      totals.set(it.ingredient_id, cur);
    }
  }
  const out: GroceryLine[] = [];
  for (const [id, t] of totals) {
    const ing = ingredients.get(id)!;
    const target = unitMap.get(t.unit)!;
    let have = 0, haveMismatch = false;
    for (const r of inventory.filter((x) => x.ingredient_id === id)) {
      const u = unitMap.get(r.unit);
      const c = u && target ? convert(Number(r.quantity), u, target) : null;
      if (c == null) { if (Number(r.quantity) > 0) haveMismatch = true; } else have += c;
    }
    if (ing.is_staple && (have > 0 || haveMismatch)) continue;
    if (!t.anyQty) { if (have > 0 || haveMismatch) continue; out.push({ ingredient_id: id, name: ing.name, quantity: null, unit: t.unit, estimated_price: null }); continue; }
    if (haveMismatch && have === 0) { out.push({ ingredient_id: id, name: ing.name, quantity: round(t.qty), unit: t.unit, estimated_price: price(t.qty, t.unit, ing, unitMap), note: "Check — you have some in a different unit" }); continue; }
    const short = t.qty - have;
    if (short <= 1e-9) continue;
    out.push({ ingredient_id: id, name: ing.name, quantity: round(short), unit: t.unit, estimated_price: price(short, t.unit, ing, unitMap), note: t.mismatch ? "Some recipe amounts used different units" : undefined });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function round(n: number) { return Math.round(n * 1000) / 1000; }

export function price(qty: number, unit: string, ing: IngredientInfo, unitMap: Map<string, Unit>): number | null {
  if (ing.est_price == null || !ing.est_price_unit) return null;
  const from = unitMap.get(unit), to = unitMap.get(ing.est_price_unit);
  const c = from && to ? convert(qty, from, to) : null;
  if (c == null) return null;
  return Math.round(c * Number(ing.est_price) * 100) / 100;
}

/** Local-date helpers: compare by date string, never timestamps. */
export function todayStr(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function daysUntil(date: string, today = todayStr()) {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
