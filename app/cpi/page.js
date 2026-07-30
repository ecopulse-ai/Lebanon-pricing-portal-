import AskEconomist from "@/components/AskEconomist";
import CPITrends from "@/components/CPITrends";
import CpiMini3 from "@/components/CpiMini3";
import {
  getCpiSummary, getCpiHeadline, getCpiMovers, getChartData, getSparkline,
} from "@/lib/cpiData";
import { getCpiBrief } from "@/lib/briefing";
import { getBasketKPIs } from "@/lib/basketData";
import { getLocale } from "@/lib/locale-server";
import { t, localizeCpiCategory } from "@/lib/i18n";

export const metadata = {
  title: "Daily CPI — Lebanon Prices Intelligence Unit",
  description: "Lebanon Non-Core Daily CPI: a policymaker brief, this week's movers, and the household basket — base index = 100.",
};

function Delta({ v }) {
  const cls = v > 0 ? "text-cedar" : v < 0 ? "text-emerald-600" : "text-slate-400";
  return <span className={`font-mono font-medium ${cls}`}>{v > 0 ? "+" : ""}{v}%</span>;
}

function KpiCard({ label, value, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-ink font-mono">{value}</p>
      <p className="text-xs mt-1">{children}</p>
    </div>
  );
}

export default async function CpiPage() {
  const locale = await getLocale();
  const tr = (k) => t(locale, k);
  const ar = locale === "ar";

  const [headline, rawMovers, brief, chartData, summary, tailCPI, tailFood, tailGas] = await Promise.all([
    getCpiHeadline(),
    getCpiMovers(),
    getCpiBrief(locale),
    getChartData(),
    getCpiSummary(),
    getSparkline("CPI"),
    getSparkline("FoodOverall"),
    getSparkline("GasCPI"),
  ]);
  const movers = rawMovers.map((m) => ({ ...m, name: localizeCpiCategory(locale, m.name) }));
  const sparklines = { CPI: tailCPI, FoodOverall: tailFood, GasCPI: tailGas };
  const basket = getBasketKPIs();
  const chartLabels = {
    CPI: ar ? "المؤشّر" : "CPI",
    FoodOverall: ar ? "الغذاء" : "Food",
    GasCPI: ar ? "الغاز" : "Gas",
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-5 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="eyebrow">{tr("cpi.eyebrow")}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />{tr("common.live")} · {ar ? "يومي" : "DAILY"}
            </span>
            <span className="font-mono text-xs text-slate-400">{ar ? "أساس 100 · حتى" : "base 100 · as of"} {headline.lastDate}</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">{tr("cpi.title")}</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">{tr("cpi.desc")}</p>
        </div>
        <AskEconomist label={tr("cpi.ask")} className="self-start" />
      </div>

      {/* Daily brief — words first */}
      <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow text-brand-700">{ar ? "الموجز اليومي" : "Daily brief"}</span>
          <span className="font-mono text-[11px] text-slate-400">· {brief.asOf}</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {brief.lines.map((line, i) => (
            <li key={i} className="text-[15px] sm:text-base text-ink leading-relaxed flex gap-2">
              <span className="text-brand-600 mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* KPIs — week-over-week is the lead clock */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={ar ? "المؤشّر غير الأساسي" : "Non-core CPI"} value={headline.cpi.value}>
          <span className="text-slate-500">{ar ? "أسبوعياً" : "WoW"} </span><Delta v={headline.cpi.wow} />
          <span className="text-slate-400"> · 30{ar ? "ي" : "d"} </span><Delta v={headline.cpi.m30} />
        </KpiCard>
        <KpiCard label={ar ? "الغذاء إجمالاً" : "Food overall"} value={headline.food.value}>
          <span className="text-slate-500">{ar ? "أسبوعياً" : "WoW"} </span><Delta v={headline.food.wow} />
          <span className="text-slate-400"> · 30{ar ? "ي" : "d"} </span><Delta v={headline.food.m30} />
        </KpiCard>
        <KpiCard label={ar ? "مؤشّر الغاز" : "Gas CPI"} value={headline.gas.value}>
          <span className="text-slate-500">{ar ? "أسبوعياً" : "WoW"} </span><Delta v={headline.gas.wow} />
          <span className="text-slate-400"> · 30{ar ? "ي" : "d"} </span><Delta v={headline.gas.m30} />
        </KpiCard>
        <KpiCard label={ar ? "سلة التجزئة (الوسيط)" : "Retail basket (median)"} value={`$${basket.basketMedian}`}>
          <span className="text-slate-500">{basket.itemsTracked} {ar ? "سلعة · حتى" : "items · as of"} {basket.latestDate}</span>
        </KpiCard>
      </div>

      {/* Movers table (fuses the old deviation chart + category table + highest-category card) */}
      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-ink">{ar ? "أبرز التحرّكات هذا الأسبوع" : "This week's movers"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ar ? "المؤشّر والتغيّر الأسبوعي و30 يوماً · مرتّبة بالأكثر تحرّكاً" : "Index · week-over-week · 30-day — ranked by biggest move"}</p>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
                <tr>
                  <th className="px-5 py-3 font-medium">{ar ? "الفئة" : "Category"}</th>
                  <th className="px-5 py-3 font-medium text-right rtl:text-left">{ar ? "المؤشّر" : "Index"}</th>
                  <th className="px-5 py-3 font-medium text-right rtl:text-left">{ar ? "أسبوعياً" : "WoW"}</th>
                  <th className="px-5 py-3 font-medium text-right rtl:text-left">{ar ? "30 يوماً" : "30-day"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movers.map((c) => (
                  <tr key={c.key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right rtl:text-left font-mono font-semibold">{c.value}</td>
                    <td className="px-5 py-2.5 text-right rtl:text-left"><Delta v={c.wow} /></td>
                    <td className="px-5 py-2.5 text-right rtl:text-left"><Delta v={c.m30} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Default chart: three series only */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-ink">{ar ? "المؤشّر · الغذاء · الغاز" : "CPI · Food · Gas"}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{ar ? "المسار اليومي (أساس 100)" : "Daily path (base 100)"}</p>
          <div className="mt-4">
            <CpiMini3 data={chartData} height={300} labels={chartLabels} />
          </div>
        </div>
      </div>

      {/* Analyst view — full series & day-over-day, collapsed by default */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden group">
        <summary className="px-5 py-4 cursor-pointer select-none flex items-center justify-between text-ink font-semibold list-none">
          <span>{ar ? "عرض المحلّل — كل السلاسل والتغيّر اليومي" : "Analyst view — all series & day-over-day"}</span>
          <span className="text-slate-400 text-sm group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-5 pb-6 border-t border-slate-100">
          <div className="mt-5">
            <CPITrends locale={locale} summary={summary} chartData={chartData} sparklines={sparklines} />
          </div>
          <div className="mt-6 overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
                <tr>
                  <th className="px-4 py-3 font-medium">{ar ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "المؤشّر" : "Index"}</th>
                  <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "يومي" : "DoD"}</th>
                  <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "أسبوعياً" : "WoW"}</th>
                  <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "30 يوماً" : "30-day"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movers.map((c) => (
                  <tr key={c.key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right rtl:text-left font-mono font-semibold">{c.value}</td>
                    <td className="px-4 py-2.5 text-right rtl:text-left"><Delta v={c.dod} /></td>
                    <td className="px-4 py-2.5 text-right rtl:text-left"><Delta v={c.wow} /></td>
                    <td className="px-4 py-2.5 text-right rtl:text-left"><Delta v={c.m30} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <p className="mt-6 text-xs text-slate-400 font-mono">
        {ar
          ? "المصدر: جمع أسعار يومي عبر سبينيز وكارفور والمخازن · مؤشر جيفنز الأولي مجمّع عبر مؤشر يانغ (دليل صندوق النقد الدولي لمؤشر أسعار المستهلك، 2020) · فترة الأساس 15 حزيران 2026 = 100 · سلة التجزئة من data/basket_prices.json."
          : "Source: Daily price collection — Spinneys, Carrefour & Al Makhazen · Jevons elementary index aggregated via Young's index (IMF CPI Manual, 2020) · Base period 15 Jun 2026 = 100 · Retail basket from data/basket_prices.json."}
      </p>
    </div>
  );
}
