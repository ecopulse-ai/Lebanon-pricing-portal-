// ─── CPI-basket retail prices — accessors ────────────────────────────────────
// Backed by data/basket_prices.json, built from per-chain basket exports in
// data/baskets/ by scripts/build_basket.py. This is the portal's repeatable,
// CSV-fed price feed (drop a dated export in data/baskets/ and re-run the
// script). Chains are scraped on different days, so the "current" figures take
// each chain's most recent date — cross-sectional, with a `trend` series that
// grows as more dated files are added.
//
// 2026-08: all the gap MATH now happens inside scripts/build_basket.py, not
// here — this file only formats/exposes it. Geometric mean is used in
// exactly one place in that script: collapsing multiple matched products
// (brands) AT ONE CHAIN into a single representative price for that chain.
// It is NEVER used to compute a gap -- every gap here (item-level,
// product-level for the graph, chain premium) is a plain ratio between two
// already-resolved prices. See that script's module docstring for the full
// methodology writeup.

import data from "@/data/basket_prices.json";

export const BASKET = data;

// Must match CREDIBLE_GAP_LO/HI in scripts/build_basket.py exactly -- outside
// this range, a "gap" more likely reflects a different quality/format tier
// than a genuine same-product price difference (see getBasketProductDispersion).
const CREDIBLE_GAP_LO = 10;
const CREDIBLE_GAP_HI = 150;

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

// Product-level price records — the tier BELOW items now (2026-08 rewrite):
// each row is ONE real, verbatim-matched product at ONE chain, scaled to its
// item's real base unit. NOT a cross-chain pair — a chain's several matched
// products for one item (e.g. 3 wheat brands at Carrefour) each get their
// own row here. This is display-only data (the graph): item/category gaps
// are computed from the GM'd chain price in data.items, never from these
// individual rows directly. See scripts/build_basket.py's 2026-08 section.
export function getBasketProducts() {
  return data.products || [];
}

