import TradeDependencyExplorer from "@/components/TradeDependencyExplorer";
import { OriginShareChart } from "@/components/Charts";
import {
  getTradeMeta, getTradeTotals, getConcentrationNodes, getCountriesFull,
  getCriticalDependencies, getBlocs, getChokepoints,
} from "@/lib/tradeData";

export const metadata = {
  title: "Trade & Shipping Dependency — Lebanon Prices Intelligence Unit",
  description: "Lebanon's import dependency mapped: single-source concentration by category, supplier power by country, and maritime chokepoint exposure.",
};

function KpiCard({ label, value, sub, tone = "slate" }) {
  const tones = { slate: "text-slate-500", up: "text-cedar", brand: "text-brand-700" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-ink">{value}</p>
      <p className={`text-xs mt-1 font-medium ${tones[tone]}`}>{sub}</p>
    </div>
  );
}

function Panel({ title, sub, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <h2 className="font-semibold text-ink">{title}</h2>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function TradePage() {
  const meta = getTradeMeta();
  const t = getTradeTotals();
  const concentration = getConcentrationNodes();
  const countries = getCountriesFull();
  const critical = getCriticalDependencies(8);
  const blocs = getBlocs();
  const chokepoints = getChokepoints();
  const topBloc = blocs[0];

  return (
    <div className="max-w-7xl mx-auto w-full px-5 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="eyebrow">Instrument III · Trade &amp; Shipping</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />LIVE DATA
            </span>
            <span className="font-mono text-xs text-slate-400">snapshot {meta.snapshotDates.join(" – ")}</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">Trade &amp; Shipping Dependency</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">
            Where Lebanon&apos;s shelves are sourced — single-source concentration, supplier power by country, and exposure to the sea lanes those imports must travel.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Top supplier" value={t.topSupplier} sub={`${t.topSupplierShare}% of all traced imports`} tone="up" />
        <KpiCard label="Single-source categories" value={`${t.concentratedCategories}/${t.categories}`} sub="lean >50% on one country" tone="up" />
        <KpiCard label="Source countries" value={t.countries} sub={`${t.tracedPct}% of items traced`} tone="brand" />
        <KpiCard label="Suez-routed imports" value={`${t.suezSharePct}%`} sub="must transit the canal" />
      </div>

      {/* Situation */}
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 px-5 py-4">
        <p className="text-sm text-ink leading-relaxed">
          <span className="font-semibold">Situation —</span>{" "}
          Lebanon&apos;s shelves lean on <span className="font-semibold">{topBloc.name} ({topBloc.sharePct}%)</span>, with a single country,
          {" "}<span className="font-semibold text-cedar">{t.topSupplier}, supplying {t.topSupplierShare}%</span> of all traced imports.
          {" "}<span className="font-semibold">{t.concentratedCategories} of {t.categories}</span> categories depend on one source for more than half their goods — concentrated supply that a price shock, FX move or shipping disruption would transmit straight to the shelf.
        </p>
      </div>

      {/* The map */}
      <div className="mt-6">
        <TradeDependencyExplorer concentration={concentration} countries={countries} critical={critical} />
      </div>

      {/* Blocs + chokepoints */}
      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <Panel title="Supplier blocs" sub="Share of traced imports by region">
          <OriginShareChart data={blocs} height={240} />
        </Panel>
        <Panel title="Maritime chokepoint exposure" sub="Share of traced imports that must transit each chokepoint">
          <OriginShareChart data={chokepoints} height={240} />
        </Panel>
      </div>

      {/* Provenance */}
      <p className="mt-6 text-xs text-slate-400 leading-relaxed max-w-3xl">
        Dependency is inferred from each product&apos;s most-probable country of origin ({t.tracedPct}% of the catalogue traced; {t.tracedItems.toLocaleString()} items). Shipping routes and chokepoints are derived from each origin&apos;s geography to the Eastern Mediterranean — directional, for planning, not a customs manifest. {meta.note}
      </p>
    </div>
  );
}
