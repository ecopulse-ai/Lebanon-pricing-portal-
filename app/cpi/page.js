import AskEconomist from "@/components/AskEconomist";
import CPITrends from "@/components/CPITrends";
import { CpiDeviationChart } from "@/components/Charts";
import { getCpiSummary, getLatestSnapshot } from "@/lib/cpiData";
import { getLocale } from "@/lib/locale-server";
import { t, localizeCpiCategory } from "@/lib/i18n";

export const metadata = {
  title: "Daily CPI — Lebanon Prices Intelligence Unit",
  description: "Lebanon Non-Core Daily CPI: headline index, food categories, daily trends and category snapshot, base index = 100.",
};

export default async function CpiPage() {
  const s = getCpiSummary();
  const locale = await getLocale();
  const tr = (k) => t(locale, k);
  const ar = locale === "ar";
  const snapshot = getLatestSnapshot().map((c) => ({ ...c, name: localizeCpiCategory(locale, c.name) }));

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
            <span className="font-mono text-xs text-slate-400">{ar ? "أساس 100 · حتى" : "base 100 · as of"} {s.lastDate}</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">{tr("cpi.title")}</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">{tr("cpi.desc")}</p>
        </div>
        <AskEconomist label={tr("cpi.ask")} className="self-start" />
      </div>

      {/* Trends (readings + selector + chart) */}
      <div className="mt-7">
        <CPITrends locale={locale} />
      </div>

      {/* Snapshot + table */}
      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-ink">{ar ? "أحدث لقطة للفئات" : "Latest category snapshot"}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{ar ? "الانحراف عن أساس 100" : "Deviation from base 100"} · {s.lastDate}</p>
          <div className="mt-4">
            <CpiDeviationChart data={snapshot} height={380} />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-ink">{ar ? "جدول الفئات" : "Category table"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ar ? "المؤشّر والتغيّر اليومي" : "Index & day-over-day change"}</p>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
                <tr>
                  <th className="px-5 py-3 font-medium">{ar ? "الفئة" : "Category"}</th>
                  <th className="px-5 py-3 font-medium text-right rtl:text-left">{ar ? "المؤشّر" : "Index"}</th>
                  <th className="px-5 py-3 font-medium text-right rtl:text-left">{ar ? "يومي" : "DoD"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.map((c) => (
                  <tr key={c.key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right rtl:text-left font-mono font-semibold">{c.value}</td>
                    <td className={`px-5 py-2.5 text-right rtl:text-left font-mono font-medium ${c.dod > 0 ? "text-cedar" : c.dod < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {c.dod > 0 ? "+" : ""}{c.dod}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400 font-mono">
        {ar ? "المصدر: data/NonCoreCPI_Lebanon.csv · قراءات يومية · أساس المؤشّر = 100." : "Source: data/NonCoreCPI_Lebanon.csv · daily readings · base index = 100."}
      </p>
    </div>
  );
}