// EVERY CPI category (not just the ones with a flagged item), each with its
// weighted-average gap and a `needsReview` flag. Categories with zero
// comparable items are dropped entirely upstream (scripts/build_basket.py) —
// this always returns only categories with real data.
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
      `- SIZE-NORMALIZED chain premium (this chain's price vs. the average of the OTHER comparable chains' prices, on the SAME real item, scaled to the same real-world unit — apples-to-apples, no geometric mean involved): ${withPremium
        .map((c) => `${c.name} ${c.avgPremiumPct >= 0 ? "+" : ""}${c.avgPremiumPct}% (dearest on ${c.dearestItems}/${c.itemsCompared} items)`)
        .join("; ")}.`
    );
  }
  if (withoutPremium.length) {
    L.push(
      `- No comparable premium figure yet for: ${withoutPremium.map((c) => c.name).join(", ")} — this chain currently has zero CPI items overlapping the credible-gap set with the other chains, not a zero price difference.`
    );
  }
  const catGaps = data.categoryGaps || [];
  L.push(
    `- Dearest chain by category (weighted average of item gaps by real CPI importance weight${
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
// (with each chain's actual product, or GM of several if the chain carries
// more than one matched brand). Returns the widest-gap items first.
export function getBasketItemGapContext(n = 30) {
  const rows = [...(data.flaggedItems || [])].sort((a, b) => b.gapPct - a.gapPct).slice(0, n);
  const L = [];
  L.push(
    `Per-ITEM cross-chain comparison, standardized to each item's real base unit (a curated reference, e.g. 900G, 1KG, 1.5L — every chain's price is scaled to that unit using its own real pack size, so pack-size differences don't distort the number). When a chain carries multiple matched brands for an item, their prices are combined via geometric mean into a single price for that chain BEFORE comparing; the gap itself is then a plain ratio between the two chains' prices (dearest / cheapest - 1), not geometric-mean-anchored (${(data.items || []).length} items comparable; top ${rows.length} by gap):`
  );
  for (const r of rows) {
    L.push(
      `- ${r.cpi_item} (${r.category}, per ${r.unit}): cheapest ${r.cheapChain} $${r2(r.cheapUnitPrice)}/${r.unit} vs dearest ${r.dearChain} $${r2(r.dearUnitPrice)}/${r.unit} — +${r.gapPct}% (${r.nChains} chains compared).`
    );
  }
  return L.join("\n");
}

// Header-stat summary (median gap, share >=25%) computed across ALL comparable
// basket items (not just the top-N chart rows).
export function getBasketDispersionStats() {
  const gaps = (data.items || []).map((it) => it.gapPct).filter((g) => g != null).sort((a, b) => a - b);
  if (!gaps.length) return { medianGapPct: 0, shareOver25Pct: 0, comparedItems: 0 };
  const medianGapPct = gaps[Math.floor(gaps.length / 2)];
  const shareOver25Pct = Math.round((100 * gaps.filter((g) => g >= 25).length) / gaps.length);
  return { medianGapPct, shareOver25Pct, comparedItems: gaps.length };
}

// Individual PRODUCT-level price points for the graph (kept at product level
// on purpose, distinct from the item-level table — see app/products/page.js).
// Each row is one real matched product's own scaled price, compared against
// the AVERAGE of the item's price at every OTHER active chain (plain ratio;
// no geometric mean in this comparison, even though that other-chain price
// may itself be a GM of several brands at that chain — see the script).
export function getBasketProductDispersion(topN = 20) {
  const itemByCode = new Map((data.items || []).map((it) => [it.code, it]));
  const rows = (data.products || [])
    .map((p) => {
      const it = itemByCode.get(p.code);
      if (!it || !it.unitByChain) return null;
      // Same credible band already applied at item level (10-150%, see
      // scripts/build_basket.py CREDIBLE_GAP_LO/HI): a product whose ITEM is
      // outside that band is very likely a different quality/format tier
      // (e.g. a premium imported brand vs a cheap local one under the same
      // generic CPI item), not a genuine same-product price gap. Confirmed
      // on real data before adding this: a 505% "Mixed spices" gap turned
      // out to be Waitrose imported spice blend vs. local Aoun/Karam El Wadi
      // brands — real prices, not a fair comparison.
      if (it.gapPct == null || it.gapPct < CREDIBLE_GAP_LO || it.gapPct > CREDIBLE_GAP_HI) return null;
      const others = Object.entries(it.unitByChain).filter(([ch]) => ch !== p.chain);
      if (!others.length) return null;
      const otherAvg = others.reduce((s, [, v]) => s + v, 0) / others.length;
      if (!otherAvg || !p.unitPrice) return null;
      const gapPct = Math.round((p.unitPrice / otherAvg - 1) * 100);
      const otherLabel = others.length === 1 ? others[0][0] : "other chains";
      const byChain = { [p.chain]: r2(p.unitPrice), [otherLabel]: r2(otherAvg) };
      const dearChain = p.unitPrice >= otherAvg ? p.chain : otherLabel;
      const cheapChain = p.unitPrice >= otherAvg ? otherLabel : p.chain;
      return {
        item: p.productName,
        cpiItem: p.cpi_item,
        category: p.category,
        unit: p.unit,
        matchSource: p.matchSource,
        byChain,
        dearChain,
        cheapChain,
        gapPct: Math.abs(gapPct),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.gapPct - a.gapPct)
    .slice(0, topN);
  if (!rows.length) {
    logWarn("getBasketProductDispersion(): no products with a valid, credible-band gap were found.");
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
      nProductsByChain: it.nProductsByChain || {},
      matchSource: it.matchSource,
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
    categoryGaps: getCategoryGaps(), // only categories with real data -- zero-item ones are dropped upstream
    items, // top-N outlier items, per-unit
  };
}
