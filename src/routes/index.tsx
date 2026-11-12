import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChefHat, Clock, Refrigerator, ShoppingBasket } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ThawReminders } from "@/components/ThawReminders";
import { Badge } from "@/components/ui/badge";
import { groceryListsQuery, inventoryQuery, mealPlansQuery, recipesQuery } from "@/lib/api";
import { daysUntil, todayStr } from "@/lib/kitchen";
import { formatQty } from "@/lib/units";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard — Kitchen Companion" },
    { name: "description", content: "What's in your kitchen, what's running low, and what's expiring soon." },
    { property: "og:title", content: "Dashboard — Kitchen Companion" },
    { property: "og:description", content: "What's in your kitchen, what's running low, and what's expiring soon." },
  ] }),
  component: Dashboard,
});

function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return todayStr(d); }

function Dashboard() {
  const { data: inv = [] } = useQuery(inventoryQuery);
  const { data: recipes = [] } = useQuery(recipesQuery);
  const { data: lists = [] } = useQuery(groceryListsQuery);
  const { data: meals = [] } = useQuery(mealPlansQuery(todayStr(), addDays(6)));
  const low = inv.filter((i) => i.low_stock_threshold != null && Number(i.quantity) <= Number(i.low_stock_threshold));
  const expiring = inv.filter((i) => i.expiration_date && Number(i.quantity) > 0 && daysUntil(i.expiration_date) <= 5)
    .sort((a, b) => a.expiration_date!.localeCompare(b.expiration_date!));
  const active = lists.find((l) => l.status === "active");
  const recipeName = (id: string) => recipes.find((r) => r.id === id)?.name ?? "Recipe";

  const stats = [
    { label: "Items in stock", value: inv.filter((i) => Number(i.quantity) > 0).length, icon: Refrigerator, to: "/inventory" as const },
    { label: "Recipes", value: recipes.length, icon: ChefHat, to: "/recipes" as const },
    { label: "Meals this week", value: meals.length, icon: CalendarDays, to: "/planner" as const },
  ];

  return (
    <>
      <PageHeader title="Good cooking." subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card-soft p-4 hover:border-primary/40 transition-colors">
            <s.icon className="size-5 text-primary" />
            <div className="mt-3 font-display text-3xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ThawReminders inventory={inv} recipes={recipes} meals={meals} />
        <section className="card-soft p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="size-4 text-accent" />Low stock</h2>
          {low.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Everything's well stocked.</p> : (
            <ul className="mt-3 divide-y divide-border">
              {low.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="capitalize">{i.ingredient?.name} <span className="text-muted-foreground">· {i.location}</span></span>
                  {Number(i.quantity) === 0 ? <Badge variant="danger">Out</Badge> : <Badge variant="warning">{formatQty(Number(i.quantity))} {i.unit}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card-soft p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-4 text-accent" />Expiring soon</h2>
          {expiring.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nothing expiring in the next 5 days.</p> : (
            <ul className="mt-3 divide-y divide-border">
              {expiring.map((i) => { const d = daysUntil(i.expiration_date!); return (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="capitalize">{i.ingredient?.name} <span className="text-muted-foreground">· {i.location}</span></span>
                  <Badge variant={d <= 1 ? "danger" : "warning"}>{d < 0 ? "Expired" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d} days`}</Badge>
                </li>); })}
            </ul>
          )}
        </section>
        <section className="card-soft p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-4 text-accent" />Upcoming meals</h2>
          {meals.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No meals planned. <Link to="/planner" className="text-primary underline">Plan your week</Link></p> : (
            <ul className="mt-3 divide-y divide-border">
              {meals.slice(0, 6).map((m) => (
                <li key={m.id} className="flex justify-between py-2 text-sm">
                  <Link to="/recipes/$id" params={{ id: m.recipe_id }} className="hover:text-primary">{recipeName(m.recipe_id)}</Link>
                  <span className="text-muted-foreground capitalize">{new Date(m.plan_date + "T12:00").toLocaleDateString(undefined, { weekday: "short" })} · {m.meal_type}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Link to="/grocery" className="card-soft bg-warm p-5 flex flex-col justify-between hover:border-primary/40">
          <ShoppingBasket className="size-6 text-accent" />
          <div className="mt-6">
            <h2 className="text-lg font-bold">Grocery list</h2>
            <p className="text-sm text-muted-foreground">{active ? `Continue “${active.name}”` : "Build a list from your recipes"} →</p>
          </div>
        </Link>
      </div>
    </>
  );
}
