import { createServerFn } from "@tanstack/react-start";

/**
 * Reads a receipt photo with Google Gemini.
 * This runs on the server, so your GEMINI_API_KEY is never sent to the browser.
 */

export interface ScannedItem {
  receipt_text: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  total_price: number | null;
  ingredient: string;   // the matching name from your ingredient list, or ""
  is_food: boolean;
}
export interface ScannedReceipt { store: string; date: string; total: number | null; items: ScannedItem[] }

interface ScanInput { image: string; mimeType: string; ingredients: string[]; stores: string[] }

const UNITS = ["lb", "oz", "g", "kg", "cup", "fl_oz", "ml", "l", "piece", "can", "bunch"];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    store: { type: "STRING" },
    date: { type: "STRING" },
    total: { type: "NUMBER", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          receipt_text: { type: "STRING" },
          name: { type: "STRING" },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", enum: UNITS, nullable: true },
          total_price: { type: "NUMBER", nullable: true },
          ingredient: { type: "STRING" },
          is_food: { type: "BOOLEAN" },
        },
        required: ["receipt_text", "name", "quantity", "unit", "total_price", "ingredient", "is_food"],
      },
    },
  },
  required: ["store", "date", "total", "items"],
};

function prompt(ingredients: string[], stores: string[]) {
  return `You read photos of grocery receipts. Return one JSON object.

store: the store's everyday name (e.g. "Key Food", not "KEY FOOD #1234 BROOKLYN NY"). If it is one of these stores I've used before, spell it exactly the same: ${JSON.stringify(stores)}.
date: purchase date as YYYY-MM-DD, or "" if you can't read it.
total: the receipt's final total paid, or null.

items: one entry per product bought. Skip subtotal, tax, total, payment, change, loyalty and coupon summary lines.
- receipt_text: the line as printed.
- name: a short, readable, lowercase product name ("russet potatoes", not "RSST POTATO").
- quantity and unit: how much was bought. unit must be one of ${UNITS.join(", ")}.
  Use the weight when it's printed (e.g. "1.23 lb @ $2.99/lb" -> 1.23 lb). "2 @ 1.99" -> 2 piece.
  A size on the package counts (e.g. "2 x 16 oz" -> 32 oz). Convert: 1 gallon = 16 cup, 1 quart = 4 cup, 1 pint = 2 cup, 1 dozen = 12 piece.
  If unsure, use 1 piece.
- total_price: what was paid for that line after any discount printed directly under it. Number only.
- ingredient: if the product is clearly the same food as one in this list, copy that name exactly; otherwise "". List: ${JSON.stringify(ingredients)}
- is_food: false for non-food (paper towels, soap, bags, bottle deposits).`;
}

export const scanReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: ScanInput) => {
    if (typeof d?.image !== "string" || !d.image) throw new Error("No photo was sent.");
    if (d.image.length > 8_000_000) throw new Error("That photo is too large. Try again with a smaller photo.");
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(d.mimeType)) throw new Error("Please use a JPEG, PNG or WebP photo.");
    return { image: d.image, mimeType: d.mimeType, ingredients: (d.ingredients ?? []).slice(0, 500), stores: (d.stores ?? []).slice(0, 50) };
  })
  .handler(async ({ data }): Promise<ScannedReceipt> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) throw new Error("Receipt scanning isn't set up yet. Add your GEMINI_API_KEY in Lovable → Secrets.");
    const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: data.mimeType, data: data.image } }, { text: prompt(data.ingredients, data.stores) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string; status?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] }
      | null;
    if (!res.ok) {
      if (res.status === 429) throw new Error("Gemini's free limit was reached. Wait a minute and try again.");
      throw new Error(`Gemini couldn't read the receipt: ${body?.error?.message ?? res.statusText}`);
    }
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: Partial<ScannedReceipt>;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<ScannedReceipt>; }
    catch { throw new Error("Couldn't read that receipt. Try a sharper, flatter photo."); }

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      store: typeof parsed.store === "string" ? parsed.store.trim() : "",
      date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : "",
      total: num(parsed.total),
      items: (Array.isArray(parsed.items) ? parsed.items : []).map((it) => ({
        receipt_text: String(it?.receipt_text ?? ""),
        name: String(it?.name ?? it?.receipt_text ?? "").trim().toLowerCase(),
        quantity: num(it?.quantity),
        unit: typeof it?.unit === "string" && UNITS.includes(it.unit) ? it.unit : null,
        total_price: num(it?.total_price),
        ingredient: String(it?.ingredient ?? "").trim().toLowerCase(),
        is_food: it?.is_food !== false,
      })),
    };
  });
