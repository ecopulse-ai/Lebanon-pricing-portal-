// ─── Azure Data Lake Gen2 client ──────────────────────────────────────────────
// Server-only. Reads the most recently uploaded CSV for each retailer folder.
// Never writes, deletes, or lists outside the configured folders.

import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { getAzureCredential } from "./credentials";

let serviceClient;

function getServiceClient() {
  if (serviceClient) return serviceClient;
  const account = process.env.AZURE_STORAGE_ACCOUNT; // e.g. "ecopulselake"
  if (!account) throw new Error("Missing AZURE_STORAGE_ACCOUNT env var.");
  serviceClient = new DataLakeServiceClient(
    `https://${account}.dfs.core.windows.net`,
    getAzureCredential()
  );
  return serviceClient;
}

// ⚠️ CONFIRM THESE PATHS. Your upload_to_datalake() call for Spinneys writes to:
//   file_system_client = service_client.get_file_system_client("raw-data")
//   file_client = file_system_client.get_file_client(
//       "raw-data/Lebanon/All-items/Spinneys/spinneys_YYYY-MM-DD.csv"
//   )
// Because the file_system_client is already scoped to the "raw-data"
// filesystem, that target_path creates a path *inside* raw-data that starts
// with another "raw-data/" segment (i.e. the real path is
// raw-data (filesystem) → raw-data/Lebanon/All-items/Spinneys/... ).
// That's almost certainly not what you intended — but since it's already
// live in production, the folders below match reality rather than the
// "clean" path. Fix the scrapers' target_path (drop the leading "raw-data/")
// and update FOLDERS below to match, in the same PR — don't let them drift.
const FILESYSTEM = process.env.AZURE_STORAGE_FILESYSTEM || "raw-data";

export const RETAILER_FOLDERS = {
  spinneys: "raw-data/Lebanon/All-items/Spinneys",
  promarche: "raw-data/Lebanon/All-items/Promarche", // confirm exact casing/name
  makhazen: "raw-data/Lebanon/All-items/Al_Makhazen", // confirm exact casing/name
};

