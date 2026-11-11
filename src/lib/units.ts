export type Dimension = "weight" | "volume" | "count";
export interface Unit { code: string; label: string; dimension: string; to_base: number; system: string }

export function convert(qty: number, from: Unit, to: Unit): number | null {
  if (from.code === to.code) return qty;
  if (from.dimension !== to.dimension || from.dimension === "count") return null;
  return (qty * Number(from.to_base)) / Number(to.to_base);
}

const FRACTIONS: [number, string][] = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];

/** 1.333 -> "1⅓", 0.5 -> "½", 2.37 -> "2.37" */
export function formatQty(q: number | null | undefined): string {
  if (q == null || Number.isNaN(q)) return "";
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.02) {
      const w = v === 1 ? whole + 1 : whole;
      if (!s) return String(w);
      return w ? `${w}${s}` : s;
    }
  }
  return String(Math.round(q * 100) / 100);
}

/** Pick a nice display unit in the requested system for the same dimension. */
export function toSystem(qty: number, unit: Unit, units: Unit[], system: "us" | "metric"): { qty: number; unit: Unit } {
  if (unit.dimension === "count" || unit.system === system) return { qty, unit };
  const base = qty * Number(unit.to_base);
  const candidates = units.filter((u) => u.dimension === unit.dimension && u.system === system).sort((a, b) => Number(b.to_base) - Number(a.to_base));
  const pick = candidates.find((u) => base / Number(u.to_base) >= 1) ?? candidates[candidates.length - 1];
  if (!pick) return { qty, unit };
  return { qty: base / Number(pick.to_base), unit: pick };
}
