// ─── Real product catalogue — server-side search/paging ──────────────────────
// Backed by the live Data Lake pipeline (lib/etl/pipeline.js), cached via
// lib/etl/cache.js. No more static data/products.json — this now runs
// server-side on every cache miss, but the result is memoized and shared
// across all requests until the next revalidation. No outlet/supermarket
// names are stored or returned.

import { getMarketData } from "./etl/cache";

export async function getCatalogueMeta() {
  const { products } = await getMarketData();
  return products.meta;
}

export async function getCategories() {
  const { products } = await getMarketData();
  return products.meta.categories;
}

export async function getProductById(id) {
  const { products } = await getMarketData();
  const i = Number(id);
  return products.products[i] && products.products[i].id === i ? products.products[i] : null;
}

// Price dispersion — the transparency model's core evidence: the same product
// selling at very different prices across outlets. Outlet names are not stored,
// so this is the anonymized "how much do prices vary" view + a top-N watchlist.
export async function getPriceDispersion({ topN = 10, minListings = 6 } = {}) {
  const { products } = await getMarketData();
  const rows = [];
  for (const p of products.products) {
    if (p.n < minListings) continue;                 // enough observations to be real
    // Robust low/high: 10th–90th percentile, which ignores a lone mispriced or
    // unit-mismatched listing (e.g. a single can grouped with a six-pack).
    const lo = p.p10 ?? p.min;
    const hi = p.p90 ?? p.max;
    const med = p.med;
    if (!(lo > 0.3) || !(hi > lo) || !(med > 0)) continue;
    // Coherence guard: low/high must sit within a sane band of the median.
    // Outside it, the group is mixing different units/sizes — not real shelf
    // variation — so we exclude it rather than flag a fake spread.
    if (lo < 0.5 * med || hi > 2 * med) continue;
    const spreadPct = Math.round(((hi - lo) / lo) * 100);
    if (spreadPct < 8) continue;                      // ignore trivial variation
    rows.push({ id: p.id, name: p.name, brand: p.brand, cat: p.cat, min: lo, med, max: hi, n: p.n, spreadPct });
  }
  const spreads = rows.map((r) => r.spreadPct).sort((a, b) => a - b);
  const medianSpread = spreads.length ? spreads[Math.floor(spreads.length / 2)] : 0;
  const over25 = rows.filter((r) => r.spreadPct >= 25).length;
  const shareOver25 = rows.length ? Math.round((100 * over25) / rows.length) : 0;
  const top = [...rows].sort((a, b) => b.spreadPct - a.spreadPct).slice(0, topN);
  return { top, medianSpread, trackedProducts: rows.length, shareOver25, minListings };
}

// ── Per-standard-unit market view ────────────────────────────────────────────
// Normalize each product to $/100g · $/100ml · $/piece (parsed from the size in
// its name, incl. pack multipliers), then group products into "goods" by their
// size- and brand-stripped core name + category + unit family, and flag the
// goods whose per-unit price varies most across brands/sizes market-wide.
// Products with no parseable size are excluded (never guessed).
function r2(x) {
  return Math.round(x * 100) / 100;
}
function titleCase(s) {
  return (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
}
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gram|grams|mg|l|lt|ltr|liter|litre|ml|cl|cc|pcs|pc)\b/;
const UNIT_STRIP_RE = /\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gram|grams|mg|l|lt|ltr|liter|litre|ml|cl|cc|pcs|pc|pack)\b/g;
const PACK_STRIP_RE = /\bx\s*\d+\b|\b\d+\s*x\b/g;

function parseSize(name) {
  const s = (name || "").toLowerCase();
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
  if (family === "mass") return { family, denom: base / 100, label: "100g" };
  if (family === "vol") return { family, denom: base / 100, label: "100ml" };
  return { family, denom: base, label: "pc" };
}

function coreName(name, brand) {
  let s = (name || "").toLowerCase();
  if (brand) s = s.split(brand.toLowerCase()).join(" ");
  s = s.replace(UNIT_STRIP_RE, " ").replace(PACK_STRIP_RE, " ");
  s = s.replace(/[^a-z؀-ۿ ]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

export async function getUnitPriceWatch({ topN = 10, minVariants = 3, minListings = 12 } = {}) {
  const { products } = await getMarketData();
  const goods = new Map();
  for (const p of products.products) {
    if (!(p.med > 0)) continue;
    const sz = parseSize(p.name);
    if (!sz) continue;
    const unitPrice = p.med / sz.denom;
    if (!(unitPrice > 0) || !isFinite(unitPrice)) continue;
    const core = coreName(p.name, p.brand);
    if (core.length < 3) continue;
    const key = `${p.cat}|${sz.family}|${core}`;
    let g = goods.get(key);
    if (!g) { g = { core, cat: p.cat, label: sz.label, ups: [], listings: 0 }; goods.set(key, g); }
    g.ups.push(unitPrice);
    g.listings += p.n;
  }
  const rows = [];
  for (const g of goods.values()) {
    if (g.ups.length < minVariants || g.listings < minListings) continue;
    const ups = [...g.ups].sort((a, b) => a - b);
    const lo = ups[Math.round(0.1 * (ups.length - 1))];
    const hi = ups[Math.round(0.9 * (ups.length - 1))];
    const med = ups[Math.floor(ups.length / 2)];
    if (!(lo > 0) || !(hi > lo) || !(med > 0)) continue;
    if (lo < 0.4 * med || hi > 2.5 * med) continue; // coherence: reject bad merges
    const spreadPct = Math.round(((hi - lo) / lo) * 100);
    if (spreadPct < 15) continue;
    rows.push({
      good: titleCase(g.core), cat: g.cat, unit: g.label,
      lo: r2(lo), med: r2(med), hi: r2(hi),
      variants: g.ups.length, listings: g.listings, spreadPct,
    });
  }
  rows.sort((a, b) => b.spreadPct - a.spreadPct);
  return { top: rows.slice(0, topN), goods: rows.length };
}

const SORTS = {
  popular: null, // pre-sorted by listing count desc
  price_asc: (a, b) => a.med - b.med,
  price_desc: (a, b) => b.med - a.med,
  name: (a, b) => a.name.localeCompare(b.name),
};

export async function searchProducts({ q = "", cat = "All", sort = "popular", page = 1, pageSize = 50 } = {}) {
  const { products } = await getMarketData();
  const s = q.trim().toLowerCase();
  let rows = products.products;

  if (s || cat !== "All") {
    rows = rows.filter((p) => {
      const okCat = cat === "All" || p.cat === cat;
      const okQ = !s || p.name.toLowerCase().includes(s) || (p.brand && p.brand.toLowerCase().includes(s));
      return okCat && okQ;
    });
  }

  const cmp = SORTS[sort];
  if (cmp) rows = [...rows].sort(cmp);

  const total = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const items = rows.slice(start, start + pageSize);
  return { total, page, pageSize, items };
}