const FETCH_TIMEOUT_MS = 15_000; // a connectivity/credential problem should
  // fail loudly and fast, not hang the page forever with no thrown error.

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function streamToString(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Lists every .csv file in a retailer's folder with a date parsed from the
 * FILENAME (e.g. "promarche_2026-07-31.csv" -> "2026-07-31"), not from blob
 * lastModified — the filename date is the actual scrape date; lastModified
 * is just when the upload happened, which can lag the real date by hours and
 * would give a false read on "is this the same date across retailers".
 * Falls back to lastModified (as a UTC date) only if a file's name doesn't
 * match the expected pattern, and logs that fallback since it's less reliable.
 */
const DATE_IN_FILENAME_RE = /(\d{4}-\d{2}-\d{2})(?:[^\/]*)\.csv$/i;

async function listRetailerCsvDates(retailerKey) {
  const folder = RETAILER_FOLDERS[retailerKey];
  if (!folder) throw new Error(`Unknown retailer key: ${retailerKey}`);
  const fsClient = getServiceClient().getFileSystemClient(FILESYSTEM);

  const files = [];
  await withTimeout(
    (async () => {
      for await (const item of fsClient.listPaths({ path: folder })) {
        if (item.isDirectory) continue;
        if (!item.name.toLowerCase().endsWith(".csv")) continue;
        const m = item.name.match(DATE_IN_FILENAME_RE);
        let date;
        if (m) {
          date = m[1];
        } else {
          date = item.lastModified ? new Date(item.lastModified).toISOString().slice(0, 10) : null;
          if (date) {
            console.warn(
              `[datalake] "${item.name}" (${retailerKey}) has no YYYY-MM-DD in its filename — ` +
                `falling back to lastModified (${date}) as its date. This is less reliable for ` +
                `cross-retailer date alignment; consider renaming uploads to include the date.`
            );
          }
        }
        if (!date) continue; // can't date this file at all -- exclude it, don't guess
        files.push({
          path: item.name,
          date,
          lastModified: item.lastModified ? new Date(item.lastModified) : null,
        });
      }
    })(),
    FETCH_TIMEOUT_MS,
    `listPaths for "${retailerKey}" under ${folder}`
  ).catch((err) => {
    console.error(`[datalake] listPaths failed for "${retailerKey}" (folder: ${folder}):`, err);
    throw new Error(
      `Could not list files for "${retailerKey}" — check Azure Data Lake connectivity/credentials ` +
        `and that folder "${folder}" still exists. Original error: ${err.message}`
    );
  });

  if (!files.length) throw new Error(`No dateable CSV files found for "${retailerKey}" under ${folder}`);
  // If a date has multiple files (shouldn't normally happen), keep the most
  // recently modified one for that date.
  const byDate = new Map();
  for (const f of files) {
    const prev = byDate.get(f.date);
    if (!prev || (f.lastModified && prev.lastModified && f.lastModified > prev.lastModified)) {
      byDate.set(f.date, f);
    }
  }
  return byDate; // Map<date, {path, date, lastModified}>
}

async function fetchCsvFile(path) {
  const fsClient = getServiceClient().getFileSystemClient(FILESYSTEM);
  const fileClient = fsClient.getFileClient(path);
  let download;
  try {
    download = await withTimeout(fileClient.read(), FETCH_TIMEOUT_MS, `read "${path}"`);
  } catch (err) {
    console.error(`[datalake] file read failed for "${path}":`, err);
    throw new Error(`Could not read "${path}". Original error: ${err.message}`);
  }
  return streamToString(download.readableStreamBody);
}

/**
 * Fetches all 3 retailers' CSVs for the SAME date — never a mix of dates.
 * Picks the latest date that has a file present in all 3 folders (which, on
 * a normal day when all 3 scrapers ran, is just each retailer's own latest
 * file — this only actually reaches back further when one retailer's most
 * recent upload is missing/late relative to the others).
 *
 * Throws if no single date has coverage from all 3 retailers at all — that's
 * a real data problem (one retailer has been down entirely) and should
 * surface as a clear error, not silently mix dates or guess.
 */
export async function fetchAlignedRetailerCsvs() {
  const keys = Object.keys(RETAILER_FOLDERS);
  const perRetailer = {};
  await Promise.all(
    keys.map(async (key) => {
      perRetailer[key] = await listRetailerCsvDates(key);
    })
  );

  const latestPerRetailer = Object.fromEntries(
    keys.map((k) => [k, [...perRetailer[k].keys()].sort().at(-1)])
  );

  const unionDatesDesc = [...new Set(keys.flatMap((k) => [...perRetailer[k].keys()]))].sort().reverse();
  const commonDate = unionDatesDesc.find((d) => keys.every((k) => perRetailer[k].has(d)));

  if (!commonDate) {
    throw new Error(
      `No date has a CSV available from all 3 retailers. Each retailer's latest date: ` +
        keys.map((k) => `${k}=${latestPerRetailer[k]}`).join(", ") +
        `. At least one retailer's feed appears to be down or missing entirely — this needs ` +
        `investigation on the scraper/upload side, not a code fix here.`
    );
  }

  if (keys.some((k) => latestPerRetailer[k] !== commonDate)) {
    console.warn(
      `[datalake] Retailers' latest dates don't all agree — using the latest COMMON date ` +
        `${commonDate} instead. Per-retailer latest: ` +
        keys.map((k) => `${k}=${latestPerRetailer[k]}`).join(", ") +
        `. Any retailer whose latest date is newer than ${commonDate} is being held back to stay aligned.`
    );
  } else {
    console.log(`[datalake] All 3 retailers' latest date agrees: ${commonDate}`);
  }

  const result = {};
  await Promise.all(
    keys.map(async (key) => {
      const entry = perRetailer[key].get(commonDate);
      const text = await fetchCsvFile(entry.path);
      result[key] = { path: entry.path, date: commonDate, lastModified: entry.lastModified, text };
    })
  );
  return result;
}

/**
 * Returns { path, lastModified, text } for the most recently modified .csv
 * file in a retailer's folder, WITHOUT cross-retailer date alignment.
 * Kept for any caller that genuinely wants one retailer in isolation; the
 * live pipeline (lib/etl/pipeline.js) uses fetchAlignedRetailerCsvs() above
 * instead, so all 3 retailers are always compared on the same date.
 */
export async function fetchLatestRetailerCsv(retailerKey) {
  const folder = RETAILER_FOLDERS[retailerKey];
  if (!folder) throw new Error(`Unknown retailer key: ${retailerKey}`);

  const fsClient = getServiceClient().getFileSystemClient(FILESYSTEM);

  let latestPath = null;
  let latestModified = 0;
  try {
    await withTimeout(
      (async () => {
        for await (const item of fsClient.listPaths({ path: folder })) {
          if (item.isDirectory) continue;
          if (!item.name.toLowerCase().endsWith(".csv")) continue;
          const modified = item.lastModified ? new Date(item.lastModified).getTime() : 0;
          if (modified >= latestModified) {
            latestModified = modified;
            latestPath = item.name;
          }
        }
      })(),
      FETCH_TIMEOUT_MS,
      `listPaths for "${retailerKey}" under ${folder}`
    );
  } catch (err) {
    console.error(`[datalake] listPaths failed for "${retailerKey}" (folder: ${folder}):`, err);
    throw new Error(
      `Could not list files for "${retailerKey}" — check Azure Data Lake connectivity/credentials ` +
        `and that folder "${folder}" still exists. Original error: ${err.message}`
    );
  }

  if (!latestPath) {
    throw new Error(`No CSV files found for "${retailerKey}" under ${folder}`);
  }

  const fileClient = fsClient.getFileClient(latestPath);
  let download;
  try {
    download = await withTimeout(fileClient.read(), FETCH_TIMEOUT_MS, `read "${latestPath}"`);
  } catch (err) {
    console.error(`[datalake] file read failed for "${latestPath}":`, err);
    throw new Error(`Could not read "${latestPath}" for "${retailerKey}". Original error: ${err.message}`);
  }
  const text = await streamToString(download.readableStreamBody);
  return { path: latestPath, lastModified: new Date(latestModified), text };
}
