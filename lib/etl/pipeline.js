import Papa from "papaparse";
import { fetchAlignedRetailerCsvs } from "../azure/datalake";
import {
  normalizePromarche, normalizeMakhazen, normalizeSpinneys, buildSpinneysBrandMatcher,
} from "./normalize";
import { buildProducts } from "./buildProducts";
import { buildMarket } from "./buildMarket";

function parseCsv(text) {
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (errors?.length) {
    // Non-fatal: log and continue with whatever rows parsed cleanly.
    console.warn(`CSV parse warnings (${errors.length}):`, errors.slice(0, 3));
  }
  return data;
}

/**
 * Pulls the latest daily CSV for all three retailers from Data Lake — always
 * the SAME date across all three (see fetchAlignedRetailerCsvs: if the
 * retailers' latest uploads don't already agree on a date, it falls back to
 * the latest date all three actually have, rather than comparing e.g.
 * Tuesday's Promarche prices against Monday's Spinneys prices) — normalizes
 * them into a common schema, and runs the same aggregations the old Python
 * build scripts produced. Nothing here touches disk — the merged
 * "standardized_master_enriched" equivalent exists only in memory for the
 * duration of this call.
 */
export async function runPipeline() {
  const aligned = await fetchAlignedRetailerCsvs();
  const promarcheRaw = { rows: parseCsv(aligned.promarche.text), path: aligned.promarche.path, date: aligned.promarche.date };
  const makhazenRaw = { rows: parseCsv(aligned.makhazen.text), path: aligned.makhazen.path, date: aligned.makhazen.date };
  const spinneysRaw = { rows: parseCsv(aligned.spinneys.text), path: aligned.spinneys.path, date: aligned.spinneys.date };

  const promarche = normalizePromarche(promarcheRaw.rows);
  const makhazen = normalizeMakhazen(makhazenRaw.rows);

  // Spinneys has no brand column — recover it by matching brand names seen
  // today in Promarche/Al-Makhazen, plus the static Spinneys-only supplement
  // list (see normalize.js for why).
  const knownBrandsToday = new Set([...promarche, ...makhazen].map((r) => r.brand).filter(Boolean));
  const matchBrand = buildSpinneysBrandMatcher(knownBrandsToday);
  const spinneys = normalizeSpinneys(spinneysRaw.rows, matchBrand);

  const allRows = [...promarche, ...makhazen, ...spinneys];

  const products = buildProducts(allRows);
  const { snapshot, trade } = buildMarket(allRows);

  return {
    generatedAt: new Date().toISOString(),
    dataDate: promarcheRaw.date, // same for all 3 by construction -- see fetchAlignedRetailerCsvs
    sources: {
      Promarche: { file: promarcheRaw.path, date: promarcheRaw.date },
      "Al-Makhazen": { file: makhazenRaw.path, date: makhazenRaw.date },
      Spinneys: { file: spinneysRaw.path, date: spinneysRaw.date },
    },
    products,
    snapshot,
    trade,
  };
}
