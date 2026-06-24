// ─── Real product catalogue — server-side search/paging ──────────────────────
// 47.8k distinct products grouped from ~133k listings (data/products.json,
// built by scripts/build_products.py). The file is ~10MB, so it is loaded ONCE
// into module memory and never shipped to the browser — the client pages over
// it through /api/products. No outlet/supermarket names are stored or returned.

// Static import so Next/Vercel bundles the file into the serverless function
// (a runtime fs read of this path is not traced and 500s in production).
import catalogue from "@/data/products.json";

function load() {
  return catalogue;
}

export function getCatalogueMeta() {
  const { meta } = load();
  return meta;
}

export function getCategories() {
  return load().meta.categories;
}

export function getProductById(id) {
  const { products } = load();
  const i = Number(id);
  return products[i] && products[i].id === i ? products[i] : null;
}

const SORTS = {
  popular: null, // file is pre-sorted by listing count desc
  price_asc: (a, b) => a.med - b.med,
  price_desc: (a, b) => b.med - a.med,
  name: (a, b) => a.name.localeCompare(b.name),
};

export function searchProducts({ q = "", cat = "All", sort = "popular", page = 1, pageSize = 50 } = {}) {
  const { products } = load();
  const s = q.trim().toLowerCase();
  let rows = products;

  if (s || cat !== "All") {
    rows = products.filter((p) => {
      const okCat = cat === "All" || p.cat === cat;
      const okQ = !s || p.name.toLowerCase().includes(s) || (p.brand && p.brand.toLowerCase().includes(s));
      return okCat && okQ;
    });
  }

  const cmp = SORTS[sort];
  if (cmp) rows = [...rows].sort(cmp);

  const total = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const items = rows.slice(start, start + pageSize);
  return { total, page, pageSize, items };
}
