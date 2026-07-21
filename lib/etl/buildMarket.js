// JS port of scripts/build_snapshot.py (both halves: the retail snapshot and
// the trade-dependency section). Operates on an in-memory array of
// standardized rows instead of reading standardized_master_enriched.csv.
//
// NOTE: the old file covered four chains (Al-Makhazen, Promarche, Carrefour,
// Spinneys). Carrefour isn't one of the three sources wired up here — the
// "retailers" count in the output will read 3, not 4, until/unless a fourth
// source is added back.

import { canonCategory, titleBrand } from "./categories";

const ROUTE = {
  "Türkiye": { bloc: "Türkiye", route: "Direct East Med", choke: [] },
  Egypt: { bloc: "MENA", route: "Direct East Med", choke: [] },
  France: { bloc: "Europe & UK", route: "Across Mediterranean", choke: [] },
  Ireland: { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  "United Kingdom": { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Belgium: { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Netherlands: { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Germany: { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Denmark: { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Italy: { bloc: "Europe & UK", route: "Across Mediterranean", choke: [] },
  Czechia: { bloc: "Europe & UK", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Hungary: { bloc: "Europe & UK", route: "Adriatic → Med", choke: [] },
  Romania: { bloc: "Europe & UK", route: "Black Sea → Bosphorus", choke: ["Bosphorus"] },
  Ukraine: { bloc: "Europe & UK", route: "Black Sea → Bosphorus", choke: ["Bosphorus"] },
  Morocco: { bloc: "MENA", route: "Across Mediterranean", choke: [] },
  "United States": { bloc: "Americas", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  Brazil: { bloc: "Americas", route: "Atlantic → Gibraltar", choke: ["Gibraltar"] },
  "Saudi Arabia": { bloc: "Gulf & Asia", route: "Red Sea → Suez", choke: ["Suez"] },
  Iraq: { bloc: "Gulf & Asia", route: "Gulf → Hormuz → Suez", choke: ["Hormuz", "Bab-el-Mandeb", "Suez"] },
  Oman: { bloc: "Gulf & Asia", route: "Hormuz → Suez", choke: ["Hormuz", "Bab-el-Mandeb", "Suez"] },
  India: { bloc: "Gulf & Asia", route: "Arabian Sea → Suez", choke: ["Bab-el-Mandeb", "Suez"] },
  "Sri Lanka": { bloc: "Gulf & Asia", route: "Indian Ocean → Suez", choke: ["Bab-el-Mandeb", "Suez"] },
  Thailand: { bloc: "Gulf & Asia", route: "Malacca → Suez", choke: ["Malacca", "Bab-el-Mandeb", "Suez"] },
  China: { bloc: "Gulf & Asia", route: "Malacca → Suez", choke: ["Malacca", "Bab-el-Mandeb", "Suez"] },
};
const DEFAULT_ROUTE = { bloc: "Other", route: "Across Mediterranean", choke: [] };
const routeOf = (c) => ROUTE[c] || DEFAULT_ROUTE;

const BAND_ORDER = ["<$1", "$1–2", "$2–5", "$5–10", "$10–20", "$20+"];
function bandOf(p) {
  if (p < 1) return "<$1";
  if (p < 2) return "$1–2";
  if (p < 5) return "$2–5";
  if (p < 10) return "$5–10";
  if (p < 20) return "$10–20";
  return "$20+";
}

function round2(x) {
  return Math.round(x * 100) / 100;
}
function med(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const mid = Math.floor(n / 2);
  return round2(n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}
function mean(xs) {
  if (!xs.length) return 0;
  return round2(xs.reduce((a, b) => a + b, 0) / xs.length);
}
function inc(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}
function pct(part, whole) {
  return whole ? round2((100 * part) / whole) : 0;
}

export function buildMarket(rows) {
  let n = 0;
  const dates = new Set();
  const retailers = new Map(); // name -> {n, prices, instock}
  const catN = new Map();
  const catPrices = new Map();
  const catRetPrices = new Map(); // cat -> retailer -> prices[]
  const origins = new Map();
  let originRows = 0;
  const brands = new Map();
  const allPrices = [];
  const bands = new Map();
  const rawCats = new Set();
  const catOrigin = new Map(); // cat -> origin -> count

  for (const row of rows) {
    n++;
    rawCats.add(row.category_top);
    if (row.date) dates.add(row.date);
    const ret = row.retailer;
    const c = canonCategory(row.category_top);

    if (!retailers.has(ret)) retailers.set(ret, { n: 0, prices: [], instock: 0 });
    const rd = retailers.get(ret);
    rd.n++;
    if (row.in_stock) rd.instock++;

    inc(catN, c);

    const p = row.price_usd;
    if (typeof p === "number" && p > 0) {
      rd.prices.push(p);
      if (!catPrices.has(c)) catPrices.set(c, []);
      catPrices.get(c).push(p);
      if (!catRetPrices.has(c)) catRetPrices.set(c, new Map());
      const cr = catRetPrices.get(c);
      if (!cr.has(ret)) cr.set(ret, []);
      cr.get(ret).push(p);
      allPrices.push(p);
      inc(bands, bandOf(p));
    }

    const o = (row.origin_probable || "").trim();
    if (o) {
      inc(origins, o);
      originRows++;
      if (!catOrigin.has(c)) catOrigin.set(c, new Map());
      inc(catOrigin.get(c), o);
    }

    const b = titleBrand(row.brand);
    if (b) inc(brands, b);
  }

  const nIn = [...retailers.values()].reduce((a, d) => a + d.instock, 0);

  const retList = [...retailers.entries()]
    .map(([name, v]) => ({
      name,
      products: v.n,
      medianPrice: med(v.prices),
      meanPrice: mean(v.prices),
      inStockRate: pct(v.instock, v.n),
    }))
    .sort((a, b) => b.products - a.products);

  const catList = [...catN.entries()]
    .map(([name, count]) => ({
      name,
      products: count,
      sharePct: pct(count, n),
      medianPrice: med(catPrices.get(name) || []),
    }))
    .sort((a, b) => b.products - a.products);

  // Cheapest chain per category — only where ≥2 chains carry ≥30 items.
  const cheapest = [];
  for (const c of catList) {
    const cr = catRetPrices.get(c.name);
    if (!cr) continue;
    const per = {};
    for (const [ret, prices] of cr) if (prices.length >= 30) per[ret] = med(prices);
    const keys = Object.keys(per);
    if (keys.length >= 2) {
      const winner = keys.reduce((a, b) => (per[a] < per[b] ? a : b));
      const dearest = keys.reduce((a, b) => (per[a] > per[b] ? a : b));
      cheapest.push({
        category: c.name,
        cheapest: winner,
        cheapestPrice: per[winner],
        dearest,
        dearestPrice: per[dearest],
        spreadPct: Math.round((100 * (per[dearest] - per[winner])) / per[winner]),
        byRetailer: per,
      });
    }
  }
  cheapest.sort((a, b) => b.spreadPct - a.spreadPct);

  const ORIGIN_TOP = 12;
  const originSorted = [...origins.entries()].sort((a, b) => b[1] - a[1]);
  const originCommon = originSorted.slice(0, ORIGIN_TOP);
  const originList = originCommon.map(([name, v]) => ({ name, products: v, sharePct: pct(v, originRows) }));
  const other = originRows - originCommon.reduce((a, [, v]) => a + v, 0);
  if (other > 0) originList.push({ name: "Other countries", products: other, sharePct: pct(other, originRows) });

  const meta = {
    source: "live: Promarche + Al-Makhazen + Spinneys (Azure Data Lake, daily)",
    snapshotDates: [...dates].sort(),
    rows: n,
    rawCategories: rawCats.size,
    currency: "USD",
    note:
      "Cross-sectional shelf snapshot across three Lebanese chains, refreshed " +
      "daily from Azure Data Lake. Chains are scraped independently, so " +
      "figures are positional (price level, availability, sourcing) — not a " +
      "time series.",
  };

  const snapshot = {
    meta,
    kpis: {
      products: n,
      retailers: retailers.size,
      categories: catN.size,
      originCountries: origins.size,
      medianPrice: med(allPrices),
      meanPrice: mean(allPrices),
      inStockRate: pct(nIn, n),
      tracedToOriginPct: pct(originRows, n),
    },
    retailers: retList,
    categories: catList,
    cheapestByCategory: cheapest,
    origins: originList,
    priceBands: BAND_ORDER.filter((b) => bands.get(b)).map((b) => ({
      name: b,
      count: bands.get(b),
      sharePct: pct(bands.get(b), [...bands.values()].reduce((a, x) => a + x, 0)),
    })),
    topBrands: [...brands.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, products]) => ({ name, products })),
  };

  // ── Trade dependency ─────────────────────────────────────────────────────
  const depCats = [];
  for (const c of catList) {
    const dist = catOrigin.get(c.name);
    if (!dist) continue;
    const total = [...dist.values()].reduce((a, b) => a + b, 0);
    if (total < 50) continue; // too thin to characterize sourcing
    const top3 = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const [lead, leadN] = top3[0];
    depCats.push({
      name: c.name,
      tracedItems: total,
      topSource: lead,
      topShare: pct(leadN, total),
      top3: top3.map(([name, v]) => ({ name, sharePct: pct(v, total) })),
      medianPrice: c.medianPrice,
    });
  }
  depCats.sort((a, b) => b.topShare - a.topShare);

  const countries = [];
  for (const [country, totalC] of originSorted) {
    if (totalC < 200) continue;
    const r = routeOf(country);
    const supplies = [];
    for (const [name, dist] of catOrigin) {
      const cnt = dist.get(country) || 0;
      const catTotal = [...dist.values()].reduce((a, b) => a + b, 0);
      if (cnt >= 25 && catTotal) {
        supplies.push({ category: name, items: cnt, gripPct: pct(cnt, catTotal) });
      }
    }
    supplies.sort((a, b) => b.items - a.items);
    const dominant = supplies.filter((s) => s.gripPct >= 50).length;
    const monopolies = supplies.filter((s) => s.gripPct >= 80).length;
    countries.push({
      name: country,
      products: totalC,
      sharePct: pct(totalC, originRows),
      bloc: r.bloc,
      route: r.route,
      chokepoints: r.choke,
      dominantCategories: dominant,
      monopolyCategories: monopolies,
      supplies: supplies.slice(0, 14),
    });
  }

  const blocCounter = new Map();
  const chokeCounter = new Map();
  for (const [country, cnt] of origins) {
    const r = routeOf(country);
    inc(blocCounter, r.bloc, cnt);
    for (const ch of r.choke) inc(chokeCounter, ch, cnt);
  }
  const blocList = [...blocCounter.entries()]
    .map(([name, v]) => ({ name, products: v, sharePct: pct(v, originRows) }))
    .sort((a, b) => b.products - a.products);
  const chokeList = [...chokeCounter.entries()]
    .map(([name, v]) => ({ name, products: v, sharePct: pct(v, originRows) }))
    .sort((a, b) => b.products - a.products);

  const [leadCountry, leadN] = originSorted[0] || ["", 0];

  const trade = {
    meta,
    totals: {
      tracedItems: originRows,
      tracedPct: snapshot.kpis.tracedToOriginPct,
      countries: origins.size,
      categories: depCats.length,
      topSupplier: leadCountry,
      topSupplierShare: pct(leadN, originRows),
      suezSharePct: chokeList.find((x) => x.name === "Suez")?.sharePct || 0,
      concentratedCategories: depCats.filter((c) => c.topShare >= 50).length,
    },
    categories: depCats,
    countries,
    blocs: blocList,
    chokepoints: chokeList,
  };

  return { snapshot, trade };
}
