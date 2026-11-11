import { describe, expect, it } from "vitest";
import { availability, buildGroceryList, scale, daysUntil, type IngredientInfo } from "../kitchen";
import { convert, formatQty, type Unit } from "../units";

const U: Unit[] = [
  { code: "g", label: "g", dimension: "weight", to_base: 1, system: "metric" },
  { code: "oz", label: "oz", dimension: "weight", to_base: 28.3495, system: "us" },
  { code: "lb", label: "lb", dimension: "weight", to_base: 453.592, system: "us" },
  { code: "cup", label: "cup", dimension: "volume", to_base: 236.588, system: "us" },
  { code: "piece", label: "piece", dimension: "count", to_base: 1, system: "us" },
];
const um = new Map(U.map((u) => [u.code, u]));
const potatoes: IngredientInfo = { id: "p", name: "potatoes", default_unit: "lb", est_price: 3, est_price_unit: "lb", is_staple: false };
const ings = new Map([["p", potatoes]]);

describe("scale", () => {
  it("1 cup for 2 servings becomes 2 cups for 4", () => expect(scale(1, 2, 4)).toBe(2));
  it("shows 1.333 as 1⅓", () => expect(formatQty(4 / 3)).toBe("1⅓"));
});

describe("convert", () => {
  it("1 lb is 16 oz", () => expect(convert(1, um.get("lb")!, um.get("oz")!)).toBeCloseTo(16, 2));
  it("cups to lb cannot convert", () => expect(convert(2, um.get("cup")!, um.get("lb")!)).toBeNull());
});

describe("availability", () => {
  it("8 oz cheese needed, 1 lb on hand -> available", () =>
    expect(availability({ ingredient_id: "c", quantity: 8, unit: "oz" }, [{ ingredient_id: "c", quantity: 1, unit: "lb", location: "fridge" }], um).status).toBe("available"));
  it("short by 0.5 lb", () => {
    const a = availability({ ingredient_id: "p", quantity: 1, unit: "lb" }, [{ ingredient_id: "p", quantity: 0.5, unit: "lb", location: "pantry" }], um);
    expect(a).toEqual({ status: "short", need: 0.5, unit: "lb" });
  });
  it("missing when none", () => expect(availability({ ingredient_id: "p", quantity: 1, unit: "lb" }, [], um).status).toBe("missing"));
  it("check when units differ", () =>
    expect(availability({ ingredient_id: "f", quantity: 2, unit: "cup" }, [{ ingredient_id: "f", quantity: 5, unit: "lb", location: "pantry" }], um).status).toBe("check"));
});

describe("buildGroceryList", () => {
  it("2 recipes × 1 lb potatoes, have 0.5 lb -> 1.5 lb at $4.50", () => {
    const r = { servings: 4, wanted: 4, items: [{ ingredient_id: "p", quantity: 1, unit: "lb" }] };
    const out = buildGroceryList([r, r], [{ ingredient_id: "p", quantity: 0.5, unit: "lb", location: "pantry" }], ings, um);
    expect(out).toHaveLength(1);
    expect(out[0]!.quantity).toBe(1.5);
    expect(out[0]!.estimated_price).toBe(4.5);
  });
  it("fully stocked items excluded", () => {
    const r = { servings: 4, wanted: 4, items: [{ ingredient_id: "p", quantity: 1, unit: "lb" }] };
    expect(buildGroceryList([r], [{ ingredient_id: "p", quantity: 32, unit: "oz", location: "pantry" }], ings, um)).toHaveLength(0);
  });
});

describe("dates", () => {
  it("counts days by local date", () => expect(daysUntil("2026-11-14", "2026-11-11")).toBe(3));
});
