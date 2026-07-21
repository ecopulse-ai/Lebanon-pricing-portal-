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

/**
 * Returns { path, lastModified, text } for the most recently modified .csv
 * file in a retailer's folder — i.e. today's upload (or the latest available
 * one if today hasn't landed yet).
 */
export async function fetchLatestRetailerCsv(retailerKey) {
  const folder = RETAILER_FOLDERS[retailerKey];
  if (!folder) throw new Error(`Unknown retailer key: ${retailerKey}`);

  const fsClient = getServiceClient().getFileSystemClient(FILESYSTEM);

  let latestPath = null;
  let latestModified = 0;
  for await (const item of fsClient.listPaths({ path: folder })) {
    if (item.isDirectory) continue;
    if (!item.name.toLowerCase().endsWith(".csv")) continue;
    const modified = item.lastModified ? new Date(item.lastModified).getTime() : 0;
    if (modified >= latestModified) {
      latestModified = modified;
      latestPath = item.name;
    }
  }

  if (!latestPath) {
    throw new Error(`No CSV files found for "${retailerKey}" under ${folder}`);
  }

  const fileClient = fsClient.getFileClient(latestPath);
  const download = await fileClient.read();
  const text = await streamToString(download.readableStreamBody);
  return { path: latestPath, lastModified: new Date(latestModified), text };
}

async function streamToString(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
