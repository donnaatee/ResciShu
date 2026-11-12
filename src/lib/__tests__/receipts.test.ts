import { describe, expect, it } from "vitest";
import { compareStores, defaultLocation, inventoryAfterPurchase, looksLikeDuplicate, matchIngredient, priceAt, pricePer, storePrices, type Purchase } from "../receipts";
import type { Unit } from "../units";

const U: Unit[] = [
  { code: "oz", label: "oz", dimension: "weight", to_base: 28.3495, system: "us" },
  { code: "lb", label: "lb", dimension: "weight", to_base: 453.592, system: "us" },
  { code: "cup", label: "cup", dimension: "volume", to_base: 236.588, system: "us" },
  { code: "piece", label: "piece", dimension: "count", to_base: 1, system: "us" },
];
const um = new Map(U.map((u) => [u.code, u]));
let n = 0;
const buy = (store: string, date: string, qty: number, unit: string, total: number, ingredient_id = "pot"): Purchase =>
  ({ id: `p${++n}`, receipt_id: `${store}-${date}`, store, purchase_date: date, created_at: `2026-11-11T00:00:0${n % 10}Z`, ingredient_id, product_name: "potatoes", quantity: qty, unit, total_price: total });

const ingredients = [
  { id: "pot", name: "potatoes" }, { id: "go", name: "green onion" }, { id: "ch", name: "chicken thighs" }, { id: "ched", name: "cheddar cheese" },
];

describe("matchIngredient", () => {
  it("uses the AI's suggestion when it's one of yours", () => expect(matchIngredient("RSST POTATO", "potatoes", ingredients)?.id).toBe("pot"));
  it("matches plural/singular words", () => expect(matchIngredient("green onions", "", ingredients)?.id).toBe("go"));
  it("russet potatoes -> potatoes", () => expect(matchIngredient("russet potatoes", "", ingredients)?.id).toBe("pot"));
  it("doesn't guess on a partial match", () => expect(matchIngredient("chicken breast", "", ingredients)).toBeNull());
});

describe("defaultLocation", () => {
  const chicken = { id: "ch", name: "chicken thighs", category: "meat", default_unit: "lb", est_price_unit: "lb" };
  it("goes where you already keep it", () => expect(defaultLocation(chicken, [{ id: "i", ingredient_id: "ch", location: "freezer", quantity: 1, unit: "lb" }])).toBe("freezer"));
  it("meat defaults to the fridge", () => expect(defaultLocation(chicken, [])).toBe("fridge"));
});

describe("inventoryAfterPurchase", () => {
  it("1 lb bought, 8 oz on hand -> 24 oz", () =>
    expect(inventoryAfterPurchase({ id: "i", ingredient_id: "pot", location: "pantry", quantity: 8, unit: "oz" }, 1, "lb", um)).toEqual({ kind: "update", id: "i", quantity: 24 }));
  it("new row when you have none there", () => expect(inventoryAfterPurchase(undefined, 1, "lb", um)).toEqual({ kind: "insert", quantity: 1, unit: "lb" }));
  it("flags units that can't be added", () =>
    expect(inventoryAfterPurchase({ id: "i", ingredient_id: "pot", location: "pantry", quantity: 3, unit: "piece" }, 1, "lb", um).kind).toBe("mismatch"));
});

describe("prices", () => {
  it("2 lb for $6 is $3 per lb", () => expect(pricePer({ quantity: 2, unit: "lb", total_price: 6 }, "lb", um)).toBe(3));
  it("per-lb price from an ounce purchase", () => expect(pricePer({ quantity: 32, unit: "oz", total_price: 6 }, "lb", um)).toBeCloseTo(3, 2));

  const history = [
    buy("Key Food", "2026-11-01", 2, "lb", 5),   // $2.50/lb
    buy("Key Food", "2026-11-08", 2, "lb", 6),   // $3.00/lb (latest at Key Food, +20%)
    buy("Trader Joe's", "2026-11-05", 3, "lb", 6), // $2.00/lb
  ];
  it("latest price anywhere", () => expect(priceAt("pot", 1.5, "lb", history, um)).toBe(4.5));
  it("latest price at one store", () => expect(priceAt("pot", 1.5, "lb", history, um, "Trader Joe's")).toBe(3));
  it("cheapest store and price change", () => {
    const rows = storePrices(history, "pot", "lb", um);
    expect(rows.map((r) => [r.store, r.per, r.cheapest])).toEqual([["Trader Joe's", 2, true], ["Key Food", 3, false]]);
    expect(rows[1]!.change).toBeCloseTo(0.2, 3);
  });
  it("compare a list across stores", () => {
    const out = compareStores([{ ingredient_id: "pot", quantity: 2, unit: "lb" }, { ingredient_id: "ch", quantity: 1, unit: "lb" }], history, um);
    expect(out.find((s) => s.store === "Trader Joe's")).toEqual({ store: "Trader Joe's", total: 4, priced: 1, missing: 1 });
  });
  it("spots a receipt you already saved", () => {
    expect(looksLikeDuplicate("key food", "2026-11-08", 6, history)).toBe(true);
    expect(looksLikeDuplicate("Key Food", "2026-11-08", 7.5, history)).toBe(false);
  });
});
