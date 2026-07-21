"""
On-Shelf Availability (Non-Core CPI) — deployed alongside cpi_api in the same
Function App, same Managed Identity / SQL contained user (see cpi_api for the
auth model — no password anywhere, AAD MSI only).

Metric: 1 - (distinct items currently flagged in ProductStockTracker /
total items in the non-core basket, from Items).

SIMPLIFICATION, on purpose, not an oversight: this counts an item as
"flagged" if ANY of its source links is currently failing, i.e. it does not
distinguish "one source down, index still computable via the geometric mean
of the remaining source" from "both sources down, price imputed" — those are
handled differently by the CPI methodology itself, but ProductStockTracker
as inspected doesn't cleanly expose per-item source-count to split them.
Revisit if a finer split becomes worth the extra complexity.

Before deploying, grant this Function's identity read access:
  GRANT SELECT ON dbo.Items TO [ecopulse-lebanon-cpi-api];
  GRANT SELECT ON dbo.ProductStockTracker TO [ecopulse-lebanon-cpi-api];
(swap in your actual Function App name if different)
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

THRESHOLD_DAYS = 14  # matches the methodology's "flag after two consecutive weeks"

QUERY = """
SELECT
  (SELECT COUNT(*) FROM dbo.Items) AS total_items,
  (SELECT COUNT(DISTINCT item_code) FROM dbo.ProductStockTracker) AS flagged_items,
  (SELECT MAX(days) FROM dbo.ProductStockTracker) AS max_days_out,
  (SELECT COUNT(DISTINCT item_code) FROM dbo.ProductStockTracker WHERE days >= ?) AS threshold_breaches,
  (SELECT MAX(updated_date) FROM dbo.ProductStockTracker) AS as_of;
"""


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        with pyodbc.connect(CONN_STR, timeout=10) as conn:
            cur = conn.cursor()
            cur.execute(QUERY, THRESHOLD_DAYS)
            row = cur.fetchone()
            total_items, flagged_items, max_days_out, threshold_breaches, as_of = row
    except Exception:
        logging.exception("Availability query failed")
        return func.HttpResponse(
            json.dumps({"error": "Availability query failed"}),
            status_code=502,
            mimetype="application/json",
        )

    total_items = total_items or 0
    flagged_items = flagged_items or 0
    availability_pct = round(100 * (1 - flagged_items / total_items), 1) if total_items else None

    payload = {
        "totalItems": total_items,
        "flaggedItems": flagged_items,
        "availabilityPct": availability_pct,
        "maxDaysOut": max_days_out,
        "thresholdDays": THRESHOLD_DAYS,
        "thresholdBreaches": threshold_breaches or 0,
        "asOf": as_of.isoformat() if hasattr(as_of, "isoformat") else (str(as_of) if as_of else None),
    }

    return func.HttpResponse(
        json.dumps(payload, default=str),
        status_code=200,
        mimetype="application/json",
        headers={"Cache-Control": "public, max-age=300"},
    )
