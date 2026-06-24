// ─── Real retail snapshot — strategic accessors ──────────────────────────────
// Backed by data/retail_snapshot.json, pre-aggregated from ~133k live shelf
// prices across four Lebanese chains (Al-Makhazen, Promarche, Carrefour,
// Spinneys) by scripts/build_snapshot.py. This is a cross-sectional snapshot,
// not a time series — every figure is positional: price level, availability,
// sourcing. Re-run the build script to refresh.

import snapshot from "@/data/retail_snapshot.json";

export const SNAPSHOT = snapshot;

export function getSnapshotMeta() {
  return snapshot.meta;
}

export function getRetailKPIs() {
  return snapshot.kpis;
}

// Chains ordered by catalogue size, with price level and availability.
export function getRetailers() {
  return snapshot.retailers;
}

// Canonical category groups (17), with share and median shelf price.
export function getCategories() {
  return snapshot.categories;
}

// Import-origin mix — share of traced products by source country.
export function getOrigins() {
  return snapshot.origins;
}

// Affordability distribution across price bands.
export function getPriceBands() {
  return snapshot.priceBands;
}

// Cheapest vs dearest chain by category median (largest spreads first).
// Filters out degenerate rows where only one chain is comparable.
export function getCheapestByCategory(n = 8) {
  return snapshot.cheapestByCategory
    .filter((r) => r.cheapest !== r.dearest && r.spreadPct > 0)
    .slice(0, n);
}

export function getTopBrands(n = 8) {
  return snapshot.topBrands.slice(0, n);
}

// One-line strategic reads, derived so the page and advisor stay in sync.
export function getRetailHeadlines() {
  const r = [...snapshot.retailers];
  const cheapest = r.reduce((a, b) => (b.medianPrice < a.medianPrice ? b : a));
  const dearest = r.reduce((a, b) => (b.medianPrice > a.medianPrice ? b : a));
  const worstStock = r.reduce((a, b) => (b.inStockRate < a.inStockRate ? b : a));
  const topOrigin = snapshot.origins[0];
  return { cheapest, dearest, worstStock, topOrigin };
}

// Compact context block for the AI advisor — real numbers, no fabrication.
// Market-level only: individual chains/supermarkets are never named or compared.
export function getRetailContext() {
  const k = snapshot.kpis;
  const b = snapshot.priceBands;
  const under5 = Math.round(b.slice(0, 3).reduce((a, x) => a + x.sharePct, 0) * 10) / 10;
  const above10 = Math.round(b.slice(-2).reduce((a, x) => a + x.sharePct, 0) * 10) / 10;
  const L = [];
  L.push(
    `Live retail shelf snapshot (${snapshot.meta.snapshotDates.join(" & ")}; USD; cross-sectional market aggregate, not a trend):`
  );
  L.push(
    `- ${k.products.toLocaleString()} priced items across national retail; median shelf price $${k.medianPrice}, mean $${k.meanPrice}; ${k.inStockRate}% in stock (${Math.round((100 - k.inStockRate) * 10) / 10}% out of stock).`
  );
  L.push(
    `- Affordability: ${under5}% of items under $5, ${above10}% above $10.`
  );
  L.push(
    `- Import dependency: ${k.tracedToOriginPct}% of items traced to ${k.originCountries} source countries, led by ${snapshot.origins
      .slice(0, 5)
      .map((o) => `${o.name} ${o.sharePct}%`)
      .join(", ")}.`
  );
  L.push(
    `- Category mix by count: ${snapshot.categories
      .slice(0, 6)
      .map((c) => `${c.name} ${c.sharePct}% (median $${c.medianPrice})`)
      .join(", ")}.`
  );
  L.push(
    "Do NOT name, rank or compare individual supermarkets/chains; report only market-level aggregates."
  );
  return L.join("\n");
}
