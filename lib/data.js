// ─── Lebanon Prices Intelligence Unit — mock dataset ────────────────────────
// Illustrative Lebanese price data. Deterministic (no randomness) so server and
// client render identically. Swap these functions for a real API/DB later —
// the rest of the app only consumes the exported helpers below.

export const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export const USD_RATE = 89500; // LBP per USD (illustrative market rate)

export const CATEGORIES = ["Grains", "Dairy", "Produce", "Oils", "Beverages", "Hygiene", "Cleaning", "Fuel"];

// Seeded series generator: smooth upward drift with mild noise, deterministic.
function series(base, driftPct, seed) {
  const out = [];
  let v = base;
  for (let i = 0; i < 12; i++) {
    const wobble = Math.sin((i + seed) * 1.3) * (base * 0.012);
    v = v * (1 + driftPct / 100) + wobble;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

// ─── Products ───────────────────────────────────────────────────────────────
// retail = typical online retail price (USD), wholesale = bulk/distributor price.
const RAW = [
  ["sunflower-oil-1l", "Sunflower oil 1L", "Oils", "1 L", 3.18, 2.55, "SpinneysOnline", 1.4, 22],
  ["basmati-rice-5kg", "Basmati rice 5kg", "Grains", "5 kg", 9.20, 7.40, "Mira Wholesale", -1.1, 80],
  ["white-rice-1kg", "White rice 1kg", "Grains", "1 kg", 1.85, 1.45, "Carrefour LB", 2.1, 110],
  ["powdered-milk-900g", "Powdered milk 900g", "Dairy", "900 g", 9.95, 8.10, "Carrefour LB", 0.7, 60],
  ["fresh-milk-1l", "Fresh milk 1L", "Dairy", "1 L", 1.95, 1.55, "TSC Signature", 0.5, 95],
  ["white-sugar-1kg", "White sugar 1kg", "Grains", "1 kg", 1.20, 0.92, "Beirut Traders", -0.8, 130],
  ["sugar-50kg", "White sugar 50kg", "Grains", "50 kg", 48.0, 41.0, "Beirut Traders", 2.3, 35],
  ["pasta-500g", "Pasta 500g", "Grains", "500 g", 0.78, 0.58, "TSC Signature", -2.0, 140],
  ["tomato-paste-case", "Tomato paste 24×", "Produce", "24 × 70g", 14.2, 11.6, "Zaatar Distrib.", 1.5, 28],
  ["tomatoes-1kg", "Tomatoes 1kg", "Produce", "1 kg", 1.45, 1.05, "Souk al-Tayeb", -3.1, 120],
  ["potatoes-1kg", "Potatoes 1kg", "Produce", "1 kg", 0.95, 0.70, "Mira Wholesale", 0.9, 100],
  ["eggs-30", "Eggs (tray of 30)", "Produce", "30 pcs", 5.10, 4.20, "Carrefour LB", -1.2, 88],
  ["chicken-1kg", "Chicken 1kg", "Produce", "1 kg", 4.10, 3.35, "Fresh Co.", 1.7, 90],
  ["lentils-1kg", "Red lentils 1kg", "Grains", "1 kg", 2.30, 1.80, "Mira Wholesale", -0.4, 70],
  ["coffee-200g", "Ground coffee 200g", "Beverages", "200 g", 4.75, 3.90, "Cafe Najjar Shop", 2.9, 55],
  ["tea-100bags", "Black tea 100 bags", "Beverages", "100 bags", 3.40, 2.70, "Spinneys", 0.6, 48],
  ["water-1.5l-6", "Water 1.5L ×6", "Beverages", "6 × 1.5 L", 2.60, 2.00, "Sohat Direct", 0.3, 75],
  ["soft-drink-2l", "Cola 2L", "Beverages", "2 L", 1.70, 1.30, "Carrefour LB", 1.1, 82],
  ["detergent-3l", "Liquid detergent 3L", "Cleaning", "3 L", 6.20, 4.95, "Clean House", 0.9, 44],
  ["dish-soap-1l", "Dish soap 1L", "Cleaning", "1 L", 2.10, 1.60, "Clean House", 1.3, 52],
  ["shampoo-400ml", "Shampoo 400ml", "Hygiene", "400 ml", 4.50, 3.50, "Pharmacy Plus", 0.4, 40],
  ["diapers-pack", "Diapers (pack of 40)", "Hygiene", "40 pcs", 11.80, 9.60, "BabyShop LB", 2.6, 33],
  ["toilet-paper-12", "Toilet paper ×12", "Hygiene", "12 rolls", 5.40, 4.20, "Spinneys", 0.8, 50],
  ["bread-bundle", "Arabic bread bundle", "Grains", "bundle", 0.92, 0.74, "Wooden Bakery", 1.4, 160],
  ["diesel-20l", "Diesel 20L", "Fuel", "20 L", 18.60, 17.20, "Energy Co.", 4.1, 30],
  ["gas-canister", "Gas canister (10kg)", "Fuel", "10 kg", 14.30, 13.10, "Energy Co.", 3.6, 38],
];

let _seed = 1;
export const PRODUCTS = RAW.map(([id, name, category, unit, retail, wholesale, store, change7d, seedBase]) => {
  const hist = series(retail * 0.78, 1.7, (_seed += 1) + seedBase * 0.01);
  // ensure the last history point matches current retail
  const adj = retail / hist[hist.length - 1];
  const history = hist.map((v) => Math.round(v * adj * 100) / 100);
  return {
    id, name, category, unit, store,
    retail, wholesale,
    change7d,
    markupPct: Math.round(((retail - wholesale) / wholesale) * 1000) / 10,
    type: "Retail",
    history, // 12 monthly USD points
  };
});

// ─── Derived analytics ────────────────────────────────────────────────────────
export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

export function searchProducts(q = "", category = "All") {
  const s = q.trim().toLowerCase();
  return PRODUCTS.filter((p) => {
    const okCat = category === "All" || p.category === category;
    const okQ = !s || p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
    return okCat && okQ;
  });
}

// Basket index = normalized average of a representative basket, indexed to 100 at month 0.
export function getBasketIndex() {
  const basket = PRODUCTS.slice(0, 14);
  const sums = MONTHS.map((_, i) => basket.reduce((a, p) => a + p.history[i], 0));
  const base = sums[0];
  return MONTHS.map((m, i) => ({ name: m, index: Math.round((sums[i] / base) * 1000) / 10 }));
}

// Category trend, three headline categories, indexed to 100.
export function getCategoryTrend() {
  const pick = (cat) => PRODUCTS.filter((p) => p.category === cat);
  const idx = (prods) => {
    const sums = MONTHS.map((_, i) => prods.reduce((a, p) => a + p.history[i], 0));
    const base = sums[0] || 1;
    return MONTHS.map((_, i) => Math.round((sums[i] / base) * 1000) / 10);
  };
  const food = idx([...pick("Grains"), ...pick("Dairy"), ...pick("Produce")]);
  const fuel = idx(pick("Fuel"));
  const hygiene = idx(pick("Hygiene"));
  return MONTHS.map((m, i) => ({ name: m, Food: food[i], Fuel: fuel[i], Hygiene: hygiene[i] }));
}

// Average retail-vs-wholesale markup per category.
export function getMarkupByCategory() {
  const out = {};
  for (const p of PRODUCTS) {
    (out[p.category] ||= []).push(p.markupPct);
  }
  return Object.entries(out)
    .map(([name, arr]) => ({ name, markup: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 }))
    .sort((a, b) => b.markup - a.markup);
}

// Category-level month-over-month inflation, for a pie / breakdown.
export function getCategoryInflation() {
  const trend = {};
  for (const p of PRODUCTS) {
    const arr = (trend[p.category] ||= [0, 0]);
    arr[0] += p.history[p.history.length - 2];
    arr[1] += p.history[p.history.length - 1];
  }
  return Object.entries(trend)
    .map(([name, [prev, now]]) => ({ name, value: Math.round(((now - prev) / prev) * 1000) / 10 }))
    .sort((a, b) => b.value - a.value);
}

// Cheapest-source / top-movers table rows.
export function getTopMovers(n = 8) {
  return [...PRODUCTS]
    .sort((a, b) => Math.abs(b.change7d) - Math.abs(a.change7d))
    .slice(0, n)
    .map((p) => ({
      id: p.id, name: p.name, price: p.wholesale < p.retail ? p.wholesale : p.retail,
      store: p.store, type: p.markupPct > 25 ? "Wholesale" : "Retail",
      change7d: p.change7d,
    }));
}

export function getTicker() {
  return PRODUCTS.slice(0, 14).map((p) => ({
    name: p.name, price: p.retail, change: p.change7d,
  }));
}

export function getKPIs() {
  const basket = getBasketIndex();
  const last = basket[basket.length - 1].index;
  const prev = basket[basket.length - 2].index;
  const avgBasketUsd = Math.round(PRODUCTS.slice(0, 14).reduce((a, p) => a + p.retail, 0) * 100) / 100;
  return {
    basketIndex: last,
    basketChangeMoM: Math.round((last - prev) * 10) / 10,
    avgBasketUsd,
    productsTracked: 42318,
    productsToday: 612,
    usdRate: USD_RATE,
    storesMonitored: 320,
  };
}

// Compact, model-friendly context string handed to the AI advisor.
export function getDataContext() {
  const k = getKPIs();
  const inflation = getCategoryInflation();
  const markup = getMarkupByCategory();
  const movers = getTopMovers(8);
  const lines = [];
  lines.push(`Snapshot (illustrative demo data, USD unless noted; market rate ${k.usdRate} LBP/USD):`);
  lines.push(`- National food-basket index: ${k.basketIndex} (${k.basketChangeMoM >= 0 ? "+" : ""}${k.basketChangeMoM} MoM)`);
  lines.push(`- Avg representative basket: $${k.avgBasketUsd}; ${k.productsTracked} products across ${k.storesMonitored} stores.`);
  lines.push(`Category MoM inflation %: ${inflation.map((c) => `${c.name} ${c.value >= 0 ? "+" : ""}${c.value}%`).join(", ")}.`);
  lines.push(`Avg retail-vs-wholesale markup %: ${markup.map((c) => `${c.name} ${c.markup}%`).join(", ")}.`);
  lines.push(`Notable 7-day movers: ${movers.map((m) => `${m.name} ${m.change7d >= 0 ? "+" : ""}${m.change7d}% (best $${m.price} @ ${m.store})`).join("; ")}.`);
  lines.push(`Tracked products: ${PRODUCTS.map((p) => `${p.name} [${p.category}] retail $${p.retail}/wholesale $${p.wholesale} @ ${p.store}`).join("; ")}.`);
  return lines.join("\n");
}
