# Cross-source product map — methodology

## What this is

`data/productMap.json` is the PRIMARY way `lib/etl/buildProducts.js` decides
two listings from different retailers (Promarche / Al-Makhazen / Spinneys)
are the same physical product, for the Search All Products section. If a
listing isn't covered by the map, `buildProducts.js` falls back to its
algorithmic matcher (same category + parsed pack size + brand + name-similarity
gates) — the map only ever *adds* confirmed links on top of that, never
removes coverage.

## Why a map instead of matching at request time

The live catalogue is rebuilt on every cache miss. Calling an LLM per
candidate pair on every rebuild would be slow, expensive, and would give a
different answer each time. A map is a build-time artifact: reviewed once,
consulted instantly at runtime via a plain lookup.

## How the current map was built (2026-08, seed pass)

1. Parsed the three real Data Lake CSVs (`promarche_2026-07-31.csv`,
   `almakhazen_2026-07-31.csv`, `spinneys_2026-07-31.csv`) through the actual
   `lib/etl/normalize.js` + phase-1 branch-collapse logic — 116,200 raw
   listings collapsed to 30,209 distinct per-retailer products.
2. Isolated the ~14,700 products with **no algorithmically-parseable pack
   size** — the one class of product the existing matcher can *never* link,
   since a missing size is a hard gate for it. This is the highest-value gap
   for a map to close.
3. Bucketed those by category, then computed name-token similarity
   (Dice coefficient, size/brand-stripped) across retailers within a bucket.
   At a 0.9 threshold: 218 candidate pairs — small enough to review by hand.
4. Reviewed all 218 manually (not just by word overlap): checked brand
   (required to match for packaged/branded goods; not required for
   generic/unbranded raw commodities like produce), pack size/count/format
   conflicts, and whether a listing matched more than one candidate on the
   other side (a sign of ambiguity, not confidence). 80 initially accepted.
5. **Cross-checked the accepted set against itself** and found 6 cases where
   the same listing had been accepted into two different groups — each
   individually looked fine, but together they contradicted each other (e.g.
   one Promarche "Curcuma" listing matched two different Spinneys listings).
   Fixed by merging genuine multi-way commodity matches and dropping the ones
   that actually conflicted (a promo bundle vs. a single unit; two different
   pack counts against one under-specified listing). Final: **73 groups**.
6. Verified end-to-end against the real pipeline: 73/73 groups resolve
   cleanly, adding 74 net new linked products with zero conflicts, in
   ~1 second, no performance regression.

## Known limitations — read before trusting this blindly

- **Coverage is partial.** 73 groups out of a catalogue of ~30,000 products.
  This closes the highest-value gap (no-parseable-size products) for a
  reviewable subset, not the whole catalogue. See "Extending coverage" below.
- **Keyed on exact product-name text from one dated snapshot.** If a retailer
  reworks a title, that map entry silently stops matching — harmless (it just
  falls through to the algorithmic matcher like any unlinked product), but it
  means the map needs periodic re-running against fresh CSVs to stay current,
  not a one-time job.
- **Only reviewed the "no parseable size" gap.** Products that *do* have a
  parseable size but got rejected by the algorithm's strict brand/similarity
  gates were not reviewed in this pass — a second, different category of
  potential improvement, not covered here.
- **The acceptance bar was deliberately conservative** — when a listing
  plausibly matched multiple candidates, or brand couldn't be confirmed for a
  packaged good, it was rejected rather than guessed. Expect the map to
  under-link relative to what a human with actual product knowledge (reading
  labels, knowing regional brands) might confidently accept.

## Extending coverage

`scripts/build_product_map.py` automates the same review process at scale
using the Anthropic API (same `ANTHROPIC_API_KEY` pattern used elsewhere in
this repo for the AI advisor):

```bash
export ANTHROPIC_API_KEY=...
python3 scripts/build_product_map.py \
  --promarche path/to/promarche_YYYY-MM-DD.csv \
  --makhazen  path/to/almakhazen_YYYY-MM-DD.csv \
  --spinneys  path/to/spinneys_YYYY-MM-DD.csv \
  --min-similarity 0.6
```

It's additive and resumable: loads the existing map, skips anything already
covered, only classifies genuinely new candidates. Verified with `--dry-run`
against the real 2026-07-31 CSVs: 1,658 new candidates at a 0.6 threshold
(~83 API calls) beyond what this seed already covers — a reasonable next
increment. Use `--category "Meat & Fish"` (or another canonical category) to
scope a run and control cost before committing to the full sweep.

The script's classification prompt encodes the same standard used in the
manual pass (brand matters for packaged goods, not for generic commodities;
size/count must not conflict; ambiguity means reject) — but it hasn't been
run at scale or spot-checked the way the seed pass was, since doing so
requires an API key this environment doesn't have. **Spot-check its output
before trusting it the way the seed pass was verified** — read a sample of
what it accepts, the same way the seed's 218 candidates were read by hand.
