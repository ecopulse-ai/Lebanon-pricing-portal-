"""
CPI read API — deployed as an Azure Function next to ecopulse-sql-server.

Auth model: this Function has a System-Assigned Managed Identity. That
identity is added as a contained AAD user *inside the database only* (see
the SQL snippet in the deployment README below), and is granted SELECT on
a single view — nothing else. No SQL login, no password, no connection
string secret anywhere: "Authentication=ActiveDirectoryMsi" lets the driver
fetch a token for the Function's own identity automatically.

Public surface: a single GET endpoint, protected by the Function's own
"authLevel": "function" key (see function.json) — callers must pass
?code=... or the x-functions-key header. Vercel calls this with
AZURE_CPI_FUNCTION_URL + AZURE_CPI_FUNCTION_KEY (lib/azure/cpi.js).

Deploy: this folder + host.json + requirements.txt at the repo root of a
separate Function App deployment (Consumption or Flex Consumption plan is
plenty for one daily-cached read).
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

QUERY = "SELECT * FROM dbo.NonCoreConsumerPriceIndex_View ORDER BY RecordDate;"  # ← updated view name


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        with pyodbc.connect(CONN_STR, timeout=10) as conn:
            cur = conn.cursor()
            cur.execute(QUERY)
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception:
        logging.exception("CPI query failed")
        return func.HttpResponse(
            json.dumps({"error": "CPI query failed"}),
            status_code=502,
            mimetype="application/json",
        )

    for r in rows:
        if "RecordDate" in r:
            d = r.pop("RecordDate")
            r["date"] = d.isoformat() if hasattr(d, "isoformat") else str(d)

    return func.HttpResponse(
        json.dumps(rows, default=str),
        status_code=200,
        mimetype="application/json",
        headers={"Cache-Control": "public, max-age=300"},
    )
