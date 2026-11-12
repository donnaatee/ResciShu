import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ImageUp, Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { IngredientPicker } from "@/components/IngredientPicker";
import { UnitSelect } from "@/components/UnitSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ingredientsQuery, inventoryQuery, photoToBase64, purchasesQuery, useInvalidate } from "@/lib/api";
import { useUnitMap } from "@/lib/hooks";
import { todayStr } from "@/lib/kitchen";
import { scanReceipt } from "@/lib/receipt-scan";
import { defaultLocation, looksLikeDuplicate, matchIngredient, type ReceiptLine } from "@/lib/receipts";
import { saveReceipt } from "@/lib/save-receipt";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/receipt")({
  head: () => ({ meta: [
    { title: "Scan receipt — Kitchen Companion" },
    { name: "description", content: "Log grocery prices and add what you bought to your inventory." },
    { property: "og:title", content: "Scan receipt — Kitchen Companion" },
    { property: "og:description", content: "Log grocery prices and add what you bought to your inventory." },
  ] }),
  component: ReceiptPage,
});

const money = (n: number) => `$${n.toFixed(2)}`;
type Stage = "pick" | "reading" | "review" | "done";

function ReceiptPage() {
  const { data: ingredients = [] } = useQuery(ingredientsQuery);
  const { data: inventory = [] } = useQuery(inventoryQuery);
  const { data: purchases = [] } = useQuery(purchasesQuery);
  const { map } = useUnitMap();
  const invalidate = useInvalidate();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayStr());
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; added: number; skipped: string[] } | null>(null);

  const stores = useMemo(() => [...new Set(purchases.map((p) => p.store))].sort(), [purchases]);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const included = lines.filter((l) => l.include);
  const linesTotal = included.reduce((s, l) => s + (Number(l.total_price) || 0), 0);
  const duplicate = store && date ? looksLikeDuplicate(store, date, linesTotal, purchases) : false;

  const setLine = (key: string, patch: Partial<ReceiptLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function onPhoto(file?: File) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStage("reading");
    try {
      const photo = await photoToBase64(file);
      const scan = await scanReceipt({ data: { image: photo.data, mimeType: photo.mimeType, ingredients: ingredients.map((i) => i.name), stores } });
      setStore(scan.store);
      setDate(scan.date || todayStr());
      setReceiptTotal(scan.total);
      setLines(scan.items.map((it, n) => {
        const ing = it.is_food ? matchIngredient(it.name, it.ingredient, ingredients) : null;
        return {
          key: `l${n}`, include: true, receipt_text: it.receipt_text, name: it.name,
          ingredient_id: ing?.id ?? null, quantity: it.quantity ?? 1, unit: it.unit ?? ing?.default_unit ?? "piece",
          total_price: it.total_price, location: defaultLocation(ing ?? undefined, inventory), add_to_inventory: it.is_food && !!ing,
        };
      }));
      if (!scan.items.length) toast.error("No items found on that photo. You can add them by hand below.");
      setStage("review");
    } catch (e) {
      toast.error((e as Error).message);
      setStage("pick");
    }
  }

  function addLine() {
    setLines((ls) => [...ls, { key: `m${Date.now()}`, include: true, receipt_text: "", name: "", ingredient_id: null, quantity: 1, unit: "piece", total_price: null, location: "pantry", add_to_inventory: false }]);
  }

  async function confirm() {
    if (!store.trim()) return void toast.error("Add the store name.");
    if (!date) return void toast.error("Add the purchase date.");
    if (included.some((l) => l.total_price == null)) return void toast.error("Every included line needs a price (or uncheck it).");
    setSaving(true);
    try {
      const r = await saveReceipt({ store, date, lines }, { inventory, ingredients, purchases, unitMap: map });
      await invalidate("purchases", "inventory", "ingredients");
      setResult(r); setStage("done");
    } catch (e) { toast.error((e as Error).message); }
    setSaving(false);
  }

  function reset() {
    setStage("pick"); setPreview(null); setLines([]); setStore(""); setDate(todayStr()); setReceiptTotal(null); setResult(null);
  }

  const fileInputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={library} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (stage === "pick" || stage === "reading") return (
    <>
      <PageHeader title="Scan a receipt" subtitle="Log what you paid and add it to your inventory." action={<Button variant="outline" asChild><Link to="/prices"><Receipt />Prices</Link></Button>} />
      {fileInputs}
      <div className="card-soft grid gap-4 p-6 text-center">
        {stage === "reading" ? (
          <>
            {preview && <img src={preview} alt="Your receipt" className="mx-auto max-h-72 rounded-lg object-contain" />}
            <p className="flex items-center justify-center gap-2 font-medium"><Loader2 className="size-5 animate-spin" />Reading your receipt…</p>
            <p className="text-sm text-muted-foreground">This usually takes 5–15 seconds.</p>
          </>
        ) : (
          <>
            <Receipt className="mx-auto size-12 text-accent" />
            <div className="grid gap-2 sm:mx-auto sm:w-80">
              <Button size="lg" className="h-12" onClick={() => camera.current?.click()}><Camera />Take a photo</Button>
              <Button size="lg" variant="outline" className="h-12" onClick={() => library.current?.click()}><ImageUp />Choose a photo</Button>
            </div>
            <ul className="mx-auto max-w-sm text-left text-sm text-muted-foreground list-disc pl-5">
              <li>Lay the receipt flat in good light.</li>
              <li>Fit the whole receipt in the photo. For a long one, photograph the item section.</li>
              <li>You'll check every line before anything is saved.</li>
            </ul>
          </>
        )}
      </div>
    </>
  );

  if (stage === "done" && result) return (
    <>
      <PageHeader title="Receipt saved" subtitle={`${store} · ${date}`} />
      <div className="card-soft grid gap-3 p-6">
        <p><b>{result.saved}</b> prices logged.</p>
        <p><b>{result.added}</b> items added to your inventory.</p>
        {result.skipped.length > 0 && (
          <p className="text-sm text-muted-foreground">Not added to inventory because the units don't match what you already have: <span className="capitalize">{result.skipped.join(", ")}</span>. Update those on the Inventory page.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={reset}><Camera />Scan another</Button>
          <Button variant="outline" asChild><Link to="/prices">See prices</Link></Button>
          <Button variant="outline" asChild><Link to="/inventory">See inventory</Link></Button>
        </div>
      </div>
    </>
  );

  // Review
  // Items usually add up to a bit less than the receipt total because of tax
  const over = receiptTotal != null && linesTotal > receiptTotal + 0.05;
  const gap = receiptTotal != null ? receiptTotal - linesTotal : 0;
  return (
    <>
      <PageHeader title="Check your receipt" subtitle="Fix anything that's off, then save." />
      <div className="card-soft mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
        <div>
          <Label htmlFor="store">Store</Label>
          <Input id="store" list="known-stores" value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Key Food" />
          <datalist id="known-stores">{stores.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {duplicate && <p className="flex items-center gap-2 text-sm text-destructive sm:col-span-2"><AlertTriangle className="size-4" />Looks like you already saved this receipt (same store, date and total).</p>}
      </div>

      <ul className="grid gap-3">
        {lines.map((l) => {
          const ing = l.ingredient_id ? byId.get(l.ingredient_id) : undefined;
          return (
            <li key={l.key} className={cn("card-soft grid gap-2 p-3", !l.include && "opacity-50")}>
              <div className="flex items-center gap-2">
                <Checkbox checked={l.include} aria-label="Include this line" onCheckedChange={(c) => setLine(l.key, { include: !!c })} />
                <Input className="flex-1 capitalize" value={l.name} placeholder="Item name" onChange={(e) => setLine(l.key, { name: e.target.value })} />
                <div className="relative w-24">
                  <span className="absolute left-2 top-2 text-sm text-muted-foreground">$</span>
                  <Input className="pl-5 text-right" type="number" step="0.01" min="0" aria-label="Price paid" value={l.total_price ?? ""}
                    onChange={(e) => setLine(l.key, { total_price: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              </div>
              {l.receipt_text && <p className="text-xs text-muted-foreground">On receipt: {l.receipt_text}</p>}
              {l.include && (
                <>
                  <div className="grid grid-cols-[1fr_80px_110px] gap-2">
                    <IngredientPicker value={l.ingredient_id} placeholder="Link to ingredient…"
                      onChange={(i) => setLine(l.key, { ingredient_id: i.id, add_to_inventory: true, location: defaultLocation(i, inventory) })} />
                    <Input type="number" step="any" min="0" aria-label="Amount bought" value={l.quantity ?? ""} onChange={(e) => setLine(l.key, { quantity: e.target.value === "" ? null : Number(e.target.value) })} />
                    <UnitSelect value={l.unit} onChange={(u) => setLine(l.key, { unit: u })} />
                  </div>
                  {ing ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-2"><Switch checked={l.add_to_inventory} onCheckedChange={(v) => setLine(l.key, { add_to_inventory: v })} />Add to inventory</label>
                      {l.add_to_inventory && (
                        <Select value={l.location} onValueChange={(v) => setLine(l.key, { location: v as ReceiptLine["location"] })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="pantry">Pantry</SelectItem><SelectItem value="fridge">Fridge</SelectItem><SelectItem value="freezer">Freezer</SelectItem></SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not linked to an ingredient: the price is logged, but inventory isn't updated.</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="mt-3" onClick={addLine}><Plus />Add a line</Button>

      <div className="sticky bottom-20 mt-4 card-soft flex flex-wrap items-center gap-3 p-4 md:bottom-4">
        <div className="flex-1 text-sm">
          <div><b>{included.length}</b> items · <b>{money(linesTotal)}</b></div>
          {receiptTotal != null && (
            <div className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
              Receipt total {money(receiptTotal)}{over ? " · items add up to more than the receipt: check the prices" : gap > 0.05 ? ` · ${money(gap)} difference is usually tax or a missed line` : ""}
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={reset}><Trash2 />Discard</Button>
        <Button disabled={saving || !included.length} onClick={confirm}>{saving ? <Loader2 className="animate-spin" /> : null}Save receipt</Button>
      </div>
    </>
  );
}
