// Ported verbatim (rule order and keywords) from scripts/build_products.py /
// scripts/build_snapshot.py so canonical categories stay identical to the
// static-file era. Keep this file in sync if you tune the rules — it's now
// the single source of truth (no more duplicated python copies).

const RULES = [
  ["Fresh Produce", ["fruit", "vegetable", "produce", "herb", "veg "]],
  ["Meat & Fish", ["meat", "poultry", "chicken", "fish", "shrimp", "cold cut", "deli"]],
  ["Dairy & Eggs", ["dairy", "egg", "cheese", "milk", "creamer", "butter"]],
  ["Bakery", ["bakery", "bread", "cake", "croissant", "baked", "pastr"]],
  ["Frozen", ["frozen", "ice cream"]],
  ["Snacks & Sweets", ["snack", "chocolate", "chip", "cracker", "wafer", "biscuit",
    "candy", "gum", "pop corn", "popcorn", "confection", "nuts", "kernel", "sweet"]],
  ["Beverages", ["beverage", "coffee", "tea", "juice", "water", "drink", "infusion"]],
  ["Alcohol", ["alcohol", "wine", "beer", "spirit"]],
  ["Tobacco", ["tobacco", "tobacoo", "cigar"]],
  ["Baby & Child", ["baby", "child", "diaper"]],
  ["Personal Care & Beauty", ["personal care", "beauty", "shampoo", "bath", "hair",
    "deodorant", "tooth", "soap", "men's care", "women's care", "conditioner",
    "condtioner", "handwash", "wipes", "sanitiz", "cotton", "health & fitness", "fitness"]],
  ["Home & Cleaning", ["home care", "cleaning", "household", "laundry", "detergent",
    "paper", "plastic", "kitchen", "tissue", "napkin", "disinfect", "disposable",
    "dishwash", "surface", "floor", "bathroom", "insecticide", "coal", "gas",
    "battery", "batteries"]],
  ["Pet Care", ["pet", "cat food", "dog"]],
  ["Electronics & Appliances", ["electronic", "appliance", "phone", "automotive", "electric"]],
  ["Grocery & Pantry", ["grocery", "cupboard", "can", "rice", "pasta", "noodle", "sugar",
    "oil", "ghee", "bak", "season", "condiment", "sauce", "spread", "breakfast",
    "cereal", "world food", "grain", "seed", "flour", "soup", "spice", "organic",
    "healthy", "bio", "ramadan", "lebanese coffee"]],
];

const LIFESTYLE = ["toy", "stationery", "school", "fashion", "accessor", "luggage",
  "garden", "outdoor", "kitchenware", "kitchen tools", "kitchen accessor",
  "kitchen supplies", "party"];

export function canonCategory(raw) {
  const s = (raw || "").toLowerCase();
  for (const [name, kws] of RULES) {
    if (kws.some((k) => s.includes(k))) return name;
  }
  if (LIFESTYLE.some((k) => s.includes(k))) return "Home & Living";
  return "Other / Mixed";
}

export function titleBrand(b) {
  const t = (b || "").trim().replace(/\.+$/, "").trim();
  if (!t) return "";
  return t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
