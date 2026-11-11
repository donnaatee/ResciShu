import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { IngredientPicker } from "@/components/IngredientPicker";
import { RecipePhoto } from "@/components/RecipePhoto";
import { UnitSelect } from "@/components/UnitSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRecipe, uploadPhoto, useInvalidate, type Recipe, type RecipeIngredient } from "@/lib/api";

export const CATEGORIES = ["breakfast", "lunch", "dinner", "side", "dessert", "snack", "baking"];

export function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [f, setF] = useState({
    name: recipe?.name ?? "", description: recipe?.description ?? "", photo_path: recipe?.photo_path ?? null,
    prep_minutes: recipe?.prep_minutes?.toString() ?? "", cook_minutes: recipe?.cook_minutes?.toString() ?? "",
    servings: recipe?.servings?.toString() ?? "4", category: recipe?.category ?? "dinner",
  });
  const [items, setItems] = useState<RecipeIngredient[]>(
    [...(recipe?.recipe_ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order));
  const [steps, setSteps] = useState<string[]>(recipe?.instructions?.length ? recipe.instructions : [""]);
  const [busy, setBusy] = useState(false);

  const setItem = (i: number, p: Partial<RecipeIngredient>) => setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)));

  async function onPhoto(file?: File) {
    if (!file) return;
    setBusy(true);
    try { setF({ ...f, photo_path: await uploadPhoto(file) }); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Give the recipe a name.");
    if (items.some((i) => !i.ingredient_id)) return toast.error("Pick an ingredient for every row.");
    setBusy(true);
    try {
      const id = await saveRecipe({
        id: recipe?.id, name: f.name.trim(), description: f.description || null, photo_path: f.photo_path,
        prep_minutes: f.prep_minutes ? Number(f.prep_minutes) : null, cook_minutes: f.cook_minutes ? Number(f.cook_minutes) : null,
        servings: Number(f.servings) || 1, category: f.category, instructions: steps.map((s) => s.trim()).filter(Boolean),
      }, items);
      await invalidate("recipes");
      toast.success("Recipe saved");
      navigate({ to: "/recipes/$id", params: { id } });
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="card-soft grid gap-4 p-5 md:grid-cols-[220px_1fr]">
        <label className="group relative block cursor-pointer overflow-hidden rounded-lg">
          <RecipePhoto path={f.photo_path} className="aspect-square w-full rounded-lg" />
          <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-md bg-card/90 py-1.5 text-xs font-medium"><Upload className="size-3.5" />{busy ? "Uploading…" : "Upload photo"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><Label>Servings</Label><Input type="number" min="1" value={f.servings} onChange={(e) => setF({ ...f, servings: e.target.value })} /></div>
            <div><Label>Prep (min)</Label><Input type="number" min="0" value={f.prep_minutes} onChange={(e) => setF({ ...f, prep_minutes: e.target.value })} /></div>
            <div><Label>Cook (min)</Label><Input type="number" min="0" value={f.cook_minutes} onChange={(e) => setF({ ...f, cook_minutes: e.target.value })} /></div>
            <div><Label>Category</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm capitalize" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
        </div>
      </div>

      <section className="card-soft p-5">
        <h2 className="mb-3 text-xl font-bold">Ingredients</h2>
        <div className="grid gap-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px] gap-2 sm:grid-cols-[1.4fr_80px_120px_1fr_auto]">
              <IngredientPicker value={it.ingredient_id || null} onChange={(ing) => setItem(i, { ingredient_id: ing.id, unit: it.unit ?? ing.default_unit })} />
              <Input type="number" step="any" min="0" placeholder="Qty" value={it.quantity ?? ""} onChange={(e) => setItem(i, { quantity: e.target.value === "" ? null : Number(e.target.value) })} />
              <UnitSelect allowNone value={it.unit} onChange={(u) => setItem(i, { unit: u })} />
              <Input placeholder="Prep note (e.g. diced)" className="col-span-2 sm:col-span-1" value={it.prep_note ?? ""} onChange={(e) => setItem(i, { prep_note: e.target.value || null })} />
              <Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="mt-3" onClick={() => setItems([...items, { ingredient_id: "", quantity: null, unit: null, prep_note: null, sort_order: items.length }])}><Plus />Add ingredient</Button>
      </section>

      <section className="card-soft p-5">
        <h2 className="mb-3 text-xl font-bold">Steps</h2>
        <ol className="grid gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">{i + 1}</span>
              <Textarea rows={2} value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} />
              <div className="flex flex-col">
                <Button type="button" size="icon" variant="ghost" aria-label="Up" disabled={i === 0} onClick={() => { const n = [...steps]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setSteps(n); }}><ArrowUp /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Down" disabled={i === steps.length - 1} onClick={() => { const n = [...steps]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setSteps(n); }}><ArrowDown /></Button>
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 /></Button>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" className="mt-3" onClick={() => setSteps([...steps, ""])}><Plus />Add step</Button>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" disabled={busy}>Save recipe</Button>
      </div>
    </form>
  );
}
