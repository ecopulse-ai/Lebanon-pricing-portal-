// ─── CPI-basket retail prices — accessors ────────────────────────────────────
// Backed by data/basket_prices.json, built from per-chain basket exports in
// data/baskets/ by scripts/build_basket.py. This is the portal's repeatable,
// CSV-fed price feed (drop a dated export in data/baskets/ and re-run the
// script). Chains are scraped on different days, so the "current" figures take
// each chain's most recent date — cross-sectional, with a `trend` series that
// grows as more dated files are added.
//
// 2026-08: all the gap MATH (geometric-mean item gap, weighted-average category
// gap, actual-unit standardization, all-3-chains filtering) now happens inside
// scripts/build_basket.py, not here — this file only formats/exposes it. See
// that script's module docstring for the full methodology writeup.

import data from "@/data/basket_prices.json";

export const BASKET = data;

const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

function log(...args) {
  console.log("[basketData]", ...args);
}
function logWarn(...args) {
  console.warn("[basketData] WARNING:", ...args);
}

export function getBasketMeta() {
  return data.meta;
}

export function getBasketKPIs() {
  return data.kpis;
}

// CPI divisions with item count, median price, and per-chain median.
// Descriptive only — not the weighted-gap analysis (see getCategoryGaps).
export function getBasketCategories() {
  return data.categorySummary || [];
}

// Chains ordered by basket coverage, with price level, availability, and —
// where the chain has comparable+credible items — its size-normalized premium.
// avgPremiumPct is `null` (not 0) for a chain with no comparable items yet, so
// callers can't mistake "no data" for "no price difference".
export function getBasketChains() {
  return data.chains || [];
}

// Cheapest vs dearest chain by category median (largest spreads first). Raw
// pack-price comparison, descriptive KPI — not the size-normalized gap.
export function getCheapestByCategory(n = 8) {
  return (data.cheapestByCategory || []).slice(0, n);
}

// Per-CPI-item comparable rows (present in all required chains, valid GM gap).
export function getBasketItems() {
  return data.items || [];
}

// Same, but only the items inside the credible 10-150% gap band.
export function getFlaggedItems() {
  return data.flaggedItems || [];
}

// Product-level gaps — the tier BELOW items now (2026-08 methodology change):
// a "product" is a specific good matched by name across chains within a
// cpi_item (e.g. "Zain Peeled Wheat 900g"), brand-intersected where a chain
// carries multiple brands. `coverage: "full"` means it's present in every
// ACTIVE_CHAINS chain and feeds the item-level rollup; `coverage: "partial"`
// means it's present in >=2 but not all active chains (only possible once
// more than 2 chains are active) — shown for transparency but excluded from
// item/category aggregation. See scripts/build_basket.py's 2026-08 section.
export function getBasketProducts() {
  return data.products || [];
}

export function getPartialCoverageProducts() {
  return (data.products || []).filter((p) => p.coverage === "partial");
}

// EVERY CPI category (not just the ones with a flagged item), each with its
// weighted-average gap and a `needsReview` flag, or `insufficientData: true`
// if no comparable item exists for it yet. This is what "All Categories"
// renders — nothing is hidden, unlike the old "Categories to review" table
// which only showed categories that already had >=2 flagged items.
export function getCategoryGaps() {
  const rows = data.categoryGaps || [];
  if (data.meta?.usingEqualWeights) {
    logWarn(
      "getCategoryGaps(): category gapPct values are UNWEIGHTED (equal weights) — " +
        "real CPI weights from data/item_product_catalog.json were not available when data/basket_prices.json was built."
    );
  }
  return rows;
}

// Time series of basket median (and per-category medians) across scrape dates.
export function getBasketTrend() {
  return data.trend || [];
}

// One-line strategic reads, derived so a page and the advisor stay in sync.
export function getBasketHeadlines() {
  const c = (data.chains || []).filter((x) => x.medianPrice != null);
  if (!c.length) return { cheapest: null, dearest: null, widestSpread: null };
  const cheapest = c.reduce((a, b) => (b.medianPrice < a.medianPrice ? b : a));
  const dearest = c.reduce((a, b) => (b.medianPrice > a.medianPrice ? b : a));
  const widest = (data.cheapestByCategory || [])[0] || null;
  return { cheapest, dearest, widestSpread: widest };
}

