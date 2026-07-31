// ─── CPI-basket retail prices — accessors ────────────────────────────────────
// Backed by data/basket_prices.json, built from per-chain basket exports in
// data/baskets/ by scripts/build_basket.py. This is the portal's repeatable,
// Excel/CSV-fed price feed (drop a dated export in data/baskets/ and re-run the
// script). Chains are scraped on different days, so the "current" figures take
// each chain's most recent date — cross-sectional, with a `trend` series that
// grows as more dated files are added.

import data from "@/data/basket_prices.json";

export const BASKET = data;

// ── Size normalization ───────────────────────────────────────────────────────
// The raw feed is price-per-listed-product, so a chain's 900g pack can't be
// compared to another's 500g pack directly. We parse the size (+ pack multiplier)
// from each chain's product name and normalize to a common unit — $/100g,
// $/100ml, or $/piece — so cross-chain comparisons are apples-to-apples.
const r2 = (x) => Math.round(x * 100) / 100;

// Build the apples-to-apples layer once from the build-computed per-unit prices:
// per-item unit prices by chain, plus chain- and category-level rollups.
function computeNormalized() {
  const items = [];
  for (const it of data.items || []) {
    // Common-unit prices computed in the build (scripts/build_basket.py) from
    // each chain's actual weight — apples-to-apples, no pack-size mixing.
    const ubc = it.unitByChain || {};
    const comp = Object.entries(ubc)
      .filter(([, up]) => up > 0)
      .map(([ch, up]) => ({ ch, unitPrice: up, product: it.byChain?.[ch]?.product || "", price: it.byChain?.[ch]?.price }));
    if (comp.length < 2) continue;
    comp.sort((a, b) => a.unitPrice - b.unitPrice);
    const cheap = comp[0];
    const dear = comp[comp.length - 1];
    if (!(cheap.unitPrice > 0)) continue;
    const gap = Math.round((dear.unitPrice / cheap.unitPrice - 1) * 100);
    items.push({ item: it.cpi_item, category: it.category, unit: it.unit || "unit", comp, cheap, dear, gap });
  }

  // Coherence window: an extreme per-unit gap on a CPI item almost always means
  // the chains stock different-grade products (e.g. truffle vs regular oil) or a
  // bulk-vs-retail format — not a like-for-like markup. Flag the credible band.
  const flagged = items.filter((ni) => ni.gap >= 10 && ni.gap <= 150);

  const cAgg = {};
  for (const ni of flagged) {
    const base = ni.cheap.unitPrice;
    ni.comp.forEach((p) => {
      const a = cAgg[p.ch] || (cAgg[p.ch] = { items: 0, dearest: 0, premSum: 0 });
      a.items++;
      a.premSum += p.unitPrice / base - 1;
    });
    const d = cAgg[ni.dear.ch];
    if (d) d.dearest++;
  }
  const chains = Object.entries(cAgg)
    .map(([name, a]) => ({ name, itemsCompared: a.items, dearestItems: a.dearest, avgPremiumPct: a.items ? Math.round((a.premSum / a.items) * 100) : 0 }))
    .sort((x, y) => y.avgPremiumPct - x.avgPremiumPct || y.dearestItems - x.dearestItems);

  const catMap = {};
  for (const ni of flagged) {
    const c = catMap[ni.category] || (catMap[ni.category] = { dear: {}, cheap: {}, gaps: [] });
    c.dear[ni.dear.ch] = (c.dear[ni.dear.ch] || 0) + 1;
    c.cheap[ni.cheap.ch] = (c.cheap[ni.cheap.ch] || 0) + 1;
    c.gaps.push(ni.gap);
  }
  const categories = Object.entries(catMap)
    .map(([category, c]) => {
      const dearest = Object.entries(c.dear).sort((a, b) => b[1] - a[1])[0][0];
      const cheapest = Object.entries(c.cheap).sort((a, b) => b[1] - a[1])[0][0];
      const g = [...c.gaps].sort((a, b) => a - b);
      return { category, dearest, cheapest, gap: g[Math.floor(g.length / 2)], nItems: c.gaps.length };
    })
    .filter((c) => c.nItems >= 2)
    .sort((a, b) => b.gap - a.gap);

  return { items: flagged, chains, categories, comparedItems: flagged.length, totalCats: categories.length };
}

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

