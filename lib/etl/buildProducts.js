// JS port of scripts/build_products.py. Same grouping/sorting logic, just
// operating on an in-memory array of standardized rows instead of reading a
// giant CSV off disk.

import { canonCategory } from "./categories";

function round2(x) {
  return Math.round(x * 100) / 100;
}

function median(sortedAsc) {
  const n = sortedAsc.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

// Percentile of a sorted-ascending array (nearest-rank). Used for robust
// low/high bounds that ignore lone mispriced or unit-mismatched listings.
function percentile(sortedAsc, q) {
  if (!sortedAsc.length) return 0;
  const idx = Math.round(q * (sortedAsc.length - 1));
  return sortedAsc[idx];
}

function topKey(counter) {
  let best = null;
  let bestN = -1;
  for (const [k, n] of counter) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function buildProducts(rows) {
  const groups = new Map();
  let listingCount = 0;

  for (const row of rows) {
    const name = row.product_name;
    if (!name) continue;
    listingCount++;

    const brand = row.brand || "";
    const key = `${name.toLowerCase().trim().replace(/\s+/g, " ")}|${brand.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        names: new Map(),
        brand,
        cat: canonCategory(row.category_top),
        prices: [],
        imgs: [],
        origins: new Map(),
        units: new Map(),
        instock: 0,
        listings: 0,
      };
      groups.set(key, g);
    }
    g.listings++;
    g.names.set(name, (g.names.get(name) || 0) + 1);
    if (typeof row.price_usd === "number" && row.price_usd > 0) g.prices.push(row.price_usd);
    if (row.img) g.imgs.push(row.img);
    if (row.origin_probable) g.origins.set(row.origin_probable, (g.origins.get(row.origin_probable) || 0) + 1);
    if (row.qty_unit_raw) g.units.set(row.qty_unit_raw, (g.units.get(row.qty_unit_raw) || 0) + 1);
    if (row.in_stock) g.instock++;
  }

  const products = [];
  for (const g of groups.values()) {
    if (!g.prices.length) continue;
    const ps = [...g.prices].sort((a, b) => a - b);
    products.push({
      id: null, // assigned after sort
      name: topKey(g.names),
      brand: g.brand,
      cat: g.cat,
      min: round2(ps[0]),
      max: round2(ps[ps.length - 1]),
      med: round2(median(ps)),
      p10: round2(percentile(ps, 0.1)),
      p90: round2(percentile(ps, 0.9)),
      n: g.listings,
      origin: topKey(g.origins) || "",
      unit: topKey(g.units) || "",
      img: g.imgs[0] || "",
      stock: g.instock > 0,
    });
  }

  // Most-listed products first, then assign stable ids — same tie-break as the
  // Python version.
  products.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  products.forEach((p, i) => (p.id = i));

  const categories = [...new Set(products.map((p) => p.cat))].sort();

  return {
    meta: {
      source: "live: Promarche + Al-Makhazen + Spinneys (Azure Data Lake, daily)",
      listings: listingCount,
      products: products.length,
      categories,
      currency: "USD",
    },
    products,
  };
}
