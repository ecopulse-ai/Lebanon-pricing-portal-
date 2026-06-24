# Mizan — Lebanon Price Intelligence

A portal that aggregates prices of goods from Lebanese online retail and wholesale
stores and turns them into analytics: a live food-basket index, category inflation,
retail-vs-wholesale gaps, cheapest-source search, and an AI advisor.

Built with **Next.js 16** (App Router), **Tailwind CSS v4**, **Recharts**, and the
**Anthropic SDK**.

## Pages

| Route        | What it does                                                        |
|--------------|--------------------------------------------------------------------|
| `/`          | Marketing landing page (hero, features, pricing, FAQ)              |
| `/dashboard` | KPIs, category trend, retail-vs-wholesale markup, inflation, movers |
| `/products`  | Search goods, see USD/LBP prices, cheapest source, 12-mo history    |
| `/advisor`   | Claude-powered chat that answers price questions with charts/tables |

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY for the advisor
npm run dev                  # http://localhost:3000
```

The dashboard, products and landing pages work without any API key. The **AI
Advisor** needs `ANTHROPIC_API_KEY` in `.env.local`.

## Data

All figures are **illustrative demo data** in `lib/data.js`. Every page and the AI
advisor read from the helper functions there — swap those for a real API/database and
the rest of the app keeps working unchanged.

## Deploy

Deploys to Vercel as-is. Set `ANTHROPIC_API_KEY` as an environment variable in the
Vercel project settings.
