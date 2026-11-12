import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Receipt, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteReceipt, ingredientsQuery, purchasesQuery, useInvalidate } from "@/lib/api";
import { useUnitMap } from "@/lib/hooks";
import { pricePer, priceUnit, storePrices } from "@/lib/receipts";
import { formatQty } from "@/lib/units";

export const Route = createFileRoute("/prices")({
  head: () => ({ meta: [
    { title: "Prices — Kitchen Companion" },
    { name: "description", content: "What you've paid for groceries, by store, over time." },
    { property: "og:title", content: "Prices — Kitchen Companion" },
    { property: "og:description", content: "What you've paid for groceries, by store, over time." },
  ] }),
  component: PricesPage,
});

const money = (n: number) => `$${n.toFixed(2)}`;
const perMoney = (n: number) => (n < 1 ? `$${n.toFixed(3).replace(/0$/, "")}` : money(n));
const shortDate = (d: string) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function PricesPage() {
  const { data: purchases = [], isLoading, error } = useQuery(purchasesQuery);
  const { data: ingredients = [] } = useQuery(ingredientsQuery);
  const { map } = useUnitMap();
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"items" | "receipts">("items");

  const tracked = useMemo(() => ingredients
    .filter((i) => purchases.some((p) => p.ingredient_id === i.id) && i.name.includes(q.trim().toLowerCase()))
    .map((i) => { const unit = priceUnit(i, purchases, i.id, map); return { ing: i, unit, rows: storePrices(purchases, i.id, unit, map) }; })
    .filter((t) => t.rows.length), [ingredients, purchases, q, map]);

  const receipts = useMemo(() => {
    const g = new Map<string, typeof purchases>();
    for (const p of purchases) g.set(p.receipt_id, [...(g.get(p.receipt_id) ?? []), p]);
    return [...g.values()].map((items) => ({ id: items[0]!.receipt_id, store: items[0]!.store, date: items[0]!.purchase_date, items, total: items.reduce((s, p) => s + Number(p.total_price), 0) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases]);

  async function removeReceipt(id: string) {
    if (!confirm("Delete this receipt's prices? Your inventory won't change.")) return;
    try { await deleteReceipt(id); await invalidate("purchases"); } catch (e) { toast.error((e as Error).message); }
  }

  const unitLabel = (u: string) => map.get(u)?.label ?? u;

  return (
    <>
      <PageHeader title="Prices" subtitle={`${receipts.length} receipts logged`} action={<Button asChild><Link to="/receipt"><Receipt />Scan receipt</Link></Button>} />
      {error && <p className="card-soft mb-4 p-4 text-sm text-destructive">Couldn't load prices: {(error as Error).message}. If this says the table doesn't exist, the purchase history table still needs to be added in Lovable.</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={tab === "items" ? "default" : "outline"} size="sm" onClick={() => setTab("items")}>By item</Button>
        <Button variant={tab === "receipts" ? "default" : "outline"} size="sm" onClick={() => setTab("receipts")}>Receipts</Button>
      </div>

      {tab === "items" ? (
        <>
          <div className="relative mb-4"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> : tracked.length === 0 ? (
            <div className="card-soft p-6 text-sm text-muted-foreground">No prices yet. <Link to="/receipt" className="text-primary underline">Scan a receipt</Link> after your next shop.</div>
          ) : (
            <ul className="grid gap-3">
              {tracked.map(({ ing, unit, rows }) => {
                const history = purchases.filter((p) => p.ingredient_id === ing.id);
                return (
                  <li key={ing.id} className="card-soft p-4">
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <h2 className="font-display text-lg font-bold capitalize">{ing.name}</h2>
                      <span className="text-xs text-muted-foreground">price per {unitLabel(unit)}</span>
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.map((r) => (
                        <li key={r.store} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                          <span className="flex-1 font-medium">{r.store}</span>
                          {r.cheapest && <Badge variant="success">Best price</Badge>}
                          {r.change != null && Math.abs(r.change) >= 0.005 && (
                            <Badge variant={r.change > 0 ? "danger" : "success"}>
                              {r.change > 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}{Math.round(Math.abs(r.change) * 100)}%
                            </Badge>
                          )}
                          <span className="w-20 text-right font-semibold tabular-nums">{perMoney(r.per)}</span>
                          <span className="w-24 text-right text-xs text-muted-foreground">{shortDate(r.latest.purchase_date)}</span>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="mt-1 flex items-center gap-1 text-xs text-primary" onClick={() => setOpen(open === ing.id ? null : ing.id)}>
                      {open === ing.id ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}{history.length} purchases
                    </button>
                    {open === ing.id && (
                      <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        {history.map((p) => { const per = pricePer(p, unit, map); return (
                          <li key={p.id} className="flex gap-2">
                            <span className="w-24">{shortDate(p.purchase_date)}</span><span className="flex-1">{p.store}</span>
                            <span>{formatQty(Number(p.quantity))} {p.unit ? unitLabel(p.unit) : ""} for {money(Number(p.total_price))}</span>
                            <span className="w-16 text-right">{per != null ? `${perMoney(per)}/${unitLabel(unit)}` : ""}</span>
                          </li>); })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : receipts.length === 0 ? (
        <div className="card-soft p-6 text-sm text-muted-foreground">No receipts yet.</div>
      ) : (
        <ul className="grid gap-3">
          {receipts.map((r) => (
            <li key={r.id} className="card-soft p-4">
              <div className="flex items-center gap-2">
                <button type="button" className="flex-1 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <div className="font-medium">{r.store}</div>
                  <div className="text-xs text-muted-foreground">{shortDate(r.date)} · {r.items.length} items</div>
                </button>
                <span className="font-semibold tabular-nums">{money(r.total)}</span>
                <Button size="icon" variant="ghost" aria-label="Delete receipt" onClick={() => removeReceipt(r.id)}><Trash2 /></Button>
              </div>
              {open === r.id && (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {r.items.map((p) => (
                    <li key={p.id} className="flex justify-between py-1.5">
                      <span className="capitalize">{p.product_name} <span className="text-xs text-muted-foreground">{p.quantity != null ? `· ${formatQty(Number(p.quantity))} ${p.unit ? unitLabel(p.unit) : ""}` : ""}</span></span>
                      <span className="tabular-nums">{money(Number(p.total_price))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
