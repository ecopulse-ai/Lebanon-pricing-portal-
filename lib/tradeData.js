// ─── Trade & shipping dependency — accessors ─────────────────────────────────
// Backed by the live Data Lake pipeline, cached via lib/etl/cache.js.
// Market-level only — individual supermarkets are never named here. All
// functions are now async; callers must `await`.

import { getMarketData } from "./etl/cache";

export async function getTradeMeta() {
  const { trade } = await getMarketData();
  return trade.meta;
}
export async function getTradeTotals() {
  const { trade } = await getMarketData();
  return trade.totals;
}
export async function getBlocs() {
  const { trade } = await getMarketData();
  return trade.blocs;
}
export async function getChokepoints() {
  const { trade } = await getMarketData();
  return trade.chokepoints;
}

export async function getSupplierCountries() {
  const { trade } = await getMarketData();
  return trade.countries.map((c) => ({
    name: c.name, sharePct: c.sharePct, bloc: c.bloc, route: c.route,
    chokepoints: c.chokepoints, monopolyCategories: c.monopolyCategories,
    dominantCategories: c.dominantCategories,
  }));
}

export async function getCountry(name) {
  const { trade } = await getMarketData();
  return trade.countries.find((c) => c.name === name) || null;
}

export async function getCountriesFull() {
  const { trade } = await getMarketData();
  return trade.countries;
}

export async function getConcentrationNodes() {
  const { trade } = await getMarketData();
  return trade.categories.map((c) => ({
    id: c.name, label: c.name, value: c.topShare, size: c.tracedItems,
    source: c.topSource, top3: c.top3, medianPrice: c.medianPrice,
  }));
}

export async function getCountryNodes(name) {
  const c = await getCountry(name);
  if (!c) return [];
  return c.supplies.map((s) => ({
    id: s.category, label: s.category, value: s.gripPct, size: s.items, source: name,
  }));
}

export async function getCriticalDependencies(n = 8) {
  const { trade } = await getMarketData();
  return trade.categories.filter((c) => c.topShare >= 50).slice(0, n);
}

// Compact context for the AI advisor.
export async function getTradeContext() {
  const { trade } = await getMarketData();
  const t = trade.totals;
  const L = [];
  L.push(
    `Import & shipping dependency (country-of-origin signal on ${t.tracedItems.toLocaleString()} traced items, ${t.tracedPct}% of catalogue; cross-sectional):`
  );
  L.push(
    `- ${t.countries} source countries. Top supplier ${t.topSupplier} (${t.topSupplierShare}% of all traced imports). ${t.concentratedCategories} of ${t.categories} categories lean >50% on a single source.`
  );
  L.push(`- Supplier blocs: ${trade.blocs.map((b) => `${b.name} ${b.sharePct}%`).join(", ")}.`);
  L.push(
    `- Maritime chokepoint exposure (share of traced imports that must transit): ${trade.chokepoints
      .map((c) => `${c.name} ${c.sharePct}%`)
      .join(", ")}.`
  );
  L.push(
    `- Most single-source-concentrated categories: ${trade.categories
      .slice(0, 6)
      .map((c) => `${c.name} ${c.topShare}% from ${c.topSource}`)
      .join("; ")}.`
  );
  return L.join("\n");
}
