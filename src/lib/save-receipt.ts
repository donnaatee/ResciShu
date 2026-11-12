import { addPurchases, insertInventoryRow, setInventoryQuantity, updateIngredient, type Ingredient, type InventoryItem } from "./api";
import { inventoryAfterPurchase, pricePer, type Purchase, type ReceiptLine } from "./receipts";
import type { Unit } from "./units";

/**
 * Saves a reviewed receipt:
 * 1. logs every included line in purchase history (with store and date)
 * 2. adds the bought amounts to inventory (only lines you left switched on)
 * 3. sets each ingredient's estimated price to what you just paid, unless you already logged a newer receipt
 */
export async function saveReceipt(
  receipt: { store: string; date: string; lines: ReceiptLine[] },
  ctx: { inventory: InventoryItem[]; ingredients: Ingredient[]; purchases: Purchase[]; unitMap: Map<string, Unit> },
) {
  const { store, date } = receipt;
  const lines = receipt.lines.filter((l) => l.include && l.total_price != null);
  const receipt_id = crypto.randomUUID();

  await addPurchases(lines.map((l) => ({
    receipt_id, store: store.trim(), purchase_date: date, ingredient_id: l.ingredient_id,
    product_name: l.name.trim() || l.receipt_text, quantity: l.quantity, unit: l.unit, total_price: Number(l.total_price),
  })));

  // Inventory: work on a copy so two lines of the same item add up correctly
  const inv = ctx.inventory.map((r) => ({ ...r }));
  let added = 0;
  const skipped: string[] = [];
  for (const l of lines) {
    if (!l.add_to_inventory || !l.ingredient_id || !l.quantity || !l.unit) continue;
    const existing = inv.find((r) => r.ingredient_id === l.ingredient_id && r.location === l.location);
    const plan = inventoryAfterPurchase(existing, l.quantity, l.unit, ctx.unitMap);
    if (plan.kind === "mismatch") { skipped.push(l.name); continue; }
    if (plan.kind === "update") {
      await setInventoryQuantity(plan.id, plan.quantity);
      existing!.quantity = plan.quantity;
    } else {
      const row = await insertInventoryRow({
        ingredient_id: l.ingredient_id, location: l.location, quantity: plan.quantity, unit: plan.unit,
        low_stock_threshold: null, expiration_date: null, purchased_date: date || null, notes: null,
      });
      inv.push(row);
    }
    added++;
  }

  // Estimated prices follow your latest purchase
  const byId = new Map(ctx.ingredients.map((i) => [i.id, i]));
  for (const l of lines) {
    const ing = l.ingredient_id ? byId.get(l.ingredient_id) : undefined;
    if (!ing || !l.quantity || !l.unit) continue;
    if (ctx.purchases.some((p) => p.ingredient_id === ing.id && p.purchase_date > date)) continue;
    let unit = ing.est_price_unit ?? ing.default_unit;
    let per = pricePer({ quantity: l.quantity, unit: l.unit, total_price: Number(l.total_price) }, unit, ctx.unitMap);
    if (per == null) { unit = l.unit; per = Number(l.total_price) / l.quantity; }
    await updateIngredient(ing.id, { est_price: Math.round(per * 10000) / 10000, est_price_unit: unit });
  }

  return { saved: lines.length, added, skipped };
}
