import { createServerFn } from "@tanstack/react-start";

/**
 * Reads a receipt photo with Lovable's built-in AI (Lovable AI gateway).
 * This runs on the server, so the project's LOVABLE_API_KEY is never sent to the browser.
 * Each scan uses a little of the workspace's monthly AI allowance.
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

const SHAPE = `{"store": string, "date": string, "total": number | null, "items": [{"receipt_text": string, "name": string, "quantity": number | null, "unit": ${UNITS.map((u) => `"${u}"`).join(" | ")} | null, "total_price": number | null, "ingredient": string, "is_food": boolean}]}`;

/** Models to try, in order. Set LOVABLE_AI_MODEL to pick a different one. */
const MODELS = ["google/gemini-3-flash-preview", "google/gemini-3.7-flash", "google/gemini-2.5-flash"];

function prompt(ingredients: string[], stores: string[]) {
  return `You read photos of grocery receipts. Reply with only one JSON object shaped like this:\n${SHAPE}

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
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Receipt scanning isn't set up yet. Turn on Lovable AI for this project in Lovable.");
    const chosen = process.env["LOVABLE_AI_MODEL"];
    const models = chosen ? [chosen, ...MODELS.filter((m) => m !== chosen)] : MODELS;

    let text = "";
    for (const model of models) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: [
            { type: "text", text: prompt(data.ingredients, data.stores) },
            { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.image}` } },
          ] }],
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } | string; choices?: { message?: { content?: string } }[] }
        | null;
      const message = typeof body?.error === "string" ? body.error : body?.error?.message ?? res.statusText;
      if (res.ok) { text = body?.choices?.[0]?.message?.content ?? ""; break; }
      if (res.status === 402) throw new Error("This month's free Lovable AI allowance is used up. Scanning works again when it resets, or add credits in Lovable.");
      if (res.status === 429) throw new Error("Too many scans at once. Wait a minute and try again.");
      if ((res.status === 400 || res.status === 404) && /model/i.test(message) && model !== models[models.length - 1]) continue; // try the next model
      throw new Error(`Couldn't read the receipt: ${message}`);
    }
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
