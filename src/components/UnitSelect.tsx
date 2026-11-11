import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { unitsQuery } from "@/lib/api";

export function UnitSelect({ value, onChange, allowNone }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  const { data: units = [] } = useQuery(unitsQuery);
  const dims = ["weight", "volume", "count"];
  return (
    <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder="Unit" /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none">— (to taste)</SelectItem>}
        {dims.map((d) => (
          <SelectGroup key={d}>
            <SelectLabel className="capitalize">{d}</SelectLabel>
            {units.filter((u) => u.dimension === d).map((u) => <SelectItem key={u.code} value={u.code}>{u.label}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
