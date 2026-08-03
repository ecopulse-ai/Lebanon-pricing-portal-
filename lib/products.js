// ─── Real product catalogue — server-side search/paging ──────────────────────
// Backed by the live Data Lake pipeline (lib/etl/pipeline.js), cached via
// lib/etl/cache.js. Runs server-side on every cache miss, memoized and shared
// across requests until the next revalidation.
//
// 2026-08: "Same Product Different Price" now reads from the CPI-basket data
// (lib/basketData.js), not this file — see getBasketPriceDispersion there.
// "Same Good But Dearer" (the old getUnitPriceWatch) has been removed
// entirely, per the Price Transparency page redesign. Each product here now
// also carries which retailer(s) it was seen at (see buildProducts.js), so
// the catalogue can be filtered by source.

import { getMarketData } from "./etl/cache";

export async function getCatalogueMeta() {
  const { products } = await getMarketData();
  return products.meta;
}

export async function getCategories() {
  const { products } = await getMarketData();
  return products.meta.categories;
}

export async function getRetailers() {
  const { products } = await getMarketData();
  return products.meta.retailers || [];
}

export async function getProductById(id) {
  const { products } = await getMarketData();
  const i = Number(id);
  return products.products[i] && products.products[i].id === i ? products.products[i] : null;
}

const SORTS = {
  popular: null, // pre-sorted by listing count desc
  price_asc: (a, b) => a.med - b.med,
  price_desc: (a, b) => b.med - a.med,
  name: (a, b) => a.name.localeCompare(b.name),
};

export async function searchProducts({ q = "", cat = "All", retailer = "All", sort = "popular", page = 1, pageSize = 50 } = {}) {
  const { products } = await getMarketData();
  const s = q.trim().toLowerCase();
  let rows = products.products;

  if (s || cat !== "All" || retailer !== "All") {
    rows = rows.filter((p) => {
      const okCat = cat === "All" || p.cat === cat;
      const okQ = !s || p.name.toLowerCase().includes(s) || (p.brand && p.brand.toLowerCase().includes(s));
      const okRetailer = retailer === "All" || (p.retailers || []).includes(retailer);
      return okCat && okQ && okRetailer;
    });
  }

  const cmp = SORTS[sort];
  if (cmp) rows = [...rows].sort(cmp);

  const total = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const items = rows.slice(start, start + pageSize);
  return { total, page, pageSize, items };
}