// Chain-level context — the ONE dataset where naming chains is allowed, because
// these are real scraped prices tagged to named chains (Carrefour, Spinneys,
// Tawfeer). Lets the advisor answer "which supermarket is driving high prices".
export function getBasketChainContext() {
  const k = data.kpis;
  const cd = data.meta?.chainDates
    ? " (" + Object.entries(data.meta.chainDates).map(([c, d]) => `${c} ${d}`).join(", ") + ")"
    : "";
  const L = [];
  L.push(
    `Cross-chain CPI basket — REAL scraped shelf prices tagged to NAMED chains; as of ${k.latestDate}; USD; cross-sectional (chains scraped on differing days${cd}, so compare levels, not a single-day cut):`
  );
  L.push(
    `- Chain price level (median basket item): ${data.chains
      .map((c) => `${c.name} $${c.medianPrice} (mean $${c.meanPrice}, ${c.inStockRate}% in stock, ${c.items} items)`)
      .join("; ")}.`
  );
  const nm = computeNormalized();
  L.push(
    `- SIZE-NORMALIZED chain premium (avg $/unit vs the cheapest chain on the SAME item — apples-to-apples, across ${nm.comparedItems} comparable items): ${nm.chains
      .map((c) => `${c.name} +${c.avgPremiumPct}% (dearest on ${c.dearestItems}/${c.itemsCompared} items)`)
      .join("; ")}.`
  );
  L.push(
    `- Dearest chain by category (size-normalized; widest median per-unit gap first): ${[...nm.categories]
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8)
      .map((c) => `${c.category}: dearest ${c.dearest} vs cheapest ${c.cheapest} (median +${c.gap}% per unit, ${c.nItems} items)`)
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
  const nm = computeNormalized();
  const rows = [...nm.items].sort((a, b) => b.gap - a.gap).slice(0, n);
  const L = [];
  L.push(
    `Per-ITEM cross-chain comparison, SIZE-NORMALIZED to a common unit ($/100g, $/100ml or $/piece) so it is apples-to-apples (${nm.comparedItems} items comparable; top ${rows.length} by per-unit gap). These are per-unit prices, NOT pack prices:`
  );
  for (const r of rows) {
    L.push(
      `- ${r.item} (${r.category}, per ${r.unit}): cheapest ${r.cheap.ch} $${r2(r.cheap.unitPrice)}/${r.unit} [${r.cheap.product}] vs dearest ${r.dear.ch} $${r2(r.dear.unitPrice)}/${r.unit} [${r.dear.product}] — +${r.gap}% per unit${r.comp.length < 3 ? ` (only ${r.comp.length} of 3 chains size-comparable)` : ""}.`
    );
  }
  return L.join("\n");
}

// ── Forensic "Inspection Watch" ──────────────────────────────────────────────
// Statistical flags for a Ministry price unit: which chains, categories and
// items sit far above peers and are worth a closer look. Risk indicators for
// prioritising review — NOT findings of wrongdoing.
export function getForensicWatch({ topCats = 6, topItems = 10 } = {}) {
  const nm = computeNormalized();
  const items = [...nm.items]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, topItems)
    .map((ni) => ({
      item: ni.item,
      category: ni.category,
      unit: ni.unit,
      dearCh: ni.dear.ch,
      dearP: r2(ni.dear.unitPrice),
      cheapCh: ni.cheap.ch,
      cheapP: r2(ni.cheap.unitPrice),
      gap: ni.gap,
      nChains: ni.comp.length,
    }));
  return {
    asOf: data.kpis?.latestDate,
    chainDates: data.meta?.chainDates || null,
    totalCats: nm.totalCats,
    comparedItems: nm.comparedItems,
    chains: nm.chains, // { name, itemsCompared, dearestItems, avgPremiumPct }
    categories: nm.categories.slice(0, topCats), // { category, dearest, cheapest, gap(medianPerUnit), nItems }
    items, // per-unit
  };
}
