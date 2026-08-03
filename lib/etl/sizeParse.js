// ─── Shared size/name parsing helpers ─────────────────────────────────────────
// Extracted from the old Unit Price Watch section so the SAME size-parsing
// logic used there can now serve as a hard matching gate in buildProducts.js's
// cross-source product linking (a size mismatch must never cause two different
// pack sizes to be treated as "the same product" — see buildProducts.js).

export function r2(x) {
  return Math.round(x * 100) / 100;
}

export function titleCase(s) {
  return (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gram|grams|mg|l|lt|ltr|liter|litre|ml|cl|cc|pcs|pc)\b/;
const UNIT_STRIP_RE = /\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gram|grams|mg|l|lt|ltr|liter|litre|ml|cl|cc|pcs|pc|pack)\b/g;
const PACK_STRIP_RE = /\bx\s*\d+\b|\b\d+\s*x\b/g;

// Parse a product's pack size out of its name. Returns null when no size can
// be safely determined — callers must never guess a size, since a wrong guess
// here is exactly the class of bug ("comparing different units as if the same")
// this project has repeatedly needed to fix.
export function parseSize(name) {
  const s = (name || "").toLowerCase();
  // A size inside a range (e.g. "4-9 kg" on a diaper pack = the BABY's weight,
  // not the product's) is ambiguous — never treat it as the product size.
  if (/\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|gr|mg|l|lt|ltr|ml|cl|cc)\b/.test(s)) return null;
  let pack = 1;
  const packM = s.match(/\b(\d+)\s*x\b/) || s.match(/\bx\s*(\d+)\b/);
  if (packM) pack = parseInt(packM[1], 10) || 1;
  const m = s.match(SIZE_RE);
  if (!m) return null;
  const val = parseFloat(m[1].replace(",", "."));
  if (!(val > 0)) return null;
  const u = m[2];
  let family, base;
  if (u === "kg") { family = "mass"; base = val * 1000; }
  else if (["g", "gr", "gram", "grams"].includes(u)) { family = "mass"; base = val; }
  else if (u === "mg") { family = "mass"; base = val * 0.001; }
  else if (["l", "lt", "ltr", "liter", "litre"].includes(u)) { family = "vol"; base = val * 1000; }
  else if (u === "cl") { family = "vol"; base = val * 10; }
  else if (["ml", "cc"].includes(u)) { family = "vol"; base = val; }
  else if (["pcs", "pc"].includes(u)) { family = "count"; base = val; }
  else return null;
  base *= pack;
  if (!(base > 0)) return null;
  if (family === "mass") return { family, baseQty: base, denom: base / 100, label: "100g" };
  if (family === "vol") return { family, baseQty: base, denom: base / 100, label: "100ml" };
  return { family, baseQty: base, denom: base, label: "pc" };
}

// Strip brand + size/pack tokens out of a name, leaving the "core" description
// — used both to group brand/size variants of a good, and as the text input
// to the name-similarity check in the cross-source matcher.
export function coreName(name, brand) {
  let s = (name || "").toLowerCase();
  if (brand) s = s.split(brand.toLowerCase()).join(" ");
  s = s.replace(UNIT_STRIP_RE, " ").replace(PACK_STRIP_RE, " ");
  s = s.replace(/[^a-z\u0600-\u06FF ]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

// Token-set similarity (Dice coefficient over word sets) — deliberately simple
// and auditable rather than a black-box embedding model. For a government
// transparency tool, "why did these two listings get linked" needs to be
// answerable in one sentence; this metric always is: "N of their M combined
// words matched exactly." Combined with the hard category+size+brand gates in
// buildProducts.js, this is the "multiple independent, inspectable signals"
// design — no single weak signal (like the old exact-string match) can cause
// a false link on its own.
export function tokenSimilarity(a, b) {
  const wa = new Set((a || "").split(" ").filter((w) => w.length > 1));
  const wb = new Set((b || "").split(" ").filter((w) => w.length > 1));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return (2 * shared) / (wa.size + wb.size);
}
