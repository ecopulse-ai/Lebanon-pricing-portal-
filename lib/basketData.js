// ─── CPI-basket retail prices — accessors ────────────────────────────────────
// Backed by data/basket_prices.json, built from per-chain basket exports in
// data/baskets/ by scripts/build_basket.py. This is the portal's repeatable,
// Excel/CSV-fed price feed (drop a dated export in data/baskets/ and re-run the
// script). Chains are scraped on different days, so the "current" figures take
// each chain's most recent date — cross-sectional, with a `trend` series that
// grows as more dated files are added.

import data from "@/data/basket_prices.json";

export const BASKET = data;

export function getBasketMeta() {
  return data.meta;
}

export function getBasketKPIs() {
  return data.kpis;
}

// CPI divisions (111–122) with item count, median price, and per-chain median.
export function getBasketCategories() {
  return data.categories;
}

// Chains ordered by basket coverage, with price level and availability.
export function getBasketChains() {
  return data.chains;
}

// Cheapest vs dearest chain by category median (largest spreads first).
export function getCheapestByCategory(n = 8) {
  return data.cheapestByCategory.slice(0, n);
}

// Per CPI item: cheapest product per chain and the cross-chain price spread.
export function getBasketItems() {
  return data.items;
}

// Time series of basket median (and per-category medians) across scrape dates.
export function getBasketTrend() {
  return data.trend;
}

// One-line strategic reads, derived so a page and the advisor stay in sync.
export function getBasketHeadlines() {
  const c = [...data.chains];
  const cheapest = c.reduce((a, b) => (b.medianPrice < a.medianPrice ? b : a));
  const dearest = c.reduce((a, b) => (b.medianPrice > a.medianPrice ? b : a));
  const widest = data.cheapestByCategory[0] || null;
  return { cheapest, dearest, widestSpread: widest };
}

// Compact context block for the AI advisor — real numbers, no fabrication.
// Market-level only: individual chains are never named or ranked here.
export function getBasketContext() {
  const k = data.kpis;
  const L = [];
  L.push(
    `Live CPI-basket shelf prices (as of ${k.latestDate}; USD; cross-sectional across ${k.chains} chains, scraped on differing days — not a single-day cut):`
  );
  L.push(
    `- ${k.itemsTracked} CPI basket items tracked across ${k.categories} CPI divisions; median basket price $${k.basketMedian}, mean $${k.basketMean}; ${k.inStockRate}% in stock; ${k.discountedSharePct}% currently discounted.`
  );
  L.push(
    `- Category price levels (median): ${data.categories
      .slice(0, 8)
      .map((c) => `${c.name} $${c.medianPrice}`)
      .join(", ")}.`
  );
  L.push(
    "Do NOT name, rank or compare individual supermarkets/chains; report only market-level aggregates."
  );
  return L.join("\n");
}
