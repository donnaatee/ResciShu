import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { IngredientPicker } from "@/components/IngredientPicker";
import { UnitSelect } from "@/components/UnitSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteInventory, inventoryQuery, upsertInventory, useInvalidate, type InventoryItem } from "@/lib/api";
import { useUnitMap } from "@/lib/hooks";
import { daysUntil } from "@/lib/kitchen";
import { convert, formatQty } from "@/lib/units";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [
    { title: "Inventory — Kitchen Companion" },
    { name: "description", content: "Everything in your pantry, fridge and freezer." },
    { property: "og:title", content: "Inventory — Kitchen Companion" },
    { property: "og:description", content: "Everything in your pantry, fridge and freezer." },
  ] }),
  component: InventoryPage,
});

type View = "all" | "pantry" | "fridge" | "freezer" | "ingredient";
type Draft = { id?: string; ingredient_id: string | null; name?: string; location: InventoryItem["location"]; quantity: string; unit: string | null; low_stock_threshold: string; expiration_date: string; notes: string };
const emptyDraft: Draft = { ingredient_id: null, location: "pantry", quantity: "", unit: null, low_stock_threshold: "", expiration_date: "", notes: "" };

function StatusBadges({ i }: { i: InventoryItem }) {
  const q = Number(i.quantity);
  const d = i.expiration_date ? daysUntil(i.expiration_date) : null;
  return (
    <div className="flex flex-wrap gap-1">
      {q === 0 ? <Badge variant="danger">Out</Badge> : i.low_stock_threshold != null && q <= Number(i.low_stock_threshold) && <Badge variant="warning">Low</Badge>}
      {d != null && q > 0 && d <= 5 && <Badge variant={d <= 1 ? "danger" : "accent"}>{d < 0 ? "Expired" : d === 0 ? "Expires today" : `${d}d left`}</Badge>}
    </div>
  );
}

