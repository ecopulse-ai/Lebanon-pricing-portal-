import TradeDependencyExplorer from "@/components/TradeDependencyExplorer";
import { OriginShareChart } from "@/components/Charts";
import {
  getTradeMeta, getTradeTotals, getConcentrationNodes, getCountriesFull,
  getCriticalDependencies, getBlocs, getChokepoints,
} from "@/lib/tradeData";
import { getLocale } from "@/lib/locale-server";
import { t, localizeCategory, localizeOrigin, localizeBloc, localizeChokepoint } from "@/lib/i18n";

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

export default async function TradePage() {
  const locale = await getLocale();
  const tr = (k) => t(locale, k);
  const ar = locale === "ar";
  const meta = getTradeMeta();
  const tot = getTradeTotals();

  const concentration = getConcentrationNodes().map((n) => ({
    ...n,
    label: localizeCategory(locale, n.label),
    source: localizeOrigin(locale, n.source),
    top3: n.top3.map((s) => ({ ...s, name: localizeOrigin(locale, s.name) })),
  }));
  const countries = getCountriesFull().map((c) => ({
    ...c,
    name: localizeOrigin(locale, c.name),
    chokepoints: c.chokepoints.map((ch) => localizeChokepoint(locale, ch)),
    supplies: c.supplies.map((s) => ({ ...s, category: localizeCategory(locale, s.category) })),
  }));
  const critical = getCriticalDependencies(8).map((c) => ({
    ...c, name: localizeCategory(locale, c.name), topSource: localizeOrigin(locale, c.topSource),
  }));
  const blocs = getBlocs().map((b) => ({ ...b, name: localizeBloc(locale, b.name) }));
  const chokepoints = getChokepoints().map((c) => ({ ...c, name: localizeChokepoint(locale, c.name) }));
  const topBloc = blocs[0];
  const topSupplier = localizeOrigin(locale, tot.topSupplier);

  return (
    <div className="max-w-7xl mx-auto w-full px-5 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="eyebrow">{tr("trade.eyebrow")}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />{tr("common.liveData")}
            </span>
            <span className="font-mono text-xs text-slate-400">{tr("common.snapshot")} {meta.snapshotDates.join(" – ")}</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">{tr("trade.title")}</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">{tr("trade.desc")}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={tr("trade.kpiTop")} value={topSupplier} sub={`${tot.topSupplierShare}% ${tr("trade.kpiTopSub")}`} tone="up" />
        <KpiCard label={tr("trade.kpiSingle")} value={`${tot.concentratedCategories}/${tot.categories}`} sub={tr("trade.kpiSingleSub")} tone="up" />
        <KpiCard label={tr("trade.kpiCountries")} value={tot.countries} sub={`${tot.tracedPct}% ${tr("trade.kpiCountriesSub")}`} tone="brand" />
        <KpiCard label={tr("trade.kpiSuez")} value={`${tot.suezSharePct}%`} sub={tr("trade.kpiSuezSub")} />
      </div>

      {/* Situation */}
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 px-5 py-4">
        <p className="text-sm text-ink leading-relaxed">
          <span className="font-semibold">{tr("trade.situation")}</span>{" "}
          {tr("trade.sitLeanOn")} <span className="font-semibold">{topBloc.name} ({topBloc.sharePct}%)</span>, {tr("trade.sitWithCountry")}
          {" "}<span className="font-semibold text-cedar">{topSupplier} {tr("trade.sitSupplying")} {tot.topSupplierShare}%</span> {tr("trade.sitOfImports")}
          {" "}<span className="font-semibold">{tot.concentratedCategories} / {tot.categories}</span> {tr("trade.sitCats")}
        </p>
      </div>

      {/* The map */}
      <div className="mt-6">
        <TradeDependencyExplorer concentration={concentration} countries={countries} critical={critical} locale={locale} />
      </div>

      {/* Blocs + chokepoints */}
      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <Panel title={tr("trade.blocs")} sub={tr("trade.blocsSub")}>
          <OriginShareChart data={blocs} height={240} />
        </Panel>
        <Panel title={tr("trade.chokepoints")} sub={tr("trade.chokepointsSub")}>
          <OriginShareChart data={chokepoints} height={240} />
        </Panel>
      </div>

      {/* Provenance */}
      <p className="mt-6 text-xs text-slate-400 leading-relaxed max-w-3xl">
        {ar
          ? `يُستنتج الاعتماد من بلد المنشأ الأرجح لكل منتج (${tot.tracedPct}% من الكتالوج متعقَّب؛ ${tot.tracedItems.toLocaleString()} عنصر). مسارات الشحن والمضايق مستنتجة من جغرافيا كل منشأ نحو شرق المتوسط — توجيهية للتخطيط، لا بيان جمركي.`
          : `Dependency is inferred from each product's most-probable country of origin (${tot.tracedPct}% of the catalogue traced; ${tot.tracedItems.toLocaleString()} items). Shipping routes and chokepoints are derived from each origin's geography to the Eastern Mediterranean — directional, for planning, not a customs manifest.`}
      </p>
    </div>
  );
}
