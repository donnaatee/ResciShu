import { describe, expect, it } from "vitest";
import { planThawMove, shiftDate, thawReminders, recipesUsingSoon, weekStart, type PlannerRecipe, type StockRow } from "../planner";
import type { Unit } from "../units";

const U: Unit[] = [
  { code: "oz", label: "oz", dimension: "weight", to_base: 28.3495, system: "us" },
  { code: "lb", label: "lb", dimension: "weight", to_base: 453.592, system: "us" },
  { code: "cup", label: "cup", dimension: "volume", to_base: 236.588, system: "us" },
];
const um = new Map(U.map((u) => [u.code, u]));
const chicken = { name: "chicken thighs", category: "meat" };
const peas = { name: "frozen peas", category: "frozen" };

const recipe: PlannerRecipe = {
  id: "r1", name: "Lemon chicken", servings: 4,
  recipe_ingredients: [{ ingredient_id: "c", quantity: 1, unit: "lb" }, { ingredient_id: "p", quantity: 1, unit: "cup" }],
};
const dinner = { id: "m1", plan_date: "2026-11-19", meal_type: "dinner", recipe_id: "r1", servings: 4 };
const frozenChicken: StockRow = { id: "i1", ingredient_id: "c", quantity: 2, unit: "lb", location: "freezer", ingredient: chicken };
const frozenPeas: StockRow = { id: "i2", ingredient_id: "p", quantity: 2, unit: "cup", location: "freezer", ingredient: peas };

describe("dates", () => {
  it("shifts across a month end", () => expect(shiftDate("2026-11-30", 1)).toBe("2026-12-01"));
  it("week starts Monday (Thu Nov 19 -> Mon Nov 16)", () => expect(weekStart("2026-11-19")).toBe("2026-11-16"));
  it("Sunday belongs to the week before", () => expect(weekStart("2026-11-22")).toBe("2026-11-16"));
});

describe("thawReminders", () => {
  it("chicken only in freezer -> remind the night before", () => {
    const r = thawReminders([dinner], [recipe], [frozenChicken, frozenPeas], um);
    expect(r).toHaveLength(1); // peas are 'frozen' category: no reminder
    expect(r[0]!.ingredient_name).toBe("chicken thighs");
    expect(r[0]!.remind_on).toBe("2026-11-18");
    expect(r[0]!.amount).toBe(1);
  });
  it("scales with servings (8 servings -> 2 lb)", () => {
    expect(thawReminders([{ ...dinner, servings: 8 }], [recipe], [frozenChicken], um)[0]!.amount).toBe(2);
  });
  it("no reminder when the fridge already has enough", () => {
    const fridge: StockRow = { id: "i3", ingredient_id: "c", quantity: 16, unit: "oz", location: "fridge", ingredient: chicken };
    expect(thawReminders([dinner], [recipe], [frozenChicken, fridge], um)).toHaveLength(0);
  });
  it("only the shortfall when the fridge has some (8 oz in fridge -> take out 0.5 lb)", () => {
    const fridge: StockRow = { id: "i3", ingredient_id: "c", quantity: 8, unit: "oz", location: "fridge", ingredient: chicken };
    expect(thawReminders([dinner], [recipe], [frozenChicken, fridge], um)[0]!.amount).toBe(0.5);
  });
});

describe("planThawMove", () => {
  it("creates a fridge row when there isn't one", () => {
    expect(planThawMove(frozenChicken, undefined, 1, um)).toEqual({ freezerQty: 1, fridge: { id: undefined, quantity: 1, unit: "lb" } });
  });
  it("adds to an existing fridge row in its own unit", () => {
    const fridge: StockRow = { id: "i3", ingredient_id: "c", quantity: 4, unit: "oz", location: "fridge" };
    expect(planThawMove(frozenChicken, fridge, 0.5, um)).toEqual({ freezerQty: 1.5, fridge: { id: "i3", quantity: 12, unit: "oz" } });
  });
  it("unknown amount moves the whole freezer row", () => {
    expect(planThawMove(frozenChicken, undefined, null, um).freezerQty).toBe(0);
  });
});

describe("recipesUsingSoon", () => {
  it("finds recipes using ingredients expiring within 5 days", () => {
    const inv = [{ ...frozenChicken, location: "fridge", expiration_date: "2026-11-13" }, { ...frozenPeas, expiration_date: "2027-01-01" }];
    expect(recipesUsingSoon([recipe], inv, "2026-11-11").get("r1")).toEqual(["chicken thighs"]);
  });
});
