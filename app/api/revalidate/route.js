// ─── On-demand cache revalidation ─────────────────────────────────────────────
// Called by your scraper automation right after the daily CSVs land in Data
// Lake (and, separately, whenever the CPI table is updated), so the site
// refreshes immediately instead of waiting up to 6h for the timed
// revalidation in lib/etl/cache.js / lib/azure/cpi.js.
//
// Protected by a shared secret header — NOT by IP allow-listing, since your
// scrapers may run from a residential/dynamic IP (per your existing pattern
// of running Cloudflare/Akamai-blocked scrapers locally). Treat
// REVALIDATE_SECRET like a password: long, random, stored only in Vercel env
// vars and in whatever secret store your scraper host uses — never in code.

import { revalidateTag } from "next/cache";
import { invalidateMarketData } from "@/lib/etl/cache";

const VALID_TAGS = new Set(["market-data", "cpi-data"]);

export async function POST(req) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let tag = "market-data";
  try {
    const body = await req.json();
    if (body?.tag) tag = body.tag;
  } catch {
    // no body / not JSON — fall back to default tag
  }

  if (!VALID_TAGS.has(tag)) {
    return Response.json({ error: `Unknown tag "${tag}"` }, { status: 400 });
  }

  if (tag === "market-data") {
    // products/snapshot/trade — manual cache (see lib/etl/cache.js), too
    // large for unstable_cache's 2MB limit.
    invalidateMarketData();
  } else {
    // cpi-data — small payload, still safely uses Next's fetch cache.
    revalidateTag(tag);
  }

  return Response.json({ revalidated: true, tag });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
