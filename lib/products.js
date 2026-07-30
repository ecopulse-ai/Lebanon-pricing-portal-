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
export async function getPriceDispersion({ topN = 10, minListings = 5 } = {}) {
  const { products } = await getMarketData();
  const rows = [];
  for (const p of products.products) {
    if (p.n < minListings) continue;              // enough observations to be real
    if (!(p.min > 0.3) || !(p.max > p.min)) continue;
    if (p.max / p.min > 6) continue;              // drop mixed-SKU / mislabel noise
    const spreadPct = Math.round(((p.max - p.min) / p.min) * 100);
    rows.push({ id: p.id, name: p.name, brand: p.brand, cat: p.cat, min: p.min, med: p.med, max: p.max, n: p.n, spreadPct });
  }
  const spreads = rows.map((r) => r.spreadPct).sort((a, b) => a - b);
  const medianSpread = spreads.length ? spreads[Math.floor(spreads.length / 2)] : 0;
  const over25 = rows.filter((r) => r.spreadPct >= 25).length;
  const shareOver25 = rows.length ? Math.round((100 * over25) / rows.length) : 0;
  const top = [...rows].sort((a, b) => b.spreadPct - a.spreadPct).slice(0, topN);
  return { top, medianSpread, trackedProducts: rows.length, shareOver25, minListings };
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
