// ─── Market data cache ────────────────────────────────────────────────────────
// NOT using Next's unstable_cache here — it has a hard 2MB-per-entry limit,
// and the products payload (47k+ products, same size class as the old 9.8MB
// products.json) comes out to several MB, well over that. unstable_cache
// silently fails to write anything over the limit and falls through to
// recomputing from scratch on every request — which is what was happening:
// every /products hit was re-running 3 Data Lake fetches + a full ~130k-row
// aggregation from zero, every time.
//
// Instead: a plain module-scope in-memory cache with a TTL, guarded against
// duplicate concurrent recomputation (so N simultaneous requests during a
// cold cache don't each kick off their own full pipeline run).
//
// Caveat vs. unstable_cache: this lives in the memory of a single serverless
// function instance, not a shared distributed cache. On Vercel, concurrent
// requests routed to different instances (or a fresh cold start) won't share
// a warm cache — each instance builds its own. For this app's traffic
// pattern (a handful of internal/ministry users, refreshed once daily) that
// tradeoff is fine; it still eliminates the "every request recomputes
// everything" problem for the common case of repeat requests hitting the
// same warm instance.

import { runPipeline } from "./pipeline";

const TTL_MS = 6 * 60 * 60 * 1000; // 6h, matches the old revalidate window

let cached = null; // { data, fetchedAt }
let inFlight = null; // Promise, so concurrent callers share one pipeline run

export async function getMarketData() {
  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh) return cached.data;

  if (!inFlight) {
    inFlight = runPipeline()
      .then((data) => {
        cached = { data, fetchedAt: Date.now() };
        inFlight = null;
        return data;
      })
      .catch((err) => {
        inFlight = null;
        throw err;
      });
  }
  return inFlight;
}

// Called by /api/revalidate after the daily scrapers finish, so the next
// request rebuilds immediately instead of waiting up to 6h.
export function invalidateMarketData() {
  cached = null;
}
