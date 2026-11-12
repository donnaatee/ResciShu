import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Snowflake, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setInventoryQuantity, upsertInventory, useInvalidate, type InventoryItem, type MealPlan, type Recipe } from "@/lib/api";
import { useUnitMap } from "@/lib/hooks";
import { daysUntil } from "@/lib/kitchen";
import { planThawMove, thawReminders, type ThawReminder } from "@/lib/planner";
import { formatQty } from "@/lib/units";

// Dismissed reminders are remembered on this device only.
const STORAGE_KEY = "kitchen.thaw-dismissed";
function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
function saveDismissed(s: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...s].slice(-200))); } catch { /* storage unavailable: ignore */ }
}

const dayName = (date: string) => new Date(date + "T12:00").toLocaleDateString(undefined, { weekday: "short" });

export function ThawReminders({ inventory, recipes, meals }: { inventory: InventoryItem[]; recipes: Recipe[]; meals: MealPlan[] }) {
  const { map } = useUnitMap();
  const invalidate = useInvalidate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setDismissed(loadDismissed()), []); // localStorage only exists in the browser

  const all = useMemo(() => thawReminders(meals, recipes, inventory, map).filter((r) => !dismissed.has(r.key)), [meals, recipes, inventory, map, dismissed]);
  const due = all.filter((r) => daysUntil(r.remind_on) <= 0 && daysUntil(r.meal.plan_date) >= 0);
  const upcoming = all.filter((r) => daysUntil(r.remind_on) > 0).slice(0, 3);

  function dismiss(key: string) {
    const next = new Set(dismissed).add(key);
    setDismissed(next); saveDismissed(next);
  }

  async function movedToFridge(r: ThawReminder) {
    setBusy(r.key);
    try {
      const fridge = inventory.find((i) => i.ingredient_id === r.ingredient_id && i.location === "fridge");
      const plan = planThawMove(r.freezer_row, fridge, r.amount, map);
      await setInventoryQuantity(r.freezer_row.id, plan.freezerQty);
      if (plan.fridge?.id) await setInventoryQuantity(plan.fridge.id, plan.fridge.quantity);
      else if (plan.fridge) await upsertInventory({
        ingredient_id: r.ingredient_id, location: "fridge", quantity: plan.fridge.quantity, unit: plan.fridge.unit,
        low_stock_threshold: null, expiration_date: r.meal.plan_date, purchased_date: null, notes: "Thawed",
      });
      await invalidate("inventory");
      toast.success(`Moved ${r.ingredient_name} to the fridge`);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }

  const amountText = (r: ThawReminder) => (r.amount == null ? "" : ` (${formatQty(r.amount)} ${map.get(r.freezer_row.unit)?.label ?? r.freezer_row.unit})`);

  return (
    <section className="card-soft p-5 md:col-span-2">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Snowflake className="size-4 text-accent" />Reminders</h2>
      {due.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing to thaw tonight.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {due.map((r) => {
            const late = daysUntil(r.meal.plan_date) === 0;
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Badge variant={late ? "danger" : "accent"}>{late ? "Today" : "Tonight"}</Badge>
                <div className="min-w-0 flex-1">
                  <div>
                    {late ? "Still frozen: " : "Take the "}<b className="capitalize">{r.ingredient_name}</b>{late ? "" : " out of the freezer to thaw"}{amountText(r)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    For <Link to="/recipes/$id" params={{ id: r.meal.recipe_id }} className="hover:text-primary">{r.recipe_name}</Link> · {dayName(r.meal.plan_date)} {r.meal.meal_type}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={busy === r.key} onClick={() => movedToFridge(r)}><Check />Moved to fridge</Button>
                <Button size="icon" variant="ghost" aria-label="Dismiss reminder" onClick={() => dismiss(r.key)}><X /></Button>
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > 0 && (
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="font-semibold">Coming up: </span>
          {upcoming.map((r) => `${dayName(r.remind_on)} night: ${r.ingredient_name} for ${r.recipe_name}`).join(" · ")}
        </div>
      )}
    </section>
  );
}