// Compact context block for the AI advisor — real numbers, no fabrication.
// Market-level only: individual chains are never named or ranked here.
export function getBasketContext() {
  const k = data.kpis;
  const cats = data.categorySummary || [];
  const L = [];
  L.push(
    `Live CPI-basket shelf prices (as of ${k.latestDate}; USD; cross-sectional across ${k.chains} chains, scraped on differing days — not a single-day cut):`
  );
  L.push(
    `- ${k.itemsTracked} CPI basket items tracked across ${k.categories} CPI divisions; median basket price $${k.basketMedian}, mean $${k.basketMean}; ${k.inStockRate}% in stock; ${k.discountedSharePct}% currently discounted.`
  );
  L.push(
    `- Category price levels (median): ${cats
      .slice(0, 8)
      .map((c) => `${c.name} $${c.medianPrice}`)
      .join(", ")}.`
  );
  L.push(
    "Do NOT name, rank or compare individual supermarkets/chains; report only market-level aggregates."
  );
  return L.join("\n");
}

// Chain-level context — the ONE dataset where naming chains is allowed, because
// these are real scraped prices tagged to named chains (Carrefour, Spinneys,
// Tawfeer). Lets the advisor answer "which supermarket is driving high prices".
export function getBasketChainContext() {
  const k = data.kpis;
  const cd = data.meta?.chainDates
    ? " (" + Object.entries(data.meta.chainDates).map(([c, d]) => `${c} ${d}`).join(", ") + ")"
    : "";
  const chains = data.chains || [];
  const L = [];
  L.push(
    `Cross-chain CPI basket — REAL scraped shelf prices tagged to NAMED chains; as of ${k.latestDate}; USD; cross-sectional (chains scraped on differing days${cd}, so compare levels, not a single-day cut):`
  );
  L.push(
    `- Chain price level (median basket item): ${chains
      .map((c) => `${c.name} $${c.medianPrice} (mean $${c.meanPrice}, ${c.inStockRate}% in stock, ${c.items} items)`)
      .join("; ")}.`
  );
  const withPremium = chains.filter((c) => c.avgPremiumPct != null);
  const withoutPremium = chains.filter((c) => c.avgPremiumPct == null);
  if (withPremium.length) {
    L.push(
      `- SIZE-NORMALIZED chain premium (dearest chain's unit price vs. the GEOMETRIC MEAN of all comparable chains' unit prices on the SAME item, present in every chain — apples-to-apples): ${withPremium
        .map((c) => `${c.name} ${c.avgPremiumPct >= 0 ? "+" : ""}${c.avgPremiumPct}% (dearest on ${c.dearestItems}/${c.itemsCompared} items)`)
        .join("; ")}.`
    );
  }
  if (withoutPremium.length) {
    L.push(
      `- No comparable premium figure yet for: ${withoutPremium.map((c) => c.name).join(", ")} — this chain currently has zero CPI items overlapping the credible-gap set with the other chains, not a zero price difference.`
    );
  }
  const catGaps = (data.categoryGaps || []).filter((c) => !c.insufficientData);
  L.push(
    `- Dearest chain by category (weighted average of item gaps by CPI importance weight${
      data.meta?.usingEqualWeights ? " — NOTE: equal-weighted fallback, real CPI weights from the item catalog not available" : ""
    }; widest gap first): ${[...catGaps]
      .sort((a, b) => b.gapPct - a.gapPct)
      .slice(0, 8)
      .map((c) => `${c.category}: dearest ${c.dearest} vs cheapest ${c.cheapest} (weighted +${c.gapPct}%, ${c.nItems} items)`)
      .join("; ")}.`
  );
  L.push(
    "The raw per-listed-product price levels above are composition-dependent; for any chain/category/item comparison, USE the size-normalized figures — never compare raw pack prices of different sizes."
  );
  return L.join("\n");
}

// Per-ITEM cross-chain prices — the SAME CPI item priced at each named chain
// (with each chain's actual product). This is what enables true per-product,
// per-supermarket comparison. Returns the widest-gap items first.
export function getBasketItemGapContext(n = 30) {
  const rows = [...(data.flaggedItems || [])].sort((a, b) => b.gapPct - a.gapPct).slice(0, n);
  const L = [];
  L.push(
    `Per-ITEM cross-chain comparison, standardized to each item's own ACTUAL pack unit (e.g. 900G, 1KG, 30PCS — majority chain's size; every chain's price is still scaled to that reference so pack-size differences don't distort the number) — gap = dearest chain vs. the geometric mean of all comparable chains (${(data.items || []).length} items comparable; top ${rows.length} by gap):`
  );
  for (const r of rows) {
    L.push(
      `- ${r.cpi_item} (${r.category}, per ${r.unit}): cheapest ${r.cheapChain} $${r2(r.cheapUnitPrice)}/${r.unit} vs dearest ${r.dearChain} $${r2(r.dearUnitPrice)}/${r.unit} — +${r.gapPct}% vs the geometric-mean price (${r.nChains} chains compared).`
    );
  }
  return L.join("\n");
}

