// ─── Trade & shipping dependency — accessors ─────────────────────────────────
// Backed by data/trade_dependency.json (built by scripts/build_snapshot.py from
// the country-of-origin signal). Lebanon imports almost everything by sea, so
// the strategic reads are: single-source concentration per category, each source
// country's "supplier power", and exposure to maritime chokepoints (Suez, etc.).
// Market-level only — individual supermarkets are never named here.

import dep from "@/data/trade_dependency.json";

export const TRADE = dep;

export function getTradeMeta() { return dep.meta; }
export function getTradeTotals() { return dep.totals; }
export function getBlocs() { return dep.blocs; }
export function getChokepoints() { return dep.chokepoints; }

// Country chips (largest suppliers first) for the lens selector.
export function getSupplierCountries() {
  return dep.countries.map((c) => ({
    name: c.name, sharePct: c.sharePct, bloc: c.bloc, route: c.route,
    chokepoints: c.chokepoints, monopolyCategories: c.monopolyCategories,
    dominantCategories: c.dominantCategories,
  }));
}

export function getCountry(name) {
  return dep.countries.find((c) => c.name === name) || null;
}

// Full country objects (incl. their per-category supplies) — for the explorer.
export function getCountriesFull() {
  return dep.countries;
}

// Default constellation: every category as a node, sized by import volume,
// scored by how much it leans on its single largest source country.
export function getConcentrationNodes() {
  return dep.categories.map((c) => ({
    id: c.name,
    label: c.name,
    value: c.topShare,          // single-source concentration %
    size: c.tracedItems,
    source: c.topSource,
    top3: c.top3,
    medianPrice: c.medianPrice,
  }));
}

// Per-country supplier-power constellation: the categories a country supplies,
// scored by its grip (share) on each.
export function getCountryNodes(name) {
  const c = getCountry(name);
  if (!c) return [];
  return c.supplies.map((s) => ({
    id: s.category,
    label: s.category,
    value: s.gripPct,           // this country's share of the category
    size: s.items,
    source: name,
  }));
}

export function getCriticalDependencies(n = 8) {
  return dep.categories.filter((c) => c.topShare >= 50).slice(0, n);
}

// Compact context for the AI advisor.
export function getTradeContext() {
  const t = dep.totals;
  const L = [];
  L.push(
    `Import & shipping dependency (country-of-origin signal on ${t.tracedItems.toLocaleString()} traced items, ${t.tracedPct}% of catalogue; cross-sectional):`
  );
  L.push(
    `- ${t.countries} source countries. Top supplier ${t.topSupplier} (${t.topSupplierShare}% of all traced imports). ${t.concentratedCategories} of ${t.categories} categories lean >50% on a single source.`
  );
  L.push(
    `- Supplier blocs: ${dep.blocs.map((b) => `${b.name} ${b.sharePct}%`).join(", ")}.`
  );
  L.push(
    `- Maritime chokepoint exposure (share of traced imports that must transit): ${dep.chokepoints
      .map((c) => `${c.name} ${c.sharePct}%`)
      .join(", ")}.`
  );
  L.push(
    `- Most single-source-concentrated categories: ${dep.categories
      .slice(0, 6)
      .map((c) => `${c.name} ${c.topShare}% from ${c.topSource}`)
      .join("; ")}.`
  );
  return L.join("\n");
}
