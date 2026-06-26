import AskEconomist from "@/components/AskEconomist";
import {
  OriginShareChart, PriceBandChart, CategoryShareChart,
} from "@/components/Charts";
import {
  getRetailKPIs, getSnapshotMeta, getCategories, getOrigins,
  getPriceBands, getTopBrands,
} from "@/lib/retailData";
import { getLocale } from "@/lib/locale-server";
import { t, localizeCategory, localizeOrigin } from "@/lib/i18n";

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

export default async function DashboardPage() {
  const locale = await getLocale();
  const tr = (key) => t(locale, key);
  const ar = locale === "ar";
  const k = getRetailKPIs();
  const meta = getSnapshotMeta();
  const categories = getCategories().map((c) => ({ ...c, name: localizeCategory(locale, c.name) }));
  const origins = getOrigins().map((o) => ({ ...o, name: localizeOrigin(locale, o.name) }));
  const bands = getPriceBands();
  const brands = getTopBrands(8);

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
            <span className="eyebrow">{tr("dash.eyebrow")}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />{tr("common.liveData")}
            </span>
            <span className="font-mono text-xs text-slate-400">{tr("common.snapshot")} {meta.snapshotDates.join(" – ")}</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">{tr("dash.title")}</h1>
          <p className="mt-1 text-slate-600">
            {k.products.toLocaleString()} {tr("dash.desc1")}
          </p>
        </div>
        <AskEconomist label={tr("dash.ask")} className="self-start" />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={tr("dash.kpiItems")} value={k.products.toLocaleString()} sub={`${tr("dash.kpiItemsSub")} · ${k.categories} ${tr("dash.kpiCats")}`} />
        <KpiCard label={tr("dash.kpiMedian")} value={`$${k.medianPrice}`} sub={`${tr("dash.kpiMedianSub")} $${k.meanPrice} ${tr("dash.kpiMedianSub2")}`} />
        <KpiCard label={tr("dash.kpiAvail")} value={`${k.inStockRate}%`} sub={`${outOfStock}% ${tr("dash.kpiAvailSub")}`} tone={k.inStockRate >= 75 ? "down" : "up"} />
        <KpiCard label={tr("dash.kpiImport")} value={`${k.originCountries} ${tr("dash.kpiImportCountries")}`} sub={`${k.tracedToOriginPct}% ${tr("dash.kpiImportSub")}`} tone="brand" />
      </div>

      {/* Situation callout */}
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 px-5 py-4">
        <p className="text-sm text-ink leading-relaxed">
          <span className="font-semibold">{tr("dash.situation")}</span>{" "}
          <span className="font-semibold text-brand-700">{under5}%</span> {tr("dash.sitUnder5")} ${k.medianPrice}),
          {" "}{tr("dash.sitAbove10a")} <span className="font-semibold">{above10}%</span> {tr("dash.sitAbove10b")}
          {" "}<span className="font-semibold text-cedar">{outOfStock}% {tr("dash.sitOOS")}</span>{tr("dash.sitSupply")}
          {" "}<span className="font-semibold">{topOrigin.name} ({topOrigin.sharePct}%)</span>. {tr("dash.sitTrack")}
        </p>
      </div>

      {/* Row A — affordability + catalogue mix */}
      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <Panel title={tr("dash.affordability")} sub={tr("dash.affordabilitySub")}>
          <PriceBandChart data={bands} height={440} />
        </Panel>
        <Panel className="lg:col-span-2" title={tr("dash.catalogue")} sub={tr("dash.catalogueSub")}>
          <CategoryShareChart data={categories} height={440} />
        </Panel>
      </div>

      {/* Row B — sourcing + brands */}
      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2" title={tr("dash.importDep")} sub={`${tr("dash.importDepSub")} ${k.tracedToOriginPct}% ${tr("dash.importDepSub2")}`}>
          <OriginShareChart data={origins} height={360} />
        </Panel>
        <Panel title={tr("dash.brands")} sub={tr("dash.brandsSub")}>
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
        {ar
          ? "لقطة مقطعية لرفوف التجزئة في لبنان عبر عدة سلاسل. جُمعت في أيام مختلفة، فالأرقام موضعية (مستوى السعر، التوفّر، المصدر) — لا سلسلة زمنية."
          : meta.note}{" "}
        {tr("dash.provenance")} {meta.source} ({meta.rawCategories} {tr("dash.provNorm")} {k.categories} {tr("dash.provGroups")})
      </p>
    </div>
  );
}
