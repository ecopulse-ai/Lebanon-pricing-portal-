import Link from "next/link";
import AskEconomist from "@/components/AskEconomist";
import { getCpiSummary } from "@/lib/cpiData";
import { getLocale } from "@/lib/locale-server";
import { t, localizeCpiCategory } from "@/lib/i18n";

// The four instruments shown on the portal hub after sign-in.
const INSTRUMENTS = [
  { href: "/cpi", key: "cpi", n: "01", accent: "#1f5c3c", icon: <path d="M3 12h3l2.5-7 4 14 3-9 2 4h3.5" /> },
  { href: "/dashboard", key: "dashboard", n: "02", accent: "#9a7b3f", icon: <><path d="M3 3v18h18" /><path d="M7 15l3-4 3 3 4-6" /></> },
  { href: "/trade", key: "trade", n: "03", accent: "#c2152e", icon: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></> },
  { href: "/products", key: "products", n: "04", accent: "#20655f", icon: <><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" /><path d="M21 21l-4.3-4.3" /></> },
];

export default async function Home() {
  const cpi = getCpiSummary();
  const locale = await getLocale();
  const tr = (k) => t(locale, k);
  const up = cpi.cpiDoD >= 0;

  return (
    <section className="flex-1">
      {/* ── Command hero (dark) ─────────────────────────────────── */}
      <div className="relative overflow-hidden bg-ink text-paper">
        <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "radial-gradient(circle at 12% 0%, #1f5c3c, transparent 45%), radial-gradient(circle at 92% 10%, #9a7b3f, transparent 42%)" }} />
        <div aria-hidden className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative max-w-6xl mx-auto px-5 pt-12 pb-24 sm:pt-16 sm:pb-28">
          <h1 className="font-sans font-extrabold tracking-tight leading-[1.02] text-4xl sm:text-6xl">
            {tr("hub.title")}
          </h1>

          {/* Live stat chips */}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-mono text-xs text-paper/80">
              <span className="w-1.5 h-1.5 rounded-full bg-paper/40" />{tr("hub.asOf")} {cpi.lastDate}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-mono text-xs text-paper/80">
              <span className={`w-1.5 h-1.5 rounded-full ${up ? "bg-cedar" : "bg-emerald-400"}`} />{tr("hub.nonCoreCpi")} {cpi.cpi}
              <span className={up ? "text-cedar" : "text-emerald-400"}>{up ? "▲" : "▼"} {Math.abs(cpi.cpiDoD)}% {tr("hub.dod")}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-mono text-xs text-paper/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{tr("hub.fastestMover")}: {localizeCpiCategory(locale, cpi.fastestRising.name)}
            </span>
          </div>

          <p className="mt-6 max-w-xl text-paper/60 text-base sm:text-lg leading-relaxed">{tr("hub.subtitle")}</p>
        </div>
      </div>

      {/* ── Instruments (cards overlap the hero) ────────────────── */}
      <div className="relative max-w-6xl mx-auto px-5 -mt-14 pb-16">
        <div className="grid sm:grid-cols-2 gap-5">
          {INSTRUMENTS.map((p) => {
            const title = tr(`instruments.${p.key}.title`);
            return (
              <Link
                key={p.href}
                href={p.href}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_60px_-24px_rgba(18,32,25,0.45)]"
              >
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.accent }} />
                <div className="flex items-start justify-between">
                  <span className="grid place-items-center w-12 h-12 rounded-xl text-white shadow-sm" style={{ background: p.accent }}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
                  </span>
                  <span className="font-mono text-5xl font-black leading-none text-slate-100 group-hover:text-slate-200 transition-colors select-none">{p.n}</span>
                </div>
                <h2 className="mt-5 text-xl font-bold tracking-tight text-ink">{title}</h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{tr(`instruments.${p.key}.body`)}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold transition-all group-hover:gap-2.5" style={{ color: p.accent }}>
                  {tr("common.open")} {title}
                  <svg className="w-4 h-4 rtl:scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Secondary actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/briefing" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-ink text-sm font-semibold px-4 py-2.5 transition-colors">
            {tr("hub.priceWatch")}
            <svg className="w-4 h-4 rtl:scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
          <AskEconomist label={tr("hub.consult")} className="px-4 py-2.5" />
        </div>
      </div>
    </section>
  );
}
