import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Archive, Plus, Receipt, Scale, Sparkles, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { UnitSelect } from "@/components/UnitSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addGroceryItem, createGroceryList, deleteGroceryItem, deleteGroceryList, groceryItemsQuery, groceryListsQuery,
  ingredientsQuery, inventoryQuery, purchasesQuery, recipesQuery, updateGroceryItem, updateGroceryList, useInvalidate, type GroceryItem,
} from "@/lib/api";
import { generateIntoList } from "@/lib/generate";
import { useUnitMap } from "@/lib/hooks";
import { compareStores, priceAt } from "@/lib/receipts";
import { formatQty } from "@/lib/units";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/grocery")({
  head: () => ({ meta: [
    { title: "Grocery list — Kitchen Companion" },
    { name: "description", content: "Shopping lists built from your recipes, minus what you already have." },
    { property: "og:title", content: "Grocery list — Kitchen Companion" },
    { property: "og:description", content: "Shopping lists built from your recipes, minus what you already have." },
  ] }),
  component: GroceryPage,
});

const money = (n: number) => `$${n.toFixed(2)}`;

function GroceryPage() {
  const { data: lists = [] } = useQuery(groceryListsQuery);
  const { data: recipes = [] } = useQuery(recipesQuery);
  const { data: inv = [] } = useQuery(inventoryQuery);
  const { data: ingredients = [] } = useQuery(ingredientsQuery);
  const { data: purchases = [] } = useQuery(purchasesQuery);
  const { map } = useUnitMap();
  const invalidate = useInvalidate();
  const [listId, setListId] = useState<string | null>(null);
  const active = lists.filter((l) => l.status === "active");
  useEffect(() => { if (!listId && active[0]) setListId(active[0].id); }, [active, listId]);
  const list = lists.find((l) => l.id === listId);
  const { data: items = [] } = useQuery({ ...groceryItemsQuery(listId ?? ""), enabled: !!listId });
  const [gen, setGen] = useState<Record<string, number> | null>(null);
  const [manual, setManual] = useState({ name: "", quantity: "", unit: null as string | null, price: "" });

  // "Price at": use your latest receipt price at one store; otherwise the list's usual estimate
  const [priceStore, setPriceStore] = useState("__usual");
  const [comparing, setComparing] = useState(false);
  const stores = [...new Set(purchases.map((p) => p.store))].sort();
  const storePrice = (i: GroceryItem) => priceStore !== "__usual" && i.ingredient_id && i.quantity && i.unit
    ? priceAt(i.ingredient_id, Number(i.quantity), i.unit, purchases, map, priceStore) : null;
  const itemPrice = (i: GroceryItem) => storePrice(i) ?? (i.estimated_price != null ? Number(i.estimated_price) : null);
  const total = items.reduce((s, i) => s + (itemPrice(i) ?? 0), 0);
  const remaining = items.filter((i) => !i.is_purchased).reduce((s, i) => s + (itemPrice(i) ?? 0), 0);
  const toBuy = items.filter((i) => !i.is_purchased);
  const comparison = comparing ? compareStores(toBuy, purchases, map) : [];

  async function newList() {
    const l = await createGroceryList(`Week of ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, "manual");
    await invalidate("grocery_lists"); setListId(l.id); return l.id;
  }

  async function runGenerate() {
    const picks = Object.entries(gen ?? {}).filter(([, s]) => s > 0).map(([id, servings]) => ({ recipe: recipes.find((r) => r.id === id)!, servings }));
    if (!picks.length) return void toast.error("Pick at least one recipe.");
    try {
      const id = listId ?? (await newList());
      const n = await generateIntoList(id, picks, inv, ingredients, map);
      await updateGroceryList(id, { source: "recipes" });
      await invalidate("grocery_items", "grocery_lists"); setGen(null);
      toast.success(n ? `${n} items to buy` : "You already have everything!");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.name.trim()) return;
    const id = listId ?? (await newList());
    const match = ingredients.find((i) => i.name === manual.name.trim().toLowerCase());
    await addGroceryItem({ grocery_list_id: id, ingredient_id: match?.id ?? null, custom_name: match ? null : manual.name.trim(),
      quantity: manual.quantity ? Number(manual.quantity) : null, unit: manual.unit, estimated_price: manual.price ? Number(manual.price) : null });
    setManual({ name: "", quantity: "", unit: null, price: "" }); invalidate("grocery_items");
  }

  const sorted = [...items].sort((a, b) => Number(a.is_purchased) - Number(b.is_purchased) || (a.ingredient?.category ?? "zz").localeCompare(b.ingredient?.category ?? "zz"));

  return (
    <>
      <PageHeader title="Grocery list" subtitle={list ? `${items.filter((i) => !i.is_purchased).length} left · ${money(remaining)} of ${money(total)}` : "Build a list from your recipes"}
        action={<div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/receipt"><Receipt />Scan receipt</Link></Button><Button variant="outline" onClick={newList}><Plus />New list</Button><Button variant="accent" onClick={() => setGen({})}><Sparkles />From recipes</Button></div>} />

      {active.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Select value={listId ?? ""} onValueChange={setListId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Choose list" /></SelectTrigger>
            <SelectContent>{active.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          {list && <Button variant="ghost" size="sm" onClick={async () => { await updateGroceryList(list.id, { status: "archived" }); setListId(null); invalidate("grocery_lists"); }}><Archive />Archive</Button>}
          {list && <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete this list?")) { await deleteGroceryList(list.id); setListId(null); invalidate("grocery_lists"); } }}><Trash2 />Delete</Button>}
        </div>
      )}

      {list && stores.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Store className="size-4 text-muted-foreground" />
          <Select value={priceStore} onValueChange={setPriceStore}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__usual">Price at: usual estimate</SelectItem>
              {stores.map((s) => <SelectItem key={s} value={s}>Price at: {s}</SelectItem>)}
            </SelectContent>
          </Select>
          {stores.length > 1 && <Button variant="ghost" size="sm" onClick={() => setComparing(!comparing)}><Scale />{comparing ? "Hide comparison" : "Compare stores"}</Button>}
          <Link to="/prices" className="text-sm text-primary underline">Price history</Link>
        </div>
      )}
      {comparing && (
        <div className="card-soft mb-4 p-4">
          <h2 className="mb-2 font-bold">Items left to buy, by store</h2>
          <ul className="divide-y divide-border text-sm">
            {comparison.map((c, n) => (
              <li key={c.store} className="flex items-center justify-between py-2">
                <span className="font-medium">{c.store}{n === 0 && c.priced > 0 && comparison.length > 1 ? " ⭐" : ""}</span>
                <span className="text-right">
                  <b className="tabular-nums">${c.total.toFixed(2)}</b>
                  <span className="block text-xs text-muted-foreground">{c.priced} priced{c.missing ? ` · ${c.missing} with no price there yet` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Based on the latest price you paid at each store. Stores are ranked by how many items they have prices for, then by total.</p>
        </div>
      )}

      <form onSubmit={addManual} className="card-soft mb-4 grid grid-cols-[1fr_70px_100px] gap-2 p-3 sm:grid-cols-[1fr_80px_120px_90px_auto]">
        <Input placeholder="Add item (e.g. paper towels)" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
        <Input type="number" step="any" placeholder="Qty" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} />
        <UnitSelect allowNone value={manual.unit} onChange={(u) => setManual({ ...manual, unit: u })} />
        <Input type="number" step="0.01" placeholder="$" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} />
        <Button type="submit" className="col-span-3 sm:col-span-1"><Plus />Add</Button>
      </form>

      <div className="card-soft px-4">
        {!list || items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No items yet. Generate from recipes or add your own.</p> : (
          <ul className="divide-y divide-border">
            {sorted.map((i) => (
              <li key={i.id} className={cn("flex items-center gap-3 py-3", i.is_purchased && "opacity-50")}>
                <Checkbox checked={i.is_purchased} onCheckedChange={async (c) => { await updateGroceryItem(i.id, { is_purchased: !!c }); invalidate("grocery_items"); }} />
                <div className="min-w-0 flex-1">
                  <div className={cn("capitalize font-medium", i.is_purchased && "line-through")}>{i.ingredient?.name ?? i.custom_name}</div>
                  <div className="text-xs text-muted-foreground">{i.ingredient?.category ?? "other"}{i.added_manually ? " · added by you" : ""}{i.ingredient && i.custom_name ? ` · ${i.custom_name}` : ""}</div>
                </div>
                <Input className="w-20 text-right" type="number" step="any" defaultValue={i.quantity ?? ""} onBlur={async (e) => { await updateGroceryItem(i.id, { quantity: e.target.value === "" ? null : Number(e.target.value) }); invalidate("grocery_items"); }} />
                <span className="w-12 text-sm text-muted-foreground">{i.unit ? map.get(i.unit)?.label : ""}</span>
                <span className="w-16 text-right text-sm font-semibold tabular-nums" title={priceStore !== "__usual" && storePrice(i) == null ? `No price from ${priceStore} yet: usual estimate shown` : undefined}>
                  {itemPrice(i) != null ? money(itemPrice(i)!) : "—"}{priceStore !== "__usual" && storePrice(i) == null && itemPrice(i) != null ? <span className="text-xs font-normal text-muted-foreground">*</span> : null}
                </span>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={async () => { await deleteGroceryItem(i.id); invalidate("grocery_items"); }}><Trash2 /></Button>
              </li>
            ))}
            <li className="flex justify-between py-3 font-display text-lg font-bold"><span>Estimated total{priceStore !== "__usual" ? ` at ${priceStore}` : ""}</span><span>{money(total)}</span></li>
            {priceStore !== "__usual" && items.some((i) => storePrice(i) == null) && <li className="pb-3 text-xs text-muted-foreground">* No price from {priceStore} yet, so the usual estimate is used.</li>}
          </ul>
        )}
      </div>

      <Dialog open={!!gen} onOpenChange={(o) => !o && setGen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Build from recipes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Pick recipes and servings. Items you already have are subtracted; your own added items stay.</p>
          <ul className="max-h-80 divide-y divide-border overflow-auto">
            {recipes.map((r) => { const v = gen?.[r.id] ?? 0; return (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <Checkbox checked={v > 0} onCheckedChange={(c) => setGen({ ...gen, [r.id]: c ? Number(r.servings) : 0 })} />
                <span className="flex-1 text-sm">{r.name}</span>
                <Input className="w-20" type="number" min="0" value={v || ""} placeholder="servings" onChange={(e) => setGen({ ...gen, [r.id]: Number(e.target.value) })} />
              </li>); })}
          </ul>
          <DialogFooter><Button variant="outline" onClick={() => setGen(null)}>Cancel</Button><Button onClick={runGenerate}>Generate list</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
