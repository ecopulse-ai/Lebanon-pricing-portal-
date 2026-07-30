// ─── Lebanon Non-Core Daily CPI ──────────────────────────────────────────────
// Source of truth: Azure SQL (dbo.NonCoreCPI_Lebanon / equivalent view),
// served through a keyed Azure Function proxy — see lib/azure/cpi.js and
// /azure-function/cpi_api. No more static data/cpi_daily.json.
//
// FOOD_CATS / AGG_CATS / CATEGORY_LABELS / CATEGORY_COLORS stay as plain
// static exports (used directly by the "use client" CPITrends.jsx component)
// — they're just label metadata, not live data, so no async needed for those.

import { fetchCpiDaily } from "./azure/cpi";
import { fetchCpiAvailability } from "./azure/cpiAvailability";

export const FOOD_CATS = [
  "BreadAndCereals", "CoffeeTeaCocoa", "FishAndSeafood", "FoodProductsNEC",
  "FruitAndNuts", "MeatAndPoultry", "MilkEggsAndMilkProducts",
  "SoftDrinksAndJuices", "OilsAndFats", "SweetsAndConfectionery", "Vegetables",
];

export const AGG_CATS = ["FoodOverall", "NonAlcoholicBeverages", "FoodAndNonAlcoholic", "CPI", "GasCPI"];

export const CATEGORY_LABELS = {
  BreadAndCereals: "Bread & Cereals",
  CoffeeTeaCocoa: "Coffee, Tea & Cocoa",
  FishAndSeafood: "Fish & Seafood",
  FoodProductsNEC: "Food Products n.e.c.",
  FruitAndNuts: "Fruit & Nuts",
  MeatAndPoultry: "Meat & Poultry",
  MilkEggsAndMilkProducts: "Milk, Eggs & Dairy",
  SoftDrinksAndJuices: "Soft Drinks & Juices",
  OilsAndFats: "Oils & Fats",
  SweetsAndConfectionery: "Sweets & Confectionery",
  Vegetables: "Vegetables",
  FoodOverall: "Food Overall",
  NonAlcoholicBeverages: "Non-Alcoholic Beverages",
  FoodAndNonAlcoholic: "Food & Non-Alcoholic",
  CPI: "CPI (overall)",
  GasCPI: "Gas CPI",
};

export const CATEGORY_COLORS = {
  BreadAndCereals: "#9a7b3f",
  CoffeeTeaCocoa: "#6b4a2a",
  FishAndSeafood: "#20655f",
  FoodProductsNEC: "#6b7b70",
  FruitAndNuts: "#2f7a52",
  MeatAndPoultry: "#c2152e",
  MilkEggsAndMilkProducts: "#3b5a7a",
  SoftDrinksAndJuices: "#6b3f5b",
  OilsAndFats: "#8a5a2b",
  SweetsAndConfectionery: "#a23a6a",
  Vegetables: "#1f5c3c",
  FoodOverall: "#184a31",
  NonAlcoholicBeverages: "#0f5a54",
  FoodAndNonAlcoholic: "#445a52",
  CPI: "#122019",
  GasCPI: "#8a6a20",
};

function fmtLabel(date) {
  const [y, m, d] = date.split("-");
  const months = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };
  return `${months[m]} ${parseInt(d, 10)}`;
}

const pct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

export async function getChartData() {
  const CPI_DAILY = await fetchCpiDaily();
  return CPI_DAILY.map((d) => ({ ...d, label: fmtLabel(d.date) }));
}

export async function getCpiSummary() {
  const CPI_DAILY = await fetchCpiDaily();
  const last = CPI_DAILY[CPI_DAILY.length - 1];
  const prev = CPI_DAILY[CPI_DAILY.length - 2] || last;
  const first = CPI_DAILY[0];

  const highestCat = FOOD_CATS.reduce((a, b) => (last[a] > last[b] ? a : b));
  const lowestCat = FOOD_CATS.reduce((a, b) => (last[a] < last[b] ? a : b));
  const fastestCat = FOOD_CATS.reduce((a, b) => (pct(last[a], prev[a]) > pct(last[b], prev[b]) ? a : b));

  return {
    firstDate: first.date,
    lastDate: last.date,
    days: CPI_DAILY.length,
    cpi: last.CPI,
    cpiDoD: round1(pct(last.CPI, prev.CPI)),
    foodOverall: last.FoodOverall,
    foodDoD: round1(pct(last.FoodOverall, prev.FoodOverall)),
    foodAndNonAlc: last.FoodAndNonAlcoholic,
    gas: last.GasCPI,
    gasDoD: round1(pct(last.GasCPI, prev.GasCPI)),
    highest: { key: highestCat, name: CATEGORY_LABELS[highestCat], value: last[highestCat] },
    lowest: { key: lowestCat, name: CATEGORY_LABELS[lowestCat], value: last[lowestCat] },
    fastestRising: { key: fastestCat, name: CATEGORY_LABELS[fastestCat], value: round1(pct(last[fastestCat], prev[fastestCat])) },
  };
}

