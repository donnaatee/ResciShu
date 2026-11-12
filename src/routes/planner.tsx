import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, ShoppingBasket, Snowflake, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMeal, createGroceryList, deleteMeal, ingredientsQuery, inventoryQuery, mealPlansQuery, recipesQuery, useInvalidate } from "@/lib/api";
import { generateIntoList } from "@/lib/generate";
import { useUnitMap } from "@/lib/hooks";
import { daysUntil, todayStr } from "@/lib/kitchen";
import { shiftDate, thawReminders, recipesUsingSoon, weekStart } from "@/lib/planner";
import { formatQty } from "@/lib/units";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [
    { title: "Meal planner — Kitchen Companion" },
    { name: "description", content: "Plan breakfast, lunch and dinner for the week." },
    { property: "og:title", content: "Meal planner — Kitchen Companion" },
    { property: "og:description", content: "Plan breakfast, lunch and dinner for the week." },
  ] }),
  component: PlannerPage,
});

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const shortDate = (d: string) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const weekday = (d: string) => new Date(d + "T12:00").toLocaleDateString(undefined, { weekday: "long" });

function PlannerPage() {
  const today = todayStr();
  const [start, setStart] = useState(() => weekStart(today));
  const end = shiftDate(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));

  const { data: meals = [] } = useQuery(mealPlansQuery(start, end));
  const { data: recipes = [] } = useQuery(recipesQuery);
  const { data: inv = [] } = useQuery(inventoryQuery);
  const { data: ingredients = [] } = useQuery(ingredientsQuery);
  const { map } = useUnitMap();
  const invalidate = useInvalidate();
  const navigate = useNavigate();

  const [adding, setAdding] = useState<{ date: string; meal_type: MealType } | null>(null);
  const [pick, setPick] = useState<{ recipeId: string | null; servings: string }>({ recipeId: null, servings: "" });
  const [search, setSearch] = useState("");

  // Meals that need something taken out of the freezer the night before
  const needsThaw = useMemo(() => new Set(thawReminders(meals, recipes, inv, map).map((r) => r.meal.id)), [meals, recipes, inv, map]);
  // Recipes that use ingredients expiring within 5 days
  const useUp = useMemo(() => recipesUsingSoon(recipes, inv, today), [recipes, inv, today]);
  const expiringSoon = inv
    .filter((i) => i.expiration_date && Number(i.quantity) > 0 && daysUntil(i.expiration_date) >= 0 && daysUntil(i.expiration_date) <= 5)
    .sort((a, b) => a.expiration_date!.localeCompare(b.expiration_date!));

  const recipeName = (id: string) => recipes.find((r) => r.id === id)?.name ?? "Recipe";
  const choices = recipes
    .filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (useUp.get(b.id)?.length ?? 0) - (useUp.get(a.id)?.length ?? 0) || a.name.localeCompare(b.name));

  function openAdd(date: string, meal_type: MealType) {
    setAdding({ date, meal_type }); setPick({ recipeId: null, servings: "" }); setSearch("");
  }

  async function save() {
    const recipe = recipes.find((r) => r.id === pick.recipeId);
    if (!adding || !recipe) return void toast.error("Pick a recipe.");
    try {
      await addMeal({ plan_date: adding.date, meal_type: adding.meal_type, recipe_id: recipe.id, servings: Number(pick.servings) || Number(recipe.servings) });
      await invalidate("meal_plans"); setAdding(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: string) {
    try { await deleteMeal(id); await invalidate("meal_plans"); } catch (e) { toast.error((e as Error).message); }
  }

  async function groceryForWeek() {
    const picks = meals.flatMap((m) => { const recipe = recipes.find((r) => r.id === m.recipe_id); return recipe ? [{ recipe, servings: Number(m.servings) }] : []; });
    if (!picks.length) return void toast.error("Plan some meals for this week first.");
    try {
      const list = await createGroceryList(`Meals ${shortDate(start)} – ${shortDate(end)}`, "meal_plan");
      const n = await generateIntoList(list.id, picks, inv, ingredients, map);
      await invalidate("grocery_lists", "grocery_items");
      toast.success(n ? `${n} items to buy` : "You already have everything!");
      navigate({ to: "/grocery" });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader title="Meal planner" subtitle={`${shortDate(start)} – ${shortDate(end)} · ${meals.length} meals planned`}
        action={<Button variant="accent" onClick={groceryForWeek}><ShoppingBasket />Grocery list for this week</Button>} />

      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Previous week" onClick={() => setStart(shiftDate(start, -7))}><ChevronLeft /></Button>
        <Button variant="outline" disabled={start === weekStart(today)} onClick={() => setStart(weekStart(today))}>This week</Button>
        <Button size="icon" variant="outline" aria-label="Next week" onClick={() => setStart(shiftDate(start, 7))}><ChevronRight /></Button>
      </div>

      {expiringSoon.length > 0 && (
        <div className="card-soft mb-4 p-4 text-sm">
          <span className="font-semibold">Use soon: </span>
          <span className="capitalize">{expiringSoon.map((i) => { const d = daysUntil(i.expiration_date!); return `${i.ingredient?.name} (${d === 0 ? "today" : `${d}d`})`; }).join(", ")}</span>
          <span className="text-muted-foreground"> · recipes that use these are listed first when you add a meal.</span>
        </div>
      )}

      <div className="grid gap-3">
        {days.map((d) => (
          <section key={d} className={cn("card-soft p-4", d === today && "border-primary/50", d < today && "opacity-70")}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-display text-lg font-bold">{weekday(d)}</h2>
              <span className="text-sm text-muted-foreground">{shortDate(d)}</span>
              {d === today && <Badge>Today</Badge>}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {MEAL_TYPES.map((t) => {
                const slot = meals.filter((m) => m.plan_date === d && m.meal_type === t);
                return (
                  <div key={t} className="rounded-lg border border-border bg-background/60 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</span>
                      <Button size="icon" variant="ghost" className="size-7" aria-label={`Add ${t} on ${weekday(d)}`} onClick={() => openAdd(d, t)}><Plus /></Button>
                    </div>
                    {slot.length === 0 ? (
                      <button type="button" onClick={() => openAdd(d, t)} className="w-full py-1 text-left text-sm text-muted-foreground hover:text-foreground">Add a recipe</button>
                    ) : (
                      <ul className="grid gap-1">
                        {slot.map((m) => (
                          <li key={m.id} className="flex items-center gap-2 text-sm">
                            <Link to="/recipes/$id" params={{ id: m.recipe_id }} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{recipeName(m.recipe_id)}</Link>
                            {needsThaw.has(m.id) && <span title="Something needs thawing the night before"><Snowflake className="size-3.5 text-accent" /></span>}
                            <span className="text-xs text-muted-foreground tabular-nums">{formatQty(Number(m.servings))} srv</span>
                            <Button size="icon" variant="ghost" className="size-7" aria-label="Remove meal" onClick={() => remove(m.id)}><Trash2 /></Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{adding ? `${adding.meal_type} · ${weekday(adding.date)} ${shortDate(adding.date)}` : ""}</DialogTitle>
          </DialogHeader>
          <Input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ul className="max-h-72 divide-y divide-border overflow-auto">
            {choices.length === 0 && <li className="py-4 text-sm text-muted-foreground">No recipes found. <Link to="/recipes/new" className="text-primary underline">Add one</Link></li>}
            {choices.map((r) => {
              const uses = useUp.get(r.id);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setPick({ recipeId: r.id, servings: String(r.servings) })}
                    className={cn("flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted", pick.recipeId === r.id && "bg-muted font-semibold")}>
                    <span className="flex-1">{r.name}</span>
                    {uses && <Badge variant="accent" className="capitalize"><Sparkles className="mr-1 size-3" />Uses {uses.join(", ")}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
            <Label htmlFor="servings">Servings</Label>
            <Input id="servings" className="w-24" type="number" min="1" step="any" value={pick.servings} onChange={(e) => setPick({ ...pick, servings: e.target.value })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button><Button onClick={save}>Add meal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
