import Papa from "papaparse";
import { fetchLatestRetailerCsv } from "../azure/datalake";
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

async function loadRaw(key) {
  const { text, path, lastModified } = await fetchLatestRetailerCsv(key);
  return { rows: parseCsv(text), path, lastModified };
}

/**
 * Pulls the latest daily CSV for all three retailers from Data Lake,
 * normalizes them into a common schema, and runs the same aggregations the
 * old Python build scripts produced. Nothing here touches disk — the merged
 * "standardized_master_enriched" equivalent exists only in memory for the
 * duration of this call.
 */
export async function runPipeline() {
  const [promarcheRaw, makhazenRaw, spinneysRaw] = await Promise.all([
    loadRaw("promarche"),
    loadRaw("makhazen"),
    loadRaw("spinneys"),
  ]);

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
    sources: {
      Promarche: { file: promarcheRaw.path, lastModified: promarcheRaw.lastModified },
      "Al-Makhazen": { file: makhazenRaw.path, lastModified: makhazenRaw.lastModified },
      Spinneys: { file: spinneysRaw.path, lastModified: spinneysRaw.lastModified },
    },
    products,
    snapshot,
    trade,
  };
}
