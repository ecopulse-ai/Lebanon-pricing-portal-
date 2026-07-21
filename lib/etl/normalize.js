// ─── Retailer schema normalization ────────────────────────────────────────────
// Maps each retailer's raw CSV columns onto a common "standardized" row shape.
// Nothing here is written to disk; it lives only for the duration of the
// request/build that produced it.
//
// ORIGIN: sourced from brandOrigin.json — a brand → country lookup curated by
// hand (see /docs or ask Omar for the source spreadsheet: brand_origin_lookup.xlsx),
// NOT inferred from a regex over category text. That earlier regex approach was
// replaced because it only fired on rare marketing tags ("Exclusive Imports
// from France") and produced a badly skewed, unreliable picture. Brands not
// yet in brandOrigin.json simply have no origin — shown as "Unknown" — rather
// than a guess. privateLabelBrands.json marks retailer-owned store brands
// (e.g. "Spinneys") which have no country of origin by definition.
//
// To refresh the lookup: edit brand_origin_lookup.xlsx, then regenerate
// brandOrigin.json / privateLabelBrands.json / spinneysSupplementBrands.json
// from it (see scripts/rebuild-brand-origin.md) — no code changes needed.

import { titleBrand } from "./categories";
import brandOrigin from "./brandOrigin.json";
import privateLabelBrandsList from "./privateLabelBrands.json";
import spinneysSupplementBrandsList from "./spinneysSupplementBrands.json";

const PRIVATE_LABEL_BRANDS = new Set(privateLabelBrandsList);

const UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|cl|pcs?)\b/i;
function parseUnitFromText(text) {
  const m = (text || "").match(UNIT_RE);
  return m ? m[2].toLowerCase().replace(/^pc$/, "pcs") : "";
}

function originForBrand(brand) {
  if (!brand) return "";
  if (PRIVATE_LABEL_BRANDS.has(brand)) return ""; // store's own brand — no import origin
  return brandOrigin[brand] || "";
}

function toStandardRow({
  retailer, product_name, brand, category_top, price_usd,
  date, origin_probable, qty_unit_raw, img, in_stock,
}) {
  return {
    product_name: (product_name || "").trim(),
    brand: brand || "",
    category_top: category_top || "",
    price_usd: Number.isFinite(price_usd) ? price_usd : null,
    retailer,
    date: date || "",
    origin_probable: origin_probable || "",
    qty_unit_raw: qty_unit_raw || "",
    img: img || "",
    in_stock: !!in_stock,
  };
}

// ── Promarche & Al-Makhazen share the same weevi-API export shape ────────────
// source,country_id,id,sku,title,price,final_price,currency,available,
// available_qty,sold_out,brand,categories,categories_ids,url_title,img,date
// (country_id is the store BRANCH location, not a product origin — confirmed
// by cross-checking against the "source" column; deliberately not used here.)
function normalizeWeevi(rows, retailerLabel) {
  return rows
    .filter((r) => r.title)
    .map((r) => {
      const brand = titleBrand(r.brand);
      return toStandardRow({
        retailer: retailerLabel,
        product_name: r.title,
        brand,
        category_top: r.categories,
        price_usd: parseFloat(r.final_price),
        date: r.date,
        origin_probable: originForBrand(brand),
        qty_unit_raw: parseUnitFromText(r.title),
        img: r.img,
        in_stock:
          String(r.available).toLowerCase() === "true" &&
          String(r.sold_out).toLowerCase() !== "true",
      });
    });
}

export function normalizePromarche(rows) {
  return normalizeWeevi(rows, "Promarche");
}

export function normalizeMakhazen(rows) {
  return normalizeWeevi(rows, "Al-Makhazen");
}

// ── Spinneys: objectID,sku,name,weight,price_usd,special_usd,in_stock,url,
// category_l0,category_l1,category_l2,date ────────────────────────────────────
// No brand column at all. Brand is recovered by matching known brand names
// (word-boundary, longest-first) inside the product name — the "known brand"
// list is built dynamically each run from whatever brands Promarche/
// Al-Makhazen report that day, UNION the static spinneysSupplementBrands.json
// list (brands that only ever appear at Spinneys, e.g. "Waitrose", so they
// can't be discovered from the other two sources). Rows with no match get no
// brand and no origin — left "Unknown", not guessed.
export function buildSpinneysBrandMatcher(extraKnownBrands) {
  const all = new Set([...extraKnownBrands, ...spinneysSupplementBrandsList]);
  const brands = [...all].filter((b) => b && b.length >= 4).sort((a, b) => b.length - a.length);
  if (brands.length === 0) return () => "";
  const pattern = new RegExp("\\b(" + brands.map((b) => escapeRegex(b.toUpperCase())).join("|") + ")\\b");
  // map UPPER -> canonical Title Case for the result
  const canonical = new Map(brands.map((b) => [b.toUpperCase(), b]));
  return (name) => {
    const m = pattern.exec((name || "").toUpperCase());
    return m ? canonical.get(m[1]) || "" : "";
  };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSpinneys(rows, matchBrand) {
  return rows
    .filter((r) => r.name)
    .map((r) => {
      const weight = parseFloat(r.weight);
      const special = parseFloat(r.special_usd);
      const price = Number.isFinite(special) && special > 0 ? special : parseFloat(r.price_usd);
      const categoryText = [r.category_l0, r.category_l1, r.category_l2].filter(Boolean).join(" / ");
      const brand = matchBrand ? matchBrand(r.name) : "";
      return toStandardRow({
        retailer: "Spinneys",
        product_name: r.name,
        brand,
        category_top: categoryText,
        price_usd: price,
        date: r.date,
        origin_probable: originForBrand(brand),
        // Spinneys gives a clean numeric weight in grams — no regex needed.
        qty_unit_raw: Number.isFinite(weight) ? (weight >= 1000 ? "kg" : "g") : "",
        img: "",
        in_stock: String(r.in_stock) === "1" || String(r.in_stock).toLowerCase() === "true",
      });
    });
}
