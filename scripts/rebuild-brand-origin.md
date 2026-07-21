# Rebuilding the brand → origin lookup

The pipeline reads three JSON files, all generated from `brand_origin_lookup.xlsx`
(the spreadsheet with the "Brands" tab: Brand / Al-Makhazen / Promarche / Spinneys /
Country / Confidence columns):

- `lib/etl/brandOrigin.json` — `{ "Brand Name": "Country" }`, only rows with a
  real country filled in.
- `lib/etl/privateLabelBrands.json` — brand names marked `N/A — private label`
  in the Confidence column (e.g. "Spinneys", "Private"). These get no origin
  by definition — they're the retailer's own store brand, not an import.
- `lib/etl/spinneysSupplementBrands.json` — brand names that only ever appear
  at Spinneys (i.e. zero Al-Makhazen and zero Promarche listings in the
  spreadsheet). Spinneys' raw export has no brand column, so these can't be
  rediscovered automatically each day the way brands shared with the other
  two retailers can — they need to stay in this static list so the pipeline
  keeps matching them against Spinneys product names.

## To regenerate after editing the spreadsheet

Run this whenever `brand_origin_lookup.xlsx` has new/changed Country entries.
Requires `openpyxl` (`pip install openpyxl --break-system-packages`).

```python
import openpyxl, json

wb = openpyxl.load_workbook("brand_origin_lookup.xlsx", data_only=True)
ws = wb["Brands"]

origin = {}
private_label = []
spinneys_supplement = []

for r in range(2, ws.max_row + 1):
    brand = ws.cell(row=r, column=2).value
    am = ws.cell(row=r, column=3).value or 0
    pm = ws.cell(row=r, column=4).value or 0
    sp = ws.cell(row=r, column=5).value or 0
    country = ws.cell(row=r, column=8).value
    conf = ws.cell(row=r, column=9).value
    if not brand:
        continue
    if conf == "N/A":
        private_label.append(brand)
    elif country:
        origin[brand] = country
    if am == 0 and pm == 0 and sp > 0 and conf != "N/A":
        spinneys_supplement.append(brand)

json.dump(origin, open("lib/etl/brandOrigin.json", "w"), ensure_ascii=False, indent=2)
json.dump(private_label, open("lib/etl/privateLabelBrands.json", "w"), ensure_ascii=False, indent=2)
json.dump(sorted(spinneys_supplement), open("lib/etl/spinneysSupplementBrands.json", "w"), ensure_ascii=False, indent=2)
```

No code changes needed afterward — `lib/etl/normalize.js` imports these three
files directly, and `/api/revalidate` (tag `market-data`) will pick up the
new mapping on the next request after you redeploy.
