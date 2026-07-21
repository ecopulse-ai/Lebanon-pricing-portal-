// ─── CPI data source ──────────────────────────────────────────────────────────
// Deliberately NOT a direct SQL connection from Vercel. Vercel serverless
// functions don't have a static outbound IP by default, so allow-listing them
// in the Azure SQL firewall would mean opening the DB to the whole internet.
// Instead: a small Azure Function (see /azure-function/cpi_api) sits next to
// the SQL server, authenticates to it with its own Managed Identity (no
// password anywhere), and exposes a narrow, read-only, keyed HTTP endpoint
// that only returns the CPI rows. Vercel calls that endpoint.

export async function fetchCpiDaily() {
  const url = process.env.AZURE_CPI_FUNCTION_URL;
  const key = process.env.AZURE_CPI_FUNCTION_KEY;
  if (!url || !key) {
    throw new Error("Missing AZURE_CPI_FUNCTION_URL / AZURE_CPI_FUNCTION_KEY env vars.");
  }

  const res = await fetch(url, {
    headers: { "x-functions-key": key },
    // Next.js Data Cache: serve cached for 6h, and allow on-demand purge via
    // revalidateTag("cpi-data") from /api/revalidate.
    next: { revalidate: 6 * 60 * 60, tags: ["cpi-data"] },
  });

  if (!res.ok) {
    throw new Error(`CPI function returned ${res.status} ${res.statusText}`);
  }
  return res.json();
}
