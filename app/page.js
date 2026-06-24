import Link from "next/link";
import AskEconomist from "@/components/AskEconomist";
import { Seal } from "@/components/Navbar";
import { getCpiSummary } from "@/lib/cpiData";

// The four instruments shown on the portal hub after sign-in.
const INSTRUMENTS = [
  {
    href: "/cpi", n: "I", tone: "brand", title: "Daily CPI",
    body: "Lebanon's non-core daily consumer-price index by category, indexed to 100 — the price pulse before the monthly numbers.",
    icon: <path d="M3 12h3l2.5-7 4 14 3-9 2 4h3.5" />,
  },
  {
    href: "/dashboard", n: "II", tone: "amber", title: "Retail Analytics",
    body: "Market-level shelf prices — affordability bands, category mix and import dependency from the live retail snapshot.",
    icon: <><path d="M3 3v18h18" /><path d="M7 15l3-4 3 3 4-6" /></>,
  },
  {
    href: "/trade", n: "III", tone: "brand", title: "Trade Map",
    body: "Where the shelves are sourced — single-source concentration, supplier blocs and maritime chokepoint exposure.",
    icon: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></>,
  },
  {
    href: "/products", n: "IV", tone: "amber", title: "Products",
    body: "Search the full standardized catalogue — price range in USD & LBP, brand and country of origin for 47.8k goods.",
    icon: <><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" /><path d="M21 21l-4.3-4.3" /></>,
  },
];

export default function Home() {
  const cpi = getCpiSummary();

  return (
    <section className="relative overflow-hidden flex-1">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% -10%, rgba(31,92,60,0.10), transparent 42%), radial-gradient(circle at 95% 0%, rgba(154,123,63,0.08), transparent 40%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-5 py-12 sm:py-16">
        {/* Heading */}
        <div className="flex flex-col items-center text-center">
          <Seal className="w-16 h-16" />
          <span className="mt-4 eyebrow">Office of the Minister · Strategic Price Intelligence</span>
          <h1 className="mt-2 font-display font-semibold text-ink tracking-tight text-3xl sm:text-4xl lg:text-5xl">
            Choose an instrument
          </h1>
          <p className="mt-3 text-slate-600 max-w-xl">
            Four lenses on Lebanon&apos;s prices. Pick one to go inside — the AI Price Economist on the right travels with you on every page.
          </p>
          <p className="mt-3 font-mono text-xs text-slate-500">
            As of {cpi.lastDate} · Non-core CPI {cpi.cpi} ({cpi.cpiDoD >= 0 ? "+" : ""}{cpi.cpiDoD}% DoD) · fastest mover: {cpi.fastestRising.name}
          </p>
        </div>

        {/* Instruments */}
        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {INSTRUMENTS.map((p) => (
            <Link key={p.href} href={p.href} className="group memo rounded-sm p-7 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className={`grid place-items-center w-14 h-14 rounded-sm ${p.tone === "brand" ? "bg-brand-50 text-brand-700" : "bg-amber-500/12 text-amber-600"}`}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
                </span>
                <span className="font-display text-3xl text-slate-300">{p.n}</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-ink">{p.title}</h2>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">{p.body}</p>
              <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all ${p.tone === "brand" ? "text-brand-700" : "text-amber-600"}`}>
                Open {p.title}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </span>
            </Link>
          ))}
        </div>

        {/* Secondary actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/briefing" className="inline-flex items-center gap-2 rounded-xl border border-[rgba(18,32,25,0.2)] bg-white hover:bg-brand-50/50 text-ink text-sm font-medium px-4 py-2.5 transition-colors">
            Open this week&apos;s Price Watch
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
          <AskEconomist label="Consult the economist" variant="outline" className="px-4 py-2.5" />
        </div>
      </div>
    </section>
  );
}
