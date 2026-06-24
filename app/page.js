import Link from "next/link";
import AskEconomist from "@/components/AskEconomist";
import Reveal from "@/components/Reveal";
import { Seal } from "@/components/Navbar";
import { BasketAreaChart } from "@/components/Charts";
import { getBasketIndex, getKPIs } from "@/lib/data";
import { getCpiSummary } from "@/lib/cpiData";

// What the portal answers — the minister's standing questions.
const QUESTIONS = [
  { q: "Where are prices moving today?", a: "A daily non-core CPI by category, indexed to 100 — the national price pulse without waiting on monthly statistics." },
  { q: "Which goods are squeezing households?", a: "Fastest-rising categories and the widest retail-vs-wholesale gaps, ranked and dated." },
  { q: "Is the market or the margin to blame?", a: "Side-by-side retail and wholesale prices expose where markups, not costs, drive the shelf price." },
  { q: "What should we say, and to whom?", a: "An AI advisor that turns the underlying data into briefings, charts and tables on demand." },
];

const PILLARS = [
  {
    href: "/cpi", n: "I", tone: "brand",
    title: "Non-Core Daily CPI",
    body: "The daily consumer-price index for Lebanon's non-core food basket — by category, indexed to 100, with trends and a live category snapshot.",
    cta: "Open the daily index",
    icon: <path d="M3 12h3l2.5-7 4 14 3-9 2 4h3.5" />,
  },
  {
    href: "/dashboard", n: "II", tone: "amber",
    title: "Retail & Wholesale Analytics",
    body: "Prices of goods across retail and wholesale stores — basket index, category trends, markup gaps and cheapest-source search.",
    cta: "Open retail analytics",
    icon: <><path d="M3 3v18h18" /><path d="M7 15l3-4 3 3 4-6" /></>,
  },
];

