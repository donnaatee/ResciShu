import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChefHat, Clock, Minus, Pencil, Plus, Timer, Trash2, Users } from "lucide-react";
import { CookMode, unlockSpeech } from "@/components/CookMode";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deleteRecipe, inventoryQuery, recipesQuery, useInvalidate } from "@/lib/api";
import { useUnitMap } from "@/lib/hooks";
import { availability, scale } from "@/lib/kitchen";
import { parseDurations } from "@/lib/timers";
import { formatQty, toSystem } from "@/lib/units";

export const Route = createFileRoute("/recipes/$id")({
  head: () => ({ meta: [
    { title: "Recipe — Kitchen Companion" },
    { name: "description", content: "Ingredients, steps and what you have on hand." },
    { property: "og:title", content: "Recipe — Kitchen Companion" },
    { property: "og:description", content: "Ingredients, steps and what you have on hand." },
  ] }),
  component: RecipeDetail,
});

function RecipeDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(recipesQuery);
  const { data: inv = [] } = useQuery(inventoryQuery);
  const { map, units } = useUnitMap();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const recipe = data?.find((r) => r.id === id);
  const [servings, setServings] = useState<number | null>(null);
  const [metric, setMetric] = useState(false);
  const [cooking, setCooking] = useState(false);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!recipe) return <p>Recipe not found. <Link to="/recipes" className="text-primary underline">Back to recipes</Link></p>;
  const s = servings ?? Number(recipe.servings);
  const items = [...recipe.recipe_ingredients].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <article>
      <Link to="/recipes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Recipes</Link>
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <RecipePhoto path={recipe.photo_path} className="aspect-[4/3] w-full rounded-xl" />
        <div>
          <Badge variant="secondary" className="capitalize">{recipe.category}</Badge>
          <h1 className="mt-2 text-4xl font-bold">{recipe.name}</h1>
          {recipe.description && <p className="mt-2 text-muted-foreground">{recipe.description}</p>}
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-4" />Prep {recipe.prep_minutes ?? 0}m · Cook {recipe.cook_minutes ?? 0}m</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1">
              <Button size="icon" variant="ghost" className="rounded-full" aria-label="Fewer servings" onClick={() => setServings(Math.max(1, s - 1))}><Minus /></Button>
              <span className="flex items-center gap-1 px-1 text-sm font-semibold"><Users className="size-4" />{s} servings</span>
              <Button size="icon" variant="ghost" className="rounded-full" aria-label="More servings" onClick={() => setServings(s + 1)}><Plus /></Button>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={metric} onCheckedChange={setMetric} />Metric</label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" asChild><Link to="/recipes/$id/edit" params={{ id }}><Pencil />Edit</Link></Button>
            <Button variant="ghost" onClick={async () => { if (confirm("Delete this recipe?")) { await deleteRecipe(id); await invalidate("recipes"); navigate({ to: "/recipes" }); } }}><Trash2 />Delete</Button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <section className="card-soft p-5">
          <h2 className="mb-3 text-xl font-bold">Ingredients</h2>
          <ul className="divide-y divide-border">
            {items.map((ri, i) => {
              const q = ri.quantity == null ? null : scale(Number(ri.quantity), Number(recipe.servings), s);
              const u = ri.unit ? map.get(ri.unit) : undefined;
              const shown = q != null && u ? toSystem(q, u, units, metric ? "metric" : "us") : null;
              const a = availability({ ingredient_id: ri.ingredient_id, quantity: q, unit: ri.unit }, inv, map);
              return (
                <li key={ri.id ?? i} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span><b className="tabular-nums">{shown ? `${formatQty(shown.qty)} ${shown.unit.label}` : ""}</b> <span className="capitalize">{ri.ingredient?.name}</span>{ri.prep_note && <span className="text-muted-foreground">, {ri.prep_note}</span>}</span>
                  {a.status === "available" && <Badge variant="success">Have</Badge>}
                  {a.status === "missing" && <Badge variant="danger">Missing</Badge>}
                  {a.status === "check" && <Badge variant="outline">Check — units differ</Badge>}
                  {a.status === "short" && <Badge variant="warning">Short {formatQty(a.need)} {map.get(a.unit)?.label}</Badge>}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card-soft p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Steps</h2>
            {recipe.instructions.length > 0 && (
              <Button variant="accent" onClick={() => { unlockSpeech(); setCooking(true); }}><ChefHat />Start cooking</Button>
            )}
          </div>
          <ol className="grid gap-4">
            {recipe.instructions.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                <div className="pt-0.5">
                  <p>{st}</p>
                  {parseDurations(st).map((t, k) => (
                    <span key={k} className="mt-1 mr-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"><Timer className="size-3" />{t.label}</span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {cooking && <CookMode recipeName={recipe.name} steps={recipe.instructions} onClose={() => setCooking(false)} />}
    </article>
  );
}