function InventoryPage() {
  const { data: inv = [], isLoading } = useQuery(inventoryQuery);
  const { map } = useUnitMap();
  const invalidate = useInvalidate();
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"expiry" | "name">("expiry");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dupe, setDupe] = useState<InventoryItem | null>(null);

  const filtered = useMemo(() => {
    let rows = inv.filter((i) => (i.ingredient?.name ?? "").includes(q.trim().toLowerCase()));
    if (view === "pantry" || view === "fridge" || view === "freezer") rows = rows.filter((i) => i.location === view);
    return rows.sort((a, b) => sort === "name" ? (a.ingredient?.name ?? "").localeCompare(b.ingredient?.name ?? "")
      : (a.expiration_date ?? "9999").localeCompare(b.expiration_date ?? "9999") || (a.ingredient?.name ?? "").localeCompare(b.ingredient?.name ?? ""));
  }, [inv, q, view, sort]);

  const grouped = useMemo(() => {
    const g = new Map<string, InventoryItem[]>();
    for (const r of filtered) g.set(r.ingredient_id, [...(g.get(r.ingredient_id) ?? []), r]);
    return [...g.values()].sort((a, b) => (a[0].ingredient?.name ?? "").localeCompare(b[0].ingredient?.name ?? ""));
  }, [filtered]);

  function total(rows: InventoryItem[]) {
    const target = map.get(rows[0].ingredient?.default_unit ?? rows[0].unit) ?? map.get(rows[0].unit);
    let sum = 0;
    for (const r of rows) { const u = map.get(r.unit); const c = u && target ? convert(Number(r.quantity), u, target) : null; if (c == null) return null; sum += c; }
    return `${formatQty(sum)} ${target?.label ?? ""}`;
  }

  async function save(d: Draft, force = false) {
    if (!d.ingredient_id || !d.unit || d.quantity === "") return toast.error("Pick an ingredient, quantity and unit.");
    const existing = inv.find((i) => i.ingredient_id === d.ingredient_id && i.location === d.location && i.id !== d.id);
    if (existing && !force) { setDupe(existing); return; }
    try {
      await upsertInventory({
        id: force && existing ? existing.id : d.id, ingredient_id: d.ingredient_id, location: d.location, unit: d.unit,
        quantity: Number(d.quantity), low_stock_threshold: d.low_stock_threshold === "" ? null : Number(d.low_stock_threshold),
        expiration_date: d.expiration_date || null, purchased_date: null, notes: d.notes || null,
      });
      if (force && existing && d.id) await deleteInventory(d.id);
      await invalidate("inventory"); setDraft(null); setDupe(null); toast.success("Saved");
    } catch (e) { toast.error((e as Error).message); }
  }

  function edit(i: InventoryItem) {
    setDraft({ id: i.id, ingredient_id: i.ingredient_id, location: i.location, quantity: String(i.quantity), unit: i.unit,
      low_stock_threshold: i.low_stock_threshold == null ? "" : String(i.low_stock_threshold), expiration_date: i.expiration_date ?? "", notes: i.notes ?? "" });
  }

  const row = (i: InventoryItem, showLoc = true) => (
    <li key={i.id} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium capitalize">{i.ingredient?.name}</div>
        <div className="text-xs text-muted-foreground">{showLoc && <span className="capitalize">{i.location} · </span>}{i.expiration_date ? `exp ${i.expiration_date}` : "no expiry"}{i.notes ? ` · ${i.notes}` : ""}</div>
      </div>
      <StatusBadges i={i} />
      <div className="w-20 text-right text-sm font-semibold tabular-nums">{formatQty(Number(i.quantity))} {map.get(i.unit)?.label}</div>
      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => edit(i)}><Pencil /></Button>
      <Button size="icon" variant="ghost" aria-label="Delete" onClick={async () => { if (confirm("Delete this item?")) { await deleteInventory(i.id); invalidate("inventory"); } }}><Trash2 /></Button>
    </li>
  );

  return (
    <>
      <PageHeader title="Inventory" subtitle={`${inv.filter((i) => Number(i.quantity) > 0).length} items in stock`}
        action={<Button onClick={() => setDraft({ ...emptyDraft, location: view === "fridge" || view === "freezer" ? view : "pantry" })}><Plus />Add item</Button>} />
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pantry">In pantry</TabsTrigger>
          <TabsTrigger value="fridge">In fridge</TabsTrigger>
          <TabsTrigger value="freezer">In freezer</TabsTrigger>
          <TabsTrigger value="ingredient">By ingredient</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={sort} onValueChange={(v) => setSort(v as "expiry" | "name")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="expiry">Sort: expiry</SelectItem><SelectItem value="name">Sort: name</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="card-soft mt-4 px-4">
        {isLoading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : filtered.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nothing here yet.</p> :
          view === "ingredient" ? (
            <ul className="divide-y divide-border">
              {grouped.map((rows) => (
                <li key={rows[0].ingredient_id} className="py-3">
                  <div className="flex items-center justify-between"><span className="font-display text-lg font-bold capitalize">{rows[0].ingredient?.name}</span><span className="text-sm font-semibold">{total(rows) ?? "Mixed units"} total</span></div>
                  <ul className="divide-y divide-border pl-3">{rows.map((r) => row(r))}</ul>
                </li>
              ))}
            </ul>
          ) : <ul className="divide-y divide-border">{filtered.map((i) => row(i, view === "all"))}</ul>}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit item" : "Add to inventory"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <div><Label>Ingredient</Label><IngredientPicker value={draft.ingredient_id} onChange={(ing) => setDraft({ ...draft, ingredient_id: ing.id, unit: draft.unit ?? ing.default_unit })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Quantity</Label><Input type="number" step="any" min="0" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></div>
                <div><Label>Unit</Label><UnitSelect value={draft.unit} onChange={(u) => setDraft({ ...draft, unit: u })} /></div>
                <div><Label>Location</Label>
                  <Select value={draft.location} onValueChange={(v) => setDraft({ ...draft, location: v as Draft["location"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pantry">Pantry</SelectItem><SelectItem value="fridge">Fridge</SelectItem><SelectItem value="freezer">Freezer</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Low-stock alert at</Label><Input type="number" step="any" min="0" value={draft.low_stock_threshold} onChange={(e) => setDraft({ ...draft, low_stock_threshold: e.target.value })} /></div>
                <div><Label>Expires</Label><Input type="date" value={draft.expiration_date} onChange={(e) => setDraft({ ...draft, expiration_date: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => draft && save(draft)}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupe} onOpenChange={(o) => !o && setDupe(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Already in your {dupe?.location}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You have <b className="capitalize">{dupe?.ingredient?.name}</b> ({formatQty(Number(dupe?.quantity))} {dupe?.unit}) there. Update that item's quantity to your new amount?</p>
          <DialogFooter><Button variant="outline" onClick={() => setDupe(null)}>Cancel</Button><Button onClick={() => draft && save(draft, true)}>Update quantity</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
