import { Seal } from "@/components/Navbar";
import BriefingActions from "@/components/BriefingActions";
import { CpiDeviationChart, PriceBandChart } from "@/components/Charts";
import { getPriceWatch } from "@/lib/briefing";
import { getLatestSnapshot } from "@/lib/cpiData";
import { getPriceBands } from "@/lib/retailData";
import { getLocale } from "@/lib/locale-server";
import { t, localizeCpiCategory } from "@/lib/i18n";

export const metadata = {
  title: "Price Watch — Weekly Brief | Lebanon Prices Intelligence Unit",
  description: "Auto-generated weekly Price Watch note: inflation pulse, affordability and import-dependency for the Office of the Minister.",
};

export default async function BriefingPage() {
  const locale = await getLocale();
  const tr = (k) => t(locale, k);
  const b = getPriceWatch(locale);
  const cpiSnap = getLatestSnapshot().map((c) => ({ name: localizeCpiCategory(locale, c.name), dev: c.dev }));
  const bands = getPriceBands();

  return (
    <div className="max-w-4xl mx-auto w-full px-5 py-8 print:py-0 print:px-0">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 print:hidden">
        <div>
          <span className="eyebrow">{tr("briefing.artifact")}</span>
          <h1 className="mt-1 text-2xl font-semibold font-display text-ink">{tr("briefing.title")}</h1>
        </div>
        <BriefingActions locale={locale} />
      </div>

      {/* The document */}
      <article className="memo rounded-sm bg-white border border-[rgba(18,32,25,0.14)] p-7 sm:p-9 print:border-0 print:p-0">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-[rgba(18,32,25,0.14)]">
          <div className="flex items-center gap-3">
            <Seal className="w-12 h-12" />
            <div className="leading-tight">
              <p className="font-display text-xl font-semibold text-ink">{tr("briefing.headTitle")}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{tr("briefing.headSub")}</p>
            </div>
          </div>
          <div className="text-end font-mono text-[10px] text-slate-500 leading-snug">
            {tr("common.asOf")}<br />{b.asOf}<br /><span className="text-slate-400">{b.period}</span>
          </div>
        </header>

        {/* Executive summary */}
        <section className="mt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-600">{tr("briefing.execSummary")}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{b.summary}</p>
        </section>

        {/* Headline figures */}
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[rgba(18,32,25,0.12)] border border-[rgba(18,32,25,0.12)] rounded-sm overflow-hidden">
          {b.figures.map((f) => (
            <div key={f.label} className="bg-white p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{f.label}</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-ink">{f.value}</p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{f.sub}</p>
            </div>
          ))}
        </section>

        {/* Charts */}
        <section className="mt-7 grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-ink text-sm">{tr("briefing.chartCpi")}</h3>
            <div className="mt-2"><CpiDeviationChart data={cpiSnap} height={300} /></div>
          </div>
          <div>
            <h3 className="font-semibold text-ink text-sm">{tr("briefing.chartAfford")}</h3>
            <div className="mt-2"><PriceBandChart data={bands} height={300} /></div>
          </div>
        </section>

        {/* Narrative sections */}
        {b.sections.map((s) => (
          <section key={s.title} className="mt-7 break-inside-avoid">
            <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700">{s.body}</p>
            {s.bullets?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {s.bullets.map((x, i) => (
                  <li key={i} className="flex gap-2"><span className="text-amber-600">▪</span><span>{x}</span></li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* Watch list */}
        <section className="mt-7 rounded-sm border border-amber-500/30 bg-amber-50/50 p-4 break-inside-avoid">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700">{tr("briefing.watchList")}</h3>
          <ol className="mt-2 space-y-1.5 text-sm text-ink list-decimal list-inside">
            {b.watchItems.map((w, i) => <li key={i}>{w}</li>)}
          </ol>
        </section>

        {/* Footer */}
        <footer className="mt-7 pt-4 border-t border-[rgba(18,32,25,0.14)] text-[11px] text-slate-400 leading-relaxed">
          {tr("briefing.footer")} {b.snapshotDates?.join(" & ")}; {tr("briefing.footer2")}
        </footer>
      </article>
    </div>
  );
}
