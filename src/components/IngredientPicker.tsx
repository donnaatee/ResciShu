import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createIngredient, ingredientsQuery, useInvalidate, type Ingredient } from "@/lib/api";
import { cn } from "@/lib/utils";

export function IngredientPicker({ value, onChange, placeholder = "Pick ingredient…" }: { value: string | null; onChange: (ing: Ingredient) => void; placeholder?: string }) {
  const { data: all = [] } = useQuery(ingredientsQuery);
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const matches = useMemo(() => all.filter((i) => i.name.includes(term)).slice(0, 30), [all, term]);
  const exact = all.some((i) => i.name === term);
  const selected = all.find((i) => i.id === value);

  async function create() {
    try {
      const ing = await createIngredient(term, "piece");
      await invalidate("ingredients");
      onChange(ing); setOpen(false); setQ("");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-start font-normal capitalize", !selected && "text-muted-foreground")}>
          {selected?.name ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input autoFocus placeholder="Search, e.g. green on…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-2 max-h-64 overflow-auto">
          {matches.map((i) => (
            <button type="button" key={i.id} onClick={() => { onChange(i); setOpen(false); setQ(""); }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm capitalize hover:bg-muted">
              {i.name}<span className="flex items-center gap-2 text-xs text-muted-foreground normal-case">{i.category}{i.id === value && <Check className="size-3.5" />}</span>
            </button>
          ))}
          {term && !exact && (
            <button type="button" onClick={create} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-muted">
              <Plus className="size-4" /> Create “{term}”
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