// Header-stat summary (median gap, share >=25%) computed across ALL comparable
// basket items (not just the top-N chart rows) — replaces the equivalent
// figures the old Data-Lake getPriceDispersion() used to supply, now that
// this page's dispersion view is basket-sourced.
export function getBasketDispersionStats() {
  const gaps = (data.items || []).map((it) => it.gapPct).filter((g) => g != null).sort((a, b) => a - b);
  if (!gaps.length) return { medianGapPct: 0, shareOver25Pct: 0, comparedItems: 0 };
  const medianGapPct = gaps[Math.floor(gaps.length / 2)];
  const shareOver25Pct = Math.round((100 * gaps.filter((g) => g >= 25).length) / gaps.length);
  return { medianGapPct, shareOver25Pct, comparedItems: gaps.length };
}

// "Same Product Different Price" (formerly Price Dispersion) — now sourced
// from the CPI basket (named chains), not the live Data Lake catalogue.
// Deliberately reuses the SAME items/gap computation as Inspection Watch
// (all-3-chains, GM-anchored gap) rather than inventing a second, differently
// -filtered notion of "gap" for what is conceptually the same metric shown a
// second time, in chart form. "Show all information, even chain names" means
// every chain's actual unit price is included per item, not just cheap/dear.
export function getBasketPriceDispersion(topN = 10) {
  const rows = [...(data.products || [])]
    .filter((p) => p.gapPct != null)
    .sort((a, b) => b.gapPct - a.gapPct)
    .slice(0, topN)
    .map((p) => ({
      item: p.productName,
      cpiItem: p.cpi_item,
      category: p.category,
      unit: p.unit,
      geoMean: r2(p.geoMeanUnitPrice),
      gapPct: p.gapPct,
      nChains: p.chainsCompared.length,
      coverage: p.coverage,
      matchSource: p.matchSource,
      byChain: Object.fromEntries(Object.entries(p.unitByChain || {}).map(([ch, up]) => [ch, r2(up)])),
      dearChain: p.dearChain,
      cheapChain: p.cheapChain,
    }));
  if (!rows.length) {
    logWarn("getBasketPriceDispersion(): no products with a valid gap were found.");
  }
  return { top: rows, comparedProducts: (data.products || []).length };
}

// ── Forensic "Inspection Watch" ──────────────────────────────────────────────
// Statistical flags for a Ministry price unit: which chains, categories and
// items sit far above peers and are worth a closer look. Risk indicators for
// prioritising review — NOT findings of wrongdoing.
export function getForensicWatch({ topItems = 10 } = {}) {
  const chains = data.chains || [];
  const items = [...(data.flaggedItems || [])]
    .sort((a, b) => b.gapPct - a.gapPct)
    .slice(0, topItems)
    .map((it) => ({
      item: it.cpi_item,
      category: it.category,
      unit: it.unit,
      dearCh: it.dearChain,
      dearP: r2(it.dearUnitPrice),
      cheapCh: it.cheapChain,
      cheapP: r2(it.cheapUnitPrice),
      gap: it.gapPct,
      nChains: it.nChains,
      nProducts: it.nProducts,
      products: it.products || [],
    }));

  if (!chains.length) {
    logWarn("getForensicWatch(): no chains found in data/basket_prices.json.");
  }

  return {
    asOf: data.kpis?.latestDate,
    chainDates: data.meta?.chainDates || null,
    activeChains: data.meta?.activeChains || null,
    comparedItems: (data.items || []).length,
    flaggedItems: (data.flaggedItems || []).length,
    usingEqualWeights: !!data.meta?.usingEqualWeights,
    chains, // { name, items, medianPrice, meanPrice, inStockRate, itemsCompared, dearestItems, avgPremiumPct }
    categoryGaps: getCategoryGaps(), // ALL categories, each flagged or insufficientData
    items, // top-N outlier items, per-unit
    partialCoverageProducts: getPartialCoverageProducts(), // products found in >=2 but not
      // all active chains -- only non-empty once a 3rd+ chain is active; excluded from
      // item/category rollups, shown separately and explicitly labelled in the UI.
  };
}
