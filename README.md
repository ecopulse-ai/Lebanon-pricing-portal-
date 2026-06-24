# Lebanon Prices Intelligence Unit

A price-intelligence portal for Lebanon: a non-core daily CPI, market-level retail
analytics, an import/shipping dependency map, a searchable product catalogue, and a
page-specialized AI economist. Prepared in the style of a brief for the Office of the
Minister of Economy & Trade.

Built with **Next.js 16** (App Router, Turbopack), **Tailwind CSS v4**,
**Recharts**, and the **Anthropic SDK**.

## Pages

| Route        | What it does                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `/`          | Landing brief — headline CPI + food-basket figures and the two instruments  |
| `/cpi`       | Non-core daily CPI by category, indexed to 100, with trends and a snapshot   |
| `/dashboard` | Retail analytics — affordability, category mix, import dependency (market-level) |
| `/trade`     | Trade & shipping dependency map — single-source concentration, blocs, chokepoints |
| `/products`  | Search the full standardized catalogue (price range in USD/LBP, brand, origin) |
| `/briefing`  | Auto-generated weekly "Price Watch" note — printable to PDF, shareable link  |

The **AI Price Economist** is a dock on the right of every page (not a separate
route). It is page-specialized — CPI Analyst, Retail Analyst, Catalogue Analyst,
Sourcing Advisor — and streams from Claude via `POST /api/chat`.

## Data

The analytics run on a **real cross-sectional scrape** of Lebanese retail shelves
(~133k listings across several chains), reduced to compact, committed JSON snapshots:

| File                          | Built by                      | Powers                        |
|-------------------------------|-------------------------------|-------------------------------|
| `data/retail_snapshot.json`   | `scripts/build_snapshot.py`   | `/dashboard` (retail analytics) |
| `data/trade_dependency.json`  | `scripts/build_snapshot.py`   | `/trade` (dependency map)     |
| `data/products.json`          | `scripts/build_products.py`   | `/products` (catalogue search) |
| `data/cpi_daily.json`         | `scripts/build_cpi.py` (from `data/NonCoreCPI_Lebanon.csv`) | `/cpi`, landing |

The raw scrape CSV is **not committed**; re-run the build scripts against it to
refresh the snapshots:

```bash
python3 scripts/build_snapshot.py /path/to/standardized_master_enriched.csv
python3 scripts/build_products.py /path/to/standardized_master_enriched.csv
python3 scripts/build_cpi.py
```

Notes & honesty: the retail and trade views are a **cross-sectional snapshot**, not a
time series (so they are framed positionally, not as trends). Outlet/supermarket names
are never shown — figures are market-level. A small illustrative basket and the
USD/LBP rate live in `lib/data.js` and feed the per-product detail and one of the
advisor's context blocks.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY for the AI economist
npm run dev                  # http://localhost:3000
```

Every page works without an API key. The **AI Price Economist** needs
`ANTHROPIC_API_KEY` in `.env.local` (locally) or in the Vercel project's environment
variables (in production). Advisor Q&A is logged to the server/runtime logs.

## Deploy

Deploys to Vercel from `main` (push-to-deploy). Set `ANTHROPIC_API_KEY` as an
environment variable in the Vercel project settings and redeploy so the function
picks it up. Security headers (CSP, HSTS, frame-ancestors, etc.) are configured in
`next.config.mjs`.
