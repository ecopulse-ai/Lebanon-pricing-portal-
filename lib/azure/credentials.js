// ─── Shared Azure AD credential ───────────────────────────────────────────────
// Server-only. Used solely to read (never write/delete) the raw-data
// filesystem in ADLS Gen2. The Service Principal behind these env vars must
// be granted ONLY the "Storage Blob Data Reader" RBAC role, scoped to the
// `raw-data` filesystem — not the storage account, not the subscription.
//
// Required env vars (set in Vercel Project Settings → Environment Variables,
// NEVER committed to git):
//   AZURE_TENANT_ID
//   AZURE_CLIENT_ID
//   AZURE_CLIENT_SECRET
//
// This file is only ever imported from server-side code (lib/etl/*, API
// routes). Importing it from a client component would fail at runtime since
// these env vars are not prefixed NEXT_PUBLIC_ and are stripped from the
// client bundle — that's intentional, treat it as a safety net, not the only
// safeguard.

import { ClientSecretCredential } from "@azure/identity";

let cached;

export function getAzureCredential() {
  if (cached) return cached;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Azure credentials: set AZURE_TENANT_ID, AZURE_CLIENT_ID, " +
        "AZURE_CLIENT_SECRET in the environment. Never hardcode these."
    );
  }

  cached = new ClientSecretCredential(tenantId, clientId, clientSecret);
  return cached;
}