export async function getLatestSnapshot() {
  const CPI_DAILY = await fetchCpiDaily();
  const last = CPI_DAILY[CPI_DAILY.length - 1];
  const prev = CPI_DAILY[CPI_DAILY.length - 2] || last;
  return FOOD_CATS
    .map((k) => ({
      key: k,
      name: CATEGORY_LABELS[k],
      value: last[k],
      dev: round1(last[k] - 100),
      dod: round1(pct(last[k], prev[k])),
      color: CATEGORY_COLORS[k],
    }))
    .sort((a, b) => b.value - a.value);
}

// Multi-horizon change for one series: day-, week-, and 30-day-over.
function changesFor(CPI_DAILY, key) {
  const n = CPI_DAILY.length;
  const last = CPI_DAILY[n - 1];
  const prev = CPI_DAILY[n - 2] || last;
  const d7 = CPI_DAILY[n - 8] || CPI_DAILY[0];
  const d30 = CPI_DAILY[n - 31] || CPI_DAILY[0];
  return {
    value: last[key],
    dod: round1(pct(last[key], prev[key])),
    wow: round1(pct(last[key], d7[key])),
    m30: round1(pct(last[key], d30[key])),
  };
}

// Headline aggregates with week-over-week and 30-day change (the policymaker
// clock; day-over-day on scraped retail is mostly promo/restock noise).
export async function getCpiHeadline() {
  const CPI_DAILY = await fetchCpiDaily();
  const last = CPI_DAILY[CPI_DAILY.length - 1];
  return {
    lastDate: last.date,
    days: CPI_DAILY.length,
    cpi: changesFor(CPI_DAILY, "CPI"),
    food: changesFor(CPI_DAILY, "FoodOverall"),
    gas: changesFor(CPI_DAILY, "GasCPI"),
  };
}

// One ranked movers table (replaces the deviation chart + category table +
// "highest category" card), sorted by absolute week-over-week move.
export async function getCpiMovers() {
  const CPI_DAILY = await fetchCpiDaily();
  return FOOD_CATS
    .map((k) => {
      const c = changesFor(CPI_DAILY, k);
      return {
        key: k,
        name: CATEGORY_LABELS[k],
        color: CATEGORY_COLORS[k],
        value: c.value,
        dev: round1(c.value - 100),
        dod: c.dod,
        wow: c.wow,
        m30: c.m30,
        spark: CPI_DAILY.slice(-30).map((d) => d[k]),
      };
    })
    .sort((a, b) => Math.abs(b.wow) - Math.abs(a.wow));
}

export async function getSparkline(key, n = 30) {
  const CPI_DAILY = await fetchCpiDaily();
  return CPI_DAILY.slice(-n).map((d) => d[key]);
}

// Compact context for the AI advisor.
export async function getCpiContext() {
  const s = await getCpiSummary();
  const snap = await getLatestSnapshot();
  const lines = [];
  lines.push(`Lebanon Non-Core Daily CPI (base index = 100; ${s.firstDate} → ${s.lastDate}, ${s.days} daily readings):`);
  lines.push(`- Headline CPI: ${s.cpi} (${s.cpiDoD >= 0 ? "+" : ""}${s.cpiDoD}% day-over-day).`);
  lines.push(`- Food Overall: ${s.foodOverall} (${s.foodDoD >= 0 ? "+" : ""}${s.foodDoD}% DoD); Food & Non-Alcoholic: ${s.foodAndNonAlc}; Gas CPI: ${s.gas} (${s.gasDoD >= 0 ? "+" : ""}${s.gasDoD}% DoD).`);
  lines.push(`- Highest category: ${s.highest.name} (${s.highest.value}); fastest rising: ${s.fastestRising.name} (${s.fastestRising.value >= 0 ? "+" : ""}${s.fastestRising.value}% DoD).`);
  lines.push(`Latest category index [dev vs 100, DoD%]: ${snap.map((c) => `${c.name} ${c.value} [${c.dev >= 0 ? "+" : ""}${c.dev}, ${c.dod >= 0 ? "+" : ""}${c.dod}%]`).join("; ")}.`);
  return lines.join("\n");
}

// On-Shelf Availability (Non-Core CPI) — from ProductStockTracker vs Items,
// NOT the same as the all-items Data Lake in-stock rate on /dashboard's other
// KPI cards. See azure-function/availability_api for how this is computed.
export async function getCpiAvailability() {
  return fetchCpiAvailability();
}
