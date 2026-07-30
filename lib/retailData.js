// ─── Real retail snapshot — strategic accessors ──────────────────────────────
// Backed by the live Data Lake pipeline (lib/etl/pipeline.js → buildMarket.js),
// cached via lib/etl/cache.js. Cross-sectional snapshot across Promarche,
// Al-Makhazen, and Spinneys — not a time series. All functions are now async;
// callers must `await`.

import { getMarketData } from "./etl/cache";

// Lebanon is the country under analysis — domestically sourced goods are NOT
// imports, so Lebanon must never appear in the import-dependency mix. Drop it
// and rescale the remaining origins to shares of *imported* items.
function importOrigins(origins) {
  const imported = (origins || []).filter((o) => o.name !== "Lebanon");
  const total = imported.reduce((a, o) => a + (o.products || 0), 0);
  if (!total) return imported;
  return imported.map((o) => ({
    ...o,
    sharePct: Math.round((o.products / total) * 1000) / 10,
  }));
}

export async function getSnapshotMeta() {
  const { snapshot } = await getMarketData();
  return snapshot.meta;
}

export async function getRetailKPIs() {
  const { snapshot } = await getMarketData();
  // Exclude domestic Lebanon from the "source countries" count.
  const hadLebanon = (snapshot.origins || []).some((o) => o.name === "Lebanon");
  return hadLebanon
    ? { ...snapshot.kpis, originCountries: Math.max(0, (snapshot.kpis.originCountries || 0) - 1) }
    : snapshot.kpis;
}

export async function getRetailers() {
  const { snapshot } = await getMarketData();
  return snapshot.retailers;
}

export async function getCategories() {
  const { snapshot } = await getMarketData();
  return snapshot.categories;
}

export async function getOrigins() {
  const { snapshot } = await getMarketData();
  return importOrigins(snapshot.origins);
}

export async function getPriceBands() {
  const { snapshot } = await getMarketData();
  return snapshot.priceBands;
}

export async function getCheapestByCategory(n = 8) {
  const { snapshot } = await getMarketData();
  return snapshot.cheapestByCategory
    .filter((r) => r.cheapest !== r.dearest && r.spreadPct > 0)
    .slice(0, n);
}

export async function getTopBrands(n = 8) {
  const { snapshot } = await getMarketData();
  return snapshot.topBrands.slice(0, n);
}

export async function getRetailHeadlines() {
  const { snapshot } = await getMarketData();
  const r = [...snapshot.retailers];
  const cheapest = r.reduce((a, b) => (b.medianPrice < a.medianPrice ? b : a));
  const dearest = r.reduce((a, b) => (b.medianPrice > a.medianPrice ? b : a));
  const worstStock = r.reduce((a, b) => (b.inStockRate < a.inStockRate ? b : a));
  const topOrigin = importOrigins(snapshot.origins)[0];
  return { cheapest, dearest, worstStock, topOrigin };
}

// Compact context block for the AI advisor — real numbers, no fabrication.
// Market-level only: individual chains/supermarkets are never named or compared.
export async function getRetailContext() {
  const { snapshot } = await getMarketData();
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
  L.push(`- Affordability: ${under5}% of items under $5, ${above10}% above $10.`);
  const origins = importOrigins(snapshot.origins);
  const hadLebanon = (snapshot.origins || []).some((o) => o.name === "Lebanon");
  const originCount = Math.max(0, (k.originCountries || 0) - (hadLebanon ? 1 : 0));
  L.push(
    `- Import dependency (foreign sources only; Lebanon is the country under analysis, not an import origin): led by ${origins
      .slice(0, 5)
      .map((o) => `${o.name} ${o.sharePct}%`)
      .join(", ")} across ${originCount} source countries.`
  );
  L.push(
    `- Category mix by count: ${snapshot.categories
      .slice(0, 6)
      .map((c) => `${c.name} ${c.sharePct}% (median $${c.medianPrice})`)
      .join(", ")}.`
  );
  L.push("Do NOT name, rank or compare individual supermarkets/chains; report only market-level aggregates.");
  return L.join("\n");
}