export default function Home() {
  const basket = getBasketIndex();
  const k = getKPIs();
  const cpi = getCpiSummary();

  return (
    <>
      {/* ── Hero: the standfirst + the daily brief memo ───────────────────── */}
      <section className="relative overflow-hidden border-b border-[rgba(18,32,25,0.1)]">
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% -10%, rgba(31,92,60,0.10), transparent 42%), radial-gradient(circle at 95% 0%, rgba(154,123,63,0.08), transparent 40%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-5 pt-14 sm:pt-20 pb-16">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            {/* Standfirst */}
            <div>
              <div className="flex items-center gap-3">
                <span className="eyebrow">Strategic Price Intelligence</span>
                <span className="h-px w-8 bg-amber-500/60" />
                <span className="font-mono text-[11px] text-slate-500">Prepared for the Office of the Minister</span>
              </div>
              <h1 className="mt-6 font-display font-semibold text-ink leading-[1.05] tracking-tight text-4xl sm:text-5xl lg:text-[3.4rem]">
                Lebanon&apos;s prices, read like a brief —
                <span className="italic text-brand-700"> not a spreadsheet.</span>
              </h1>
              <p className="mt-6 text-lg text-slate-700 max-w-xl leading-relaxed">
                The Lebanon Prices Intelligence Unit turns daily price signals from across the country&apos;s retail and wholesale markets into a single, dependable read on inflation — so the Ministry sees where prices are going before the monthly numbers confirm it.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/cpi" className="inline-flex justify-center items-center gap-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white font-medium px-6 py-3.5 transition-colors cursor-pointer">
                  Open the Daily Brief
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </Link>
                <AskEconomist label="Consult the economist" variant="outline" className="px-6 py-3.5" />
              </div>
              <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md border-t border-[rgba(18,32,25,0.12)] pt-6">
                <div><dt className="font-mono text-2xl font-semibold text-ink">{k.storesMonitored}+</dt><dd className="text-xs text-slate-500 mt-1">Stores monitored</dd></div>
                <div><dt className="font-mono text-2xl font-semibold text-ink">Daily</dt><dd className="text-xs text-slate-500 mt-1">CPI cadence</dd></div>
                <div><dt className="font-mono text-2xl font-semibold text-ink">USD · LBP</dt><dd className="text-xs text-slate-500 mt-1">Dual currency</dd></div>
              </dl>
            </div>

            {/* The Daily Brief memo */}
            <Reveal>
              <figure className="memo rounded-sm p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-[rgba(18,32,25,0.14)]">
                  <div className="flex items-center gap-3">
                    <Seal className="w-10 h-10" />
                    <div className="leading-tight">
                      <p className="font-display font-semibold text-ink">The Daily Brief</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Non-core price situation</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 text-right leading-snug">
                    AS OF<br />{cpi.lastDate}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">CPI · base 100</p>
                    <p className="mt-1 font-mono text-4xl font-semibold text-ink leading-none">{cpi.cpi}</p>
                    <p className={`mt-1.5 font-mono text-xs font-semibold ${cpi.cpiDoD > 0 ? "text-cedar" : cpi.cpiDoD < 0 ? "text-brand-700" : "text-slate-400"}`}>
                      {cpi.cpiDoD > 0 ? "▲" : cpi.cpiDoD < 0 ? "▼" : "•"} {Math.abs(cpi.cpiDoD)}% day-over-day
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Food basket index</p>
                    <p className="mt-1 font-mono text-4xl font-semibold text-brand-700 leading-none">{k.basketIndex}</p>
                    <p className="mt-1.5 font-mono text-xs font-semibold text-cedar">▲ {k.basketChangeMoM}% month-over-month</p>
                  </div>
                </div>

                <div className="mt-5">
                  <BasketAreaChart data={basket} height={150} />
                </div>

                <figcaption className="mt-4 pt-4 border-t border-[rgba(18,32,25,0.14)] text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold text-ink">Situation —</span> {cpi.fastestRising.name} is the fastest-moving category ({cpi.fastestRising.value > 0 ? "+" : ""}{cpi.fastestRising.value}% DoD); the food basket continues to drift above base. Watch margins, not only costs.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── The two instruments ───────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-5">
          <div className="max-w-3xl">
            <span className="eyebrow">Two instruments</span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
              The brief, in two lenses:{" "}
              <span className="font-normal text-slate-600 text-2xl sm:text-3xl">One reads the index. The other reads the shelf. Together they separate genuine cost pressure from margin.</span>
            </h2>
          </div>
          <div className="mt-10 grid md:grid-cols-2 gap-6">
            {PILLARS.map((p) => (
              <Link key={p.href} href={p.href} className="group memo rounded-sm p-7 transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <span className={`grid place-items-center w-12 h-12 rounded-sm ${p.tone === "brand" ? "bg-brand-50 text-brand-700" : "bg-amber-500/12 text-amber-600"}`}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
                  </span>
                  <span className="font-display text-3xl text-slate-300">{p.n}</span>
                </div>
                <h3 className="mt-5 font-display text-2xl font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">{p.body}</p>
                <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all ${p.tone === "brand" ? "text-brand-700" : "text-amber-600"}`}>
                  {p.cta}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── What this portal answers ──────────────────────────────────────── */}
      <section className="py-16 bg-white border-y border-[rgba(18,32,25,0.1)]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="max-w-2xl">
            <span className="eyebrow">The remit</span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink">The questions it answers</h2>
            <p className="mt-3 text-slate-600 text-lg">Standing questions for the Office of the Minister — answered from live data, not anecdote.</p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {QUESTIONS.map((item, i) => (
              <Reveal key={i} className="flex gap-4">
                <span className="font-mono text-sm text-amber-600 pt-1 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div className="border-l border-[rgba(18,32,25,0.12)] pl-4">
                  <h3 className="font-display text-xl font-semibold text-ink">{item.q}</h3>
                  <p className="mt-1.5 text-slate-600 text-sm leading-relaxed">{item.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Executive numbers strip ───────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-5">
          <span className="eyebrow">Today, in figures</span>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-px bg-[rgba(18,32,25,0.12)] border border-[rgba(18,32,25,0.12)] rounded-sm overflow-hidden">
            {[
              ["Non-core CPI", cpi.cpi, `${cpi.cpiDoD >= 0 ? "+" : ""}${cpi.cpiDoD}% DoD`],
              ["Food basket index", k.basketIndex, `+${k.basketChangeMoM}% MoM`],
              ["Avg. basket (USD)", `$${k.avgBasketUsd}`, "14-item basket"],
              ["USD market rate", k.usdRate.toLocaleString(), "LBP / USD"],
            ].map(([label, value, sub], i) => (
              <div key={i} className="bg-white p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-ink">{value}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Methodology ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-[rgba(18,32,25,0.1)]">
        <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <div>
            <span className="eyebrow">Method &amp; sources</span>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">How the brief is built</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              ["Collected", "Prices are gathered daily from Lebanese online retail and wholesale storefronts and matched to a fixed basket."],
              ["Normalized", "Units are standardized and every price is expressed in both USD and LBP at the day's market rate."],
              ["Indexed", "Category and headline indices are computed against a base of 100 — a like-for-like read as the rate moves."],
            ].map(([h, b]) => (
              <div key={h}>
                <div className="rule mb-3" />
                <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-brand-700">{h}</h3>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing directive ─────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="rounded-sm bg-ink text-paper px-8 py-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 18% 20%, #9a7b3f, transparent 38%), radial-gradient(circle at 82% 70%, #1f5c3c, transparent 42%)" }} />
            <div className="relative">
              <Seal className="w-12 h-12 mx-auto" />
              <h2 className="mt-5 font-display text-3xl sm:text-4xl font-semibold tracking-tight">Begin the briefing.</h2>
              <p className="mt-4 text-paper/70 text-lg max-w-xl mx-auto">Open today&apos;s index, or put a question to the advisor in plain language.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/cpi" className="rounded-md bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-6 py-3 transition-colors cursor-pointer">Open Daily CPI</Link>
                <AskEconomist label="Consult the economist" variant="ghost" className="px-6 py-3" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
