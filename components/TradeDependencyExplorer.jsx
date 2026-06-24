"use client";

import { useMemo, useState } from "react";
import DependencyNetwork from "@/components/DependencyNetwork";

function sevTone(v) {
  if (v >= 80) return "text-cedar";
  if (v >= 50) return "text-amber-600";
  if (v >= 25) return "text-brand-700";
  return "text-slate-500";
}

const LEGEND = [
  ["≥80%", "Near-monopoly", "#c2152e"],
  ["50–79%", "Concentrated", "#9a7b3f"],
  ["25–49%", "Moderate", "#1f5c3c"],
  ["<25%", "Diversified", "#3b4a5a"],
];

export default function TradeDependencyExplorer({ concentration, countries, critical }) {
  const [lens, setLens] = useState("all");           // "all" | country name
  const [node, setNode] = useState(null);            // hovered/selected node

  const country = lens === "all" ? null : countries.find((c) => c.name === lens);

  const nodes = useMemo(() => {
    if (lens === "all") return concentration;
    return (country?.supplies || []).map((s) => ({
      id: s.category, label: s.category, value: s.gripPct, size: s.items, source: lens,
    }));
  }, [lens, country, concentration]);

  const chips = countries.slice(0, 10);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* ── Network ──────────────────────────────────────────────── */}
      <div className="lg:col-span-2 rounded-2xl border border-paper/10 bg-ink overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-400">
            Import Dependency Network
          </p>
          <h2 className="mt-1 text-xl font-semibold text-paper flex items-center gap-2">
            {lens === "all" ? (
              <>🌐 Lebanon&apos;s import concentration</>
            ) : (
              <>📦 {lens} <span className="text-paper/50 text-base">→ Lebanon</span></>
            )}
          </h2>
          <p className="text-xs text-paper/55 mt-1">
            {lens === "all"
              ? "Each node is a category · size = import volume · colour = share from its single largest source · hover for sources"
              : `Categories ${lens} supplies · size = items · colour = ${lens}'s grip on the category · hover for detail`}
          </p>
        </div>

        {/* Lens selector */}
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          <button
            onClick={() => { setLens("all"); setNode(null); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
              lens === "all" ? "bg-amber-500 text-ink border-amber-500" : "bg-white/5 text-paper/70 border-white/15 hover:bg-white/10"
            }`}
          >All categories</button>
          {chips.map((c) => (
            <button
              key={c.name}
              onClick={() => { setLens(c.name); setNode(null); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                lens === c.name ? "bg-amber-500 text-ink border-amber-500" : "bg-white/5 text-paper/70 border-white/15 hover:bg-white/10"
              }`}
            >{c.name} <span className="opacity-60">{c.sharePct}%</span></button>
          ))}
        </div>

        <DependencyNetwork nodes={nodes} height={560} onSelect={setNode} />

        {/* Legend */}
        <div className="px-5 py-3 border-t border-white/10 flex flex-wrap gap-x-5 gap-y-2">
          {LEGEND.map(([range, label, color]) => (
            <span key={label} className="inline-flex items-center gap-2 text-[11px] text-paper/65 font-mono">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {range} · {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Side panel ───────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Country route card (country lens) */}
        {country && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-600">Shipping route</p>
            <p className="mt-1 font-semibold text-ink">{country.route}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(country.chokepoints.length ? country.chokepoints : ["No major chokepoint"]).map((ch) => (
                <span key={ch} className={`text-[11px] px-2 py-0.5 rounded-full ${country.chokepoints.length ? "bg-cedar/10 text-cedar" : "bg-brand-50 text-brand-700"}`}>{ch}</span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-lg font-bold text-ink">{country.monopolyCategories}</p>
                <p className="text-[10px] text-slate-500">near-monopolies</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-lg font-bold text-ink">{country.dominantCategories}</p>
                <p className="text-[10px] text-slate-500">categories &gt;50%</p>
              </div>
            </div>
          </div>
        )}

        {/* Node detail */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 min-h-[160px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {node ? "Selected node" : "Hover a node"}
          </p>
          {node ? (
            <>
              <h3 className="mt-1 font-semibold text-ink">{node.label}</h3>
              <p className={`mt-1 text-3xl font-bold ${sevTone(node.value)}`}>{Math.round(node.value)}%</p>
              <p className="text-xs text-slate-500">
                {lens === "all"
                  ? <>from <span className="font-medium text-ink">{node.source}</span> · {node.size.toLocaleString()} items</>
                  : <><span className="font-medium text-ink">{lens}</span>&apos;s grip · {node.size.toLocaleString()} items</>}
              </p>
              {lens === "all" && node.top3 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono">Top sources</p>
                  {node.top3.map((s) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-28 truncate">{s.name}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <span className="block h-full bg-brand-600" style={{ width: `${s.sharePct}%` }} />
                      </span>
                      <span className="text-xs font-mono text-slate-500 w-10 text-right">{s.sharePct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Tap or hover any node to see what share of that category comes from its leading source country, and which suppliers follow.
            </p>
          )}
        </div>

        {/* Critical dependencies */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cedar">Critical dependencies</p>
          <p className="text-xs text-slate-500 mt-0.5">Categories &gt;50% reliant on one country</p>
          <ul className="mt-3 space-y-2">
            {critical.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink truncate">{c.name}</span>
                <span className="text-xs text-slate-500 shrink-0">
                  <span className={`font-semibold ${sevTone(c.topShare)}`}>{c.topShare}%</span> {c.topSource}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Advisor CTA — opens the page's Sourcing Advisor dock */}
        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
          <p className="font-semibold text-ink">Sourcing advisor</p>
          <p className="text-xs text-slate-600 mt-1">Ask how to reduce single-source and chokepoint exposure.</p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("economist:open"))}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2.5 transition-colors cursor-pointer"
          >
            Ask the Sourcing Advisor
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
