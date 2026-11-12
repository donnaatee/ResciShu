/** Finds cooking times in a recipe step, e.g. "bake for 20 mins" -> one 20-minute timer. */

export interface StepTimer { seconds: number; label: string }

const WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45, sixty: 60, ninety: 90,
};
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

// a number: 20, 1.5, 1½, 1 1/2, 1/2, ½, or a word like "an" / "ten"
const NUM = String.raw`(?:\d+(?:\.\d+)?(?:\s*[½¼¾⅓⅔]|\s+\d\/\d)?|\d\/\d|[½¼¾⅓⅔]|forty-five|${Object.keys(WORDS).filter((w) => w !== "forty-five").join("|")})`;
const UNIT = String.raw`(hours?|hrs?|minutes?|mins?|seconds?|secs?)`;
const PATTERN = new RegExp(
  String.raw`\b(half an hour)\b|\b(${NUM})\s*(?:(?:-|–|—|to)\s*(${NUM})\s*)?${UNIT}\b(?:\s*(?:and\s+)?(\d+)\s*(minutes?|mins?))?`,
  "gi",
);

function toNumber(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (s in WORDS) return WORDS[s]!;
  if (s in FRACTIONS) return FRACTIONS[s]!;
  const mixed = s.match(/^(\d+)\s+(\d)\/(\d)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d)\/(\d)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const uni = s.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔])$/);
  if (uni) return Number(uni[1]) + FRACTIONS[uni[2]!]!;
  return Number(s);
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("h")) return 3600;
  if (u.startsWith("m")) return 60;
  return 1;
}

/** "Simmer 10-12 minutes" -> [{ seconds: 600, label: "10–12 min" }] (timer starts at the shorter time). */
export function parseDurations(step: string): StepTimer[] {
  const out: StepTimer[] = [];
  for (const m of step.matchAll(PATTERN)) {
    if (m[1]) { out.push({ seconds: 1800, label: "30 min" }); continue; }
    const low = toNumber(m[2]!);
    const high = m[3] ? toNumber(m[3]) : null;
    const per = unitSeconds(m[4]!);
    const extra = m[5] ? Number(m[5]) * 60 : 0;
    const seconds = Math.round(low * per + extra);
    if (!seconds || seconds > 48 * 3600) continue;
    out.push({ seconds, label: high ? `${formatLabel(low * per)}–${formatLabel(high * per)}` : formatLabel(seconds) });
  }
  return out;
}

/** 4500 -> "1 hr 15 min", 30 -> "30 sec" */
export function formatLabel(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} sec`;
  const h = Math.floor(s / 3600), min = Math.round((s % 3600) / 60);
  if (!h) return `${min} min`;
  return min ? `${h} hr ${min} min` : `${h} hr`;
}

/** 1205 -> "20:05", 4500 -> "1:15:00" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
