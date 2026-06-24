// ─── Lebanon Non-Core Daily CPI ──────────────────────────────────────────────
// Source of truth: data/NonCoreCPI_Lebanon.csv (daily, base index = 100).
// Built into data/cpi_daily.json by scripts/build_cpi.py — re-run that after
// updating the CSV. No hand-synced array to drift.

import CPI_DAILY from "@/data/cpi_daily.json";

export { CPI_DAILY };

// 11 non-core food subcategories that make up the basket.
export const FOOD_CATS = [
  "BreadAndCereals", "CoffeeTeaCocoa", "FishAndSeafood", "FoodProductsNEC",
  "FruitAndNuts", "MeatAndPoultry", "MilkEggsAndMilkProducts",
  "SoftDrinksAndJuices", "OilsAndFats", "SweetsAndConfectionery", "Vegetables",
];

// Aggregates / headline series.
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

export function getChartData() {
  return CPI_DAILY.map((d) => ({ ...d, label: fmtLabel(d.date) }));
}

const pct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

export function getCpiSummary() {
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

// Latest snapshot: every food category's current index + day-over-day change,
// sorted by deviation from the 100 base.
export function getLatestSnapshot() {
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

export function getSparkline(key, n = 30) {
  return CPI_DAILY.slice(-n).map((d) => d[key]);
}

// Compact context for the AI advisor.
export function getCpiContext() {
  const s = getCpiSummary();
  const snap = getLatestSnapshot();
  const lines = [];
  lines.push(`Lebanon Non-Core Daily CPI (base index = 100; ${s.firstDate} → ${s.lastDate}, ${s.days} daily readings):`);
  lines.push(`- Headline CPI: ${s.cpi} (${s.cpiDoD >= 0 ? "+" : ""}${s.cpiDoD}% day-over-day).`);
  lines.push(`- Food Overall: ${s.foodOverall} (${s.foodDoD >= 0 ? "+" : ""}${s.foodDoD}% DoD); Food & Non-Alcoholic: ${s.foodAndNonAlc}; Gas CPI: ${s.gas} (${s.gasDoD >= 0 ? "+" : ""}${s.gasDoD}% DoD).`);
  lines.push(`- Highest category: ${s.highest.name} (${s.highest.value}); fastest rising: ${s.fastestRising.name} (${s.fastestRising.value >= 0 ? "+" : ""}${s.fastestRising.value}% DoD).`);
  lines.push(`Latest category index [dev vs 100, DoD%]: ${snap.map((c) => `${c.name} ${c.value} [${c.dev >= 0 ? "+" : ""}${c.dev}, ${c.dod >= 0 ? "+" : ""}${c.dod}%]`).join("; ")}.`);
  return lines.join("\n");
}
