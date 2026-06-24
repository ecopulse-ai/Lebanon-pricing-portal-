// ─── Lebanon Non-Core Daily CPI ──────────────────────────────────────────────
// Source: data/NonCoreCPI_Lebanon.csv (daily, base index = 100).
// Keep this array in sync with the CSV (or load the CSV at build time later).

export const CPI_DAILY = [
  { date: "2026-06-16", BreadAndCereals: 98.9, CoffeeTeaCocoa: 100, FishAndSeafood: 98.8, FoodProductsNEC: 100, FruitAndNuts: 97.4, MeatAndPoultry: 100.5, MilkEggsAndMilkProducts: 99.7, SoftDrinksAndJuices: 105.8, OilsAndFats: 98.1, SweetsAndConfectionery: 98.4, Vegetables: 101.2, FoodOverall: 99.7, NonAlcoholicBeverages: 103.7, FoodAndNonAlcoholic: 100, CPI: 100, PercentChange: 0, GasCPI: 100 },
  { date: "2026-06-17", BreadAndCereals: 98.8, CoffeeTeaCocoa: 100, FishAndSeafood: 93.2, FoodProductsNEC: 99.6, FruitAndNuts: 100.1, MeatAndPoultry: 100.5, MilkEggsAndMilkProducts: 99.6, SoftDrinksAndJuices: 104.9, OilsAndFats: 98, SweetsAndConfectionery: 98.6, Vegetables: 100.5, FoodOverall: 99.4, NonAlcoholicBeverages: 103.1, FoodAndNonAlcoholic: 99.8, CPI: 99.8, PercentChange: -0.2, GasCPI: 100 },
  { date: "2026-06-18", BreadAndCereals: 100.2, CoffeeTeaCocoa: 100, FishAndSeafood: 99.8, FoodProductsNEC: 100.3, FruitAndNuts: 101.5, MeatAndPoultry: 101, MilkEggsAndMilkProducts: 100.2, SoftDrinksAndJuices: 98.2, OilsAndFats: 101.5, SweetsAndConfectionery: 100.4, Vegetables: 102, FoodOverall: 100.8, NonAlcoholicBeverages: 98.9, FoodAndNonAlcoholic: 100.7, CPI: 100.6, PercentChange: 0.8, GasCPI: 100 },
  { date: "2026-06-19", BreadAndCereals: 100.3, CoffeeTeaCocoa: 100, FishAndSeafood: 102.7, FoodProductsNEC: 100.3, FruitAndNuts: 100.3, MeatAndPoultry: 99.8, MilkEggsAndMilkProducts: 100.2, SoftDrinksAndJuices: 98.3, OilsAndFats: 100.6, SweetsAndConfectionery: 100.4, Vegetables: 99.3, FoodOverall: 100.2, NonAlcoholicBeverages: 98.9, FoodAndNonAlcoholic: 100.1, CPI: 99.8, PercentChange: -0.8, GasCPI: 98.4 },
  { date: "2026-06-20", BreadAndCereals: 100.4, CoffeeTeaCocoa: 100, FishAndSeafood: 102.6, FoodProductsNEC: 100.3, FruitAndNuts: 101.3, MeatAndPoultry: 99.5, MilkEggsAndMilkProducts: 100.1, SoftDrinksAndJuices: 98.3, OilsAndFats: 100.6, SweetsAndConfectionery: 100.4, Vegetables: 99.9, FoodOverall: 100.2, NonAlcoholicBeverages: 98.9, FoodAndNonAlcoholic: 100.1, CPI: 99.8, PercentChange: 0, GasCPI: 98.4 },
  { date: "2026-06-21", BreadAndCereals: 100.4, CoffeeTeaCocoa: 100, FishAndSeafood: 102.6, FoodProductsNEC: 100.3, FruitAndNuts: 100.8, MeatAndPoultry: 99.5, MilkEggsAndMilkProducts: 100.1, SoftDrinksAndJuices: 98.3, OilsAndFats: 100.9, SweetsAndConfectionery: 100.4, Vegetables: 100, FoodOverall: 100.2, NonAlcoholicBeverages: 98.9, FoodAndNonAlcoholic: 100, CPI: 99.8, PercentChange: 0, GasCPI: 98.4 },
  { date: "2026-06-22", BreadAndCereals: 101.3, CoffeeTeaCocoa: 100, FishAndSeafood: 102.7, FoodProductsNEC: 100.3, FruitAndNuts: 99.7, MeatAndPoultry: 99.5, MilkEggsAndMilkProducts: 100.1, SoftDrinksAndJuices: 98.3, OilsAndFats: 100.9, SweetsAndConfectionery: 101.6, Vegetables: 98.1, FoodOverall: 100.1, NonAlcoholicBeverages: 98.9, FoodAndNonAlcoholic: 100, CPI: 99.7, PercentChange: -0.1, GasCPI: 98.4 },
  { date: "2026-06-23", BreadAndCereals: 101.3, CoffeeTeaCocoa: 100, FishAndSeafood: 109.3, FoodProductsNEC: 100.6, FruitAndNuts: 102.1, MeatAndPoultry: 101.3, MilkEggsAndMilkProducts: 100.1, SoftDrinksAndJuices: 98.3, OilsAndFats: 100.8, SweetsAndConfectionery: 101.6, Vegetables: 99.9, FoodOverall: 101.6, NonAlcoholicBeverages: 98.9, FoodAndNonAlcoholic: 101.4, CPI: 100.7, PercentChange: 1, GasCPI: 97.2 },
];

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
