"""
Item-weight read API — deployed as an Azure Function next to ecopulse-sql-server,
alongside cpi_api. Supplies the REAL CPI importance weight per item to
scripts/build_basket.py's weighted category-gap calculation (see that script's
fetch_item_weights()) and, if ever needed client-side, lib/azure/itemWeights.js.

2026-08: switched from dbo.Items.weight to dbo.NonCoreItemBreakdown.Share --
per direct instruction, Share on NonCoreItemBreakdown is the real weight,
not the Items table (that earlier version is what this replaces).

Auth model: SAME pattern as cpi_api — a System-Assigned Managed Identity,
added as a contained AAD user *inside the database only*, granted SELECT on a
single view — nothing else. No SQL login, no password, no connection string
secret. "Authentication=ActiveDirectoryMsi" lets the driver fetch a token for
the Function's own identity automatically.

── REQUIRED DB-SIDE SETUP (not part of this repo — run once, by whoever has
   admin access to InflationFoodSec_Lebanon) ──────────────────────────────────
    -- 1. Confirm the actual item-code column on dbo.NonCoreItemBreakdown. This
    --    code ASSUMES it is named "Code" and holds the same cpi_code values
    --    used in the basket CSVs (e.g. "11101") -- matching the naming
    --    convention already used by dbo.NonCoreConsumerPriceIndex_View (see
    --    cpi_api). If the real column is named differently (ItemCode,
    --    CPI_Code, etc.), update the view definition below AND the "code" key
    --    this Function returns to match — do not silently rename only one side.
    CREATE VIEW dbo.NonCoreItemBreakdown_Weight_View AS
        SELECT Code AS code, Share AS weight FROM dbo.NonCoreItemBreakdown;

    -- 2. Grant the Function's managed identity SELECT on that view only:
    GRANT SELECT ON dbo.NonCoreItemBreakdown_Weight_View TO [<function-app-name>];

    -- 3. If a previous deployment granted SELECT on dbo.Items_Weight_View,
    --    that grant is no longer needed by this Function and can be revoked
    --    (least privilege -- don't leave unused access lying around):
    -- REVOKE SELECT ON dbo.Items_Weight_View FROM [<function-app-name>];

Then set these on the Function App (mirroring AZURE_CPI_FUNCTION_URL/_KEY in
lib/azure/cpi.js) AND wherever scripts/build_basket.py is run from:
    AZURE_ITEM_WEIGHTS_FUNCTION_URL = https://<this-function-app>.azurewebsites.net/api/item_weights_api
    AZURE_ITEM_WEIGHTS_FUNCTION_KEY = <function key>

Public surface: a single GET endpoint, protected by the Function's own
"authLevel": "function" key — callers must pass ?code=... or the
x-functions-key header, same as cpi_api.

Deploy: this folder + host.json + requirements.txt at the repo root, same
Function App deployment as cpi_api (or a sibling app — either works).
"""

import json
import logging
import azure.functions as func
import pyodbc

CONN_STR = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=tcp:ecopulse-sql-server.database.windows.net,1433;"
    "Database=InflationFoodSec_Lebanon;"
    "Authentication=ActiveDirectoryMsi;"
    "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
)

# ASSUMPTION flagged above: confirm dbo.NonCoreItemBreakdown_Weight_View's
# column names match this query before relying on the output. If
# build_basket.py logs items with a null "weight", that is the first place
# to check.
QUERY = "SELECT code, weight FROM dbo.NonCoreItemBreakdown_Weight_View;"


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        with pyodbc.connect(CONN_STR, timeout=10) as conn:
            cur = conn.cursor()
            cur.execute(QUERY)
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        logging.exception("Item-weight (NonCoreItemBreakdown.Share) query failed")
        return func.HttpResponse(
            json.dumps({"error": "Item-weight query failed"}),
            status_code=502,
            mimetype="application/json",
        )

    logging.info(f"item_weights_api: returned {len(rows)} item weight rows (source: NonCoreItemBreakdown.Share)")

    return func.HttpResponse(
        json.dumps(rows, default=str),
        status_code=200,
        mimetype="application/json",
        headers={"Cache-Control": "public, max-age=3600"},
    )
