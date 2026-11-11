import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { CATEGORIES } from "@/components/RecipeForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inventoryQuery, recipesQuery } from "@/lib/api";
import { useUnitMap } from "@/lib/hooks";
import { availability } from "@/lib/kitchen";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recipes/")({
  head: () => ({ meta: [
    { title: "Recipes — Kitchen Companion" },
    { name: "description", content: "Your recipe collection, with what you can cook right now." },
    { property: "og:title", content: "Recipes — Kitchen Companion" },
    { property: "og:description", content: "Your recipe collection, with what you can cook right now." },
  ] }),
  component: RecipesPage,
});

function RecipesPage() {
  const { data: recipes = [], isLoading } = useQuery(recipesQuery);
  const { data: inv = [] } = useQuery(inventoryQuery);
  const { map } = useUnitMap();
  const [cat, setCat] = useState("all");
  const shown = recipes.filter((r) => cat === "all" || r.category === cat);
  const used = ["all", ...CATEGORIES.filter((c) => recipes.some((r) => r.category === c))];

  return (
    <>
      <PageHeader title="Recipes" subtitle={`${recipes.length} saved`} action={<Button asChild><Link to="/recipes/new"><Plus />New recipe</Link></Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {used.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-sm capitalize", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>{c}</button>
        ))}
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {shown.map((r) => {
            const statuses = r.recipe_ingredients.map((ri) => availability(ri, inv, map).status);
            const missing = statuses.filter((s) => s === "missing" || s === "short").length;
            return (
              <Link key={r.id} to="/recipes/$id" params={{ id: r.id }} className="card-soft overflow-hidden hover:border-primary/40 transition-colors">
                <RecipePhoto path={r.photo_path} className="aspect-[4/3] w-full" />
                <div className="p-3">
                  <div className="font-display text-lg font-bold leading-tight">{r.name}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3" />{(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} min</span>
                    {missing === 0 ? <Badge variant="success">Can cook</Badge> : <Badge variant="warning">Need {missing}</Badge>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
