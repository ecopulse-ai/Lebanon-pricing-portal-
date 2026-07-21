// ─── On-Shelf Availability (Non-Core CPI) source ─────────────────────────────
// Same pattern as lib/azure/cpi.js: a keyed Azure Function proxy (Managed
// Identity → SQL, no stored password), not a direct DB connection from
// Vercel. See azure-function/availability_api for the query.

export async function fetchCpiAvailability() {
  const url = process.env.AZURE_AVAILABILITY_FUNCTION_URL;
  const key = process.env.AZURE_AVAILABILITY_FUNCTION_KEY;
  if (!url || !key) {
    throw new Error("Missing AZURE_AVAILABILITY_FUNCTION_URL / AZURE_AVAILABILITY_FUNCTION_KEY env vars.");
  }

  const res = await fetch(url, {
    headers: { "x-functions-key": key },
    next: { revalidate: 6 * 60 * 60, tags: ["cpi-availability"] },
  });

  if (!res.ok) {
    throw new Error(`Availability function returned ${res.status} ${res.statusText}`);
  }
  return res.json();
}
