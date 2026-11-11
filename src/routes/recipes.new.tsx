import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";

export const Route = createFileRoute("/recipes/new")({
  head: () => ({ meta: [
    { title: "New recipe — Kitchen Companion" },
    { name: "description", content: "Add a new recipe to your collection." },
    { property: "og:title", content: "New recipe — Kitchen Companion" },
    { property: "og:description", content: "Add a new recipe to your collection." },
  ] }),
  component: () => (<><PageHeader title="New recipe" /><RecipeForm /></>),
});
