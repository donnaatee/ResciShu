import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";
import { recipesQuery } from "@/lib/api";

export const Route = createFileRoute("/recipes/$id_/edit")({
  head: () => ({ meta: [
    { title: "Edit recipe — Kitchen Companion" },
    { name: "description", content: "Edit a recipe's ingredients, steps and photo." },
    { property: "og:title", content: "Edit recipe — Kitchen Companion" },
    { property: "og:description", content: "Edit a recipe's ingredients, steps and photo." },
  ] }),
  component: EditRecipe,
});

function EditRecipe() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(recipesQuery);
  const recipe = data?.find((r) => r.id === id);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!recipe) return <p>Recipe not found.</p>;
  return (<><PageHeader title={`Edit ${recipe.name}`} /><RecipeForm recipe={recipe} /></>);
}
