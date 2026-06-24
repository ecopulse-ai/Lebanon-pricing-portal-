#!/usr/bin/env python3
"""
Build the daily CPI series JSON from the source CSV.

Input  : data/NonCoreCPI_Lebanon.csv   (committed source of truth)
Output : data/cpi_daily.json            (committed; imported by lib/cpiData.js)

This removes the hand-synced array that used to live in lib/cpiData.js. The CSV
is the single source of truth; re-run after updating it:

    python3 scripts/build_cpi.py
"""
import csv, json, os

SRC = "data/NonCoreCPI_Lebanon.csv"
OUT = "data/cpi_daily.json"

rows = []
with open(SRC, newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        row = {}
        for k, v in r.items():
            if k == "RecordDate":
                row["date"] = v.strip()
            elif v is None or v == "":
                row[k] = None
            else:
                # Numeric columns; keep ints clean, floats as floats.
                num = float(v)
                row[k] = int(num) if num.is_integer() else round(num, 4)
        rows.append(row)

rows.sort(key=lambda x: x["date"])

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))

print(f"Wrote {OUT}  ({len(rows)} daily rows, {os.path.getsize(OUT)} bytes)")
