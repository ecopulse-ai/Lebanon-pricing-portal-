import AskEconomist from "@/components/AskEconomist";
import {
  OriginShareChart, PriceBandChart, CategoryShareChart,
} from "@/components/Charts";
import {
  getRetailKPIs, getSnapshotMeta, getCategories, getOrigins,
  getPriceBands, getTopBrands,
} from "@/lib/retailData";

export const metadata = {
  title: "Retail Analytics — Lebanon Prices Intelligence Unit",
  description: "Strategic shelf-price analytics for Lebanon: affordability, category mix, import dependency and price levels from a live market snapshot.",
};

function KpiCard({ label, value, sub, tone = "slate" }) {
  const tones = { slate: "text-slate-500", up: "text-cedar", down: "text-emerald-600", brand: "text-brand-700" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-ink">{value}</p>
      <p className={`text-xs mt-1 font-medium ${tones[tone]}`}>{sub}</p>
    </div>
  );
}

function Panel({ title, sub, children, right, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const k = getRetailKPIs();
  const meta = getSnapshotMeta();
  const categories = getCategories();
  const origins = getOrigins();
  const bands = getPriceBands();
  const brands = getTopBrands(8);

  // Market-level reads (no store-level comparison).
  const under5 = Math.round(bands.slice(0, 3).reduce((a, b) => a + b.sharePct, 0) * 10) / 10;
  const above10 = Math.round(bands.slice(-2).reduce((a, b) => a + b.sharePct, 0) * 10) / 10;
  const outOfStock = Math.round((100 - k.inStockRate) * 10) / 10;
  const topOrigin = origins[0];

  return (
    <div className="max-w-7xl mx-auto w-full px-5 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="eyebrow">Instrument II · Retail &amp; Wholesale</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />LIVE DATA
            </span>
            <span className="font-mono text-xs text-slate-400">snapshot {meta.snapshotDates.join(" – ")}</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">Lebanon Retail Analytics</h1>
          <p className="mt-1 text-slate-600">
            {k.products.toLocaleString()} shelf prices read for affordability, category mix and import sourcing.
          </p>
        </div>
        <AskEconomist label="Ask the Retail Analyst" className="self-start" />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Items priced" value={k.products.toLocaleString()} sub={`national retail coverage · ${k.categories} categories`} />
        <KpiCard label="Median shelf price" value={`$${k.medianPrice}`} sub={`mean $${k.meanPrice} (skewed by premium goods)`} />
        <KpiCard label="On-shelf availability" value={`${k.inStockRate}%`} sub={`${outOfStock}% of listings out of stock`} tone={k.inStockRate >= 75 ? "down" : "up"} />
        <KpiCard label="Import dependency" value={`${k.originCountries} countries`} sub={`${k.tracedToOriginPct}% of items traced abroad`} tone="brand" />
      </div>

      {/* Situation callout — market level, no store comparison */}
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 px-5 py-4">
        <p className="text-sm text-ink leading-relaxed">
          <span className="font-semibold">Situation —</span>{" "}
          <span className="font-semibold text-brand-700">{under5}%</span> of tracked goods sell under $5 (median ${k.medianPrice}), yet
          {" "}<span className="font-semibold">{above10}%</span> sit above $10. With
          {" "}<span className="font-semibold text-cedar">{outOfStock}% of listings out of stock</span>, supply gaps are widespread, and sourcing stays import-bound — led by
          {" "}<span className="font-semibold">{topOrigin.name} ({topOrigin.sharePct}%)</span>. Shelf prices track global costs and FX, not just margin.
        </p>
      </div>

      {/* Row A — affordability + catalogue mix */}
      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <Panel title="Affordability" sub="Items by price band (USD)">
          <PriceBandChart data={bands} height={440} />
        </Panel>
        <Panel className="lg:col-span-2" title="Catalogue mix" sub="Share of items by category (median price on hover)">
          <CategoryShareChart data={categories} height={440} />
        </Panel>
      </div>

      {/* Row B — sourcing + brands */}
      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2" title="Import dependency" sub={`Share of the ${k.tracedToOriginPct}% of items traced to a source country`}>
          <OriginShareChart data={origins} height={360} />
        </Panel>
        <Panel title="Leading brands" sub="Most-listed brands on shelf">
          <ul className="divide-y divide-slate-100 -mt-1">
            {brands.map((b, i) => (
              <li key={b.name} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-400 tabular-nums w-4">{i + 1}</span>
                  <span className="text-sm font-medium text-ink">{b.name}</span>
                </span>
                <span className="font-mono text-xs text-slate-500">{b.products.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Provenance */}
      <p className="mt-6 text-xs text-slate-400 leading-relaxed max-w-3xl">
        {meta.note} Source: {meta.source} ({meta.rawCategories} raw categories normalized to {k.categories} strategic groups).
      </p>
    </div>
  );
}
