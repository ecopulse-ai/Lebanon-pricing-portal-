// ─── Price Watch — auto-generated weekly briefing note ───────────────────────
// Composes a minister-ready narrative deterministically from the three live
// datasets (CPI, retail snapshot, trade dependency). No model call, no
// randomness — same inputs always produce the same brief, so it is safe to
// server-render and to print/share.

import { getCpiSummary } from "@/lib/cpiData";
import { getRetailKPIs, getPriceBands, getRetailHeadlines } from "@/lib/retailData";
import { getTradeTotals, getCriticalDependencies, getBlocs, getChokepoints, getTradeMeta } from "@/lib/tradeData";

const r1 = (n) => Math.round(n * 10) / 10;
const sign = (n) => (n >= 0 ? "+" : "");

function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export function getPriceWatch() {
  const cpi = getCpiSummary();
  const k = getRetailKPIs();
  const bands = getPriceBands();
  const h = getRetailHeadlines();
  const trade = getTradeTotals();
  const crit = getCriticalDependencies(3);
  const blocs = getBlocs();
  const choke = getChokepoints();
  const meta = getTradeMeta();

  const under5 = r1(bands.slice(0, 3).reduce((a, b) => a + b.sharePct, 0));
  const above10 = r1(bands.slice(-2).reduce((a, b) => a + b.sharePct, 0));
  const outOfStock = r1(100 - k.inStockRate);
  const topBloc = blocs[0];
  const topChoke = choke[0];

  const asOf = prettyDate(cpi.lastDate);
  const period = `${prettyDate(cpi.firstDate)} – ${prettyDate(cpi.lastDate)}`;

  const cpiDir = cpi.cpiDoD > 0 ? "edged up" : cpi.cpiDoD < 0 ? "eased" : "held flat";

  const summary =
    `Non-core consumer prices ${cpiDir} to an index of ${cpi.cpi} (${sign(cpi.cpiDoD)}${cpi.cpiDoD}% day-over-day), ` +
    `led by ${cpi.fastestRising.name} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}%). ` +
    `On the shelf, the median price sits at $${k.medianPrice} with ${under5}% of goods under $5, yet availability is thin — ` +
    `${outOfStock}% of listings are out of stock. Sourcing remains import-bound: ${trade.tracedPct}% of goods trace abroad, ` +
    `led by ${trade.topSupplier} (${trade.topSupplierShare}%), and ${trade.concentratedCategories} of ${trade.categories} categories ` +
    `depend on a single country for more than half their supply. The pressure is supply and FX, not only margin.`;

  const figures = [
    { label: "Non-core CPI", value: cpi.cpi, sub: `${sign(cpi.cpiDoD)}${cpi.cpiDoD}% DoD` },
    { label: "Median shelf price", value: `$${k.medianPrice}`, sub: `${under5}% of goods under $5` },
    { label: "On-shelf availability", value: `${k.inStockRate}%`, sub: `${outOfStock}% out of stock` },
    { label: "Import dependency", value: `${trade.topSupplierShare}%`, sub: `from ${trade.topSupplier} (top supplier)` },
  ];

  const sections = [
    {
      title: "Inflation pulse (non-core daily CPI)",
      body: `The headline non-core index closed the week at ${cpi.cpi} (base 100), ${cpiDir} ${sign(cpi.cpiDoD)}${cpi.cpiDoD}% on the day. ` +
        `Food Overall stands at ${cpi.foodOverall} (${sign(cpi.foodDoD)}${cpi.foodDoD}% DoD) and the gas index at ${cpi.gas} (${sign(cpi.gasDoD)}${cpi.gasDoD}% DoD).`,
      bullets: [
        `Fastest-rising category: ${cpi.fastestRising.name} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% DoD).`,
        `Highest index level: ${cpi.highest.name} (${cpi.highest.value}); lowest: ${cpi.lowest.name} (${cpi.lowest.value}).`,
      ],
    },
    {
      title: "Cost of living & affordability",
      body: `Across the monitored catalogue the median shelf price is $${k.medianPrice} (mean $${k.meanPrice}, skewed by premium goods). ` +
        `Roughly ${under5}% of items sell under $5, while ${above10}% sit above $10 — and ${outOfStock}% of listings are currently out of stock, ` +
        `a supply signal as relevant to households as price.`,
      bullets: [
        `Cheapest broad category: ${h.cheapest?.name ?? "—"}; dearest: ${h.dearest?.name ?? "—"}.`,
        `Availability is the binding constraint where stock-outs cluster.`,
      ],
    },
    {
      title: "Import & shipping exposure",
      body: `Sourcing stays heavily import-bound: ${trade.tracedPct}% of goods trace to ${trade.countries} countries, led by the ${topBloc.name} bloc (${topBloc.sharePct}%). ` +
        `A single supplier, ${trade.topSupplier}, accounts for ${trade.topSupplierShare}% of traced imports, and ${trade.concentratedCategories} of ${trade.categories} categories are >50% single-source — ` +
        `concentration a price shock, FX move or shipping disruption would transmit straight to the shelf. Chokepoint exposure: ${topChoke.name} ${topChoke.sharePct}%.`,
      bullets: crit.map((c) => `${c.name}: ${c.topShare}% from ${c.topSource}.`),
    },
  ];

  const watchItems = [
    `${cpi.fastestRising.name} — fastest mover this week (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% DoD); confirm whether cost-driven or transient.`,
    `Stock-outs at ${outOfStock}% — flag categories where availability, not price, is squeezing households.`,
    `Single-source reliance on ${trade.topSupplier} and ${topChoke.name} routing — candidates for a diversification / buffer-stock review.`,
  ];

  return { asOf, period, snapshotDates: meta.snapshotDates, summary, figures, sections, watchItems };
}
