// ─── CPI item-weight data source ──────────────────────────────────────────────
// Same pattern as lib/azure/cpi.js: a small Azure Function (see
// /azure-function/item_weights_api) sits next to the SQL server, authenticates
// with its own Managed Identity, and exposes a narrow, read-only, keyed HTTP
// endpoint. Vercel/Next calls that endpoint — never a direct SQL connection.
//
// Source: dbo.NonCoreItemBreakdown.Share (the real CPI item weights) — NOT
// dbo.Items.weight, which an earlier version of this pipeline mistakenly used.
//
// The PRIMARY consumer of item weights today is scripts/build_basket.py
// (called at build time via Python, not this file) for the weighted
// category-gap calculation. This accessor exists for any future in-app use
// (e.g. displaying a weight alongside an item) that needs the same data
// without duplicating the fetch/auth logic.

export async function fetchItemWeights() {
  const url = process.env.AZURE_ITEM_WEIGHTS_FUNCTION_URL;
  const key = process.env.AZURE_ITEM_WEIGHTS_FUNCTION_KEY;
  if (!url || !key) {
    throw new Error("Missing AZURE_ITEM_WEIGHTS_FUNCTION_URL / AZURE_ITEM_WEIGHTS_FUNCTION_KEY env vars.");
  }

  const res = await fetch(url, {
    headers: { "x-functions-key": key },
    // Item weights change rarely (CPI basket weights are typically revised
    // annually) — cache generously, with on-demand purge available the same
    // way lib/azure/cpi.js does via revalidateTag if ever needed.
    next: { revalidate: 24 * 60 * 60, tags: ["item-weights"] },
  });

  if (!res.ok) {
    throw new Error(`Item-weights function returned ${res.status} ${res.statusText}`);
  }
  const rows = await res.json();
  // { "11101": 0.42, "11108": 0.11, ... } — keyed by cpi_code, matching the
  // normalization scripts/build_basket.py applies to every code it handles.
  return Object.fromEntries(
    rows
      .filter((r) => r.code != null && r.weight != null)
      .map((r) => [String(r.code).replace(/\.0$/, ""), Number(r.weight)])
  );
}
