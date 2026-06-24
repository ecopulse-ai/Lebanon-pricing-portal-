"use client";

export default function Ticker({ items }) {
  const row = (
    <div className="flex items-center gap-6 px-3 shrink-0">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="text-slate-500">{it.name}</span>
          <span className="font-semibold text-ink">${it.price.toFixed(2)}</span>
          <span className={it.change >= 0 ? "text-cedar" : "text-emerald-600"}>
            {it.change >= 0 ? "▲" : "▼"} {Math.abs(it.change).toFixed(1)}%
          </span>
          <span className="text-slate-300">•</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="border-y border-[rgba(18,32,25,0.1)] bg-white ticker-wrap overflow-hidden">
      <div className="flex py-2 whitespace-nowrap ticker font-mono text-[13px]">
        {row}
        {row}
      </div>
    </div>
  );
}
