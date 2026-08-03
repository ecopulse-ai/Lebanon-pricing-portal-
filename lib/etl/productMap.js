// ─── LLM-reviewed cross-source product map ───────────────────────────────────
// data/productMap.json holds pairs of listings — one per retailer — manually
// confirmed (by an LLM review pass, see scripts/build_product_map.md) to be
// the SAME physical product. This is now the PRIMARY way buildProducts.js
// decides two listings from different retailers are the same item; the
// algorithmic matcher (category + parsed size + brand + name-similarity gates)
// only runs as a FALLBACK for any listing the map doesn't cover.
//
// Why a map file instead of calling an LLM at request time: the live catalogue
// is fetched and rebuilt on every cache miss (lib/etl/cache.js) — an LLM call
// per candidate pair on every rebuild would be slow, expensive, and non-
// deterministic. A map is a build-time artifact: reviewed once (by a human/LLM
// pass, or via the batch script), consulted instantly at runtime.
//
// LIMITATION, stated plainly: the map is keyed on exact product NAME text from
// a specific dated snapshot (see `sourceSnapshot` in the file). If a retailer
// reworks a title, that entry silently stops matching in the map — but never
// breaks anything, because a map miss just falls through to the algorithmic
// matcher, same as any other unlinked product. The map is a floor, not a
// ceiling: it only ever adds confirmed links on top of what the algorithm
// would find, never removes coverage.

import productMap from "@/data/productMap.json";

function normKey(retailer, name) {
  return `${retailer}|${(name || "").toLowerCase().trim().replace(/\s+/g, " ")}`;
}

let _lookup = null;

// key -> groupId, built once per process from data/productMap.json.
function getLookup() {
  if (_lookup) return _lookup;
  _lookup = new Map();
  for (const g of productMap.groups || []) {
    for (const m of g.members) {
      _lookup.set(normKey(m.retailer, m.name), g.id);
    }
  }
  return _lookup;
}

// groupId a given (retailer, name) belongs to in the map, or null if the map
// has no entry for it (-> caller should fall back to the algorithmic matcher).
export function mapGroupId(retailer, name) {
  return getLookup().get(normKey(retailer, name)) || null;
}

export function productMapMeta() {
  return {
    version: productMap.version,
    acceptedGroups: productMap.acceptedGroups,
    reviewedCandidates: productMap.reviewedCandidates,
    sourceSnapshot: productMap.sourceSnapshot,
  };
}
