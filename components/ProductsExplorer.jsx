"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { USD_RATE } from "@/lib/data";

function fmtLBP(usd) {
  return (usd * USD_RATE).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function priceLabel(p) {
  return p.min === p.max ? `$${p.med.toFixed(2)}` : `$${p.min.toFixed(2)}–$${p.max.toFixed(2)}`;
}

const SORTS = [
  ["popular", "Most listed"],
  ["price_asc", "Price ↑"],
  ["price_desc", "Price ↓"],
  ["name", "A–Z"],
];

export default function ProductsExplorer({ categories = [], meta = {}, initialId = null }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("popular");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const reqId = useRef(0);

  // Fetch a page; page 1 replaces the list, later pages append.
  const fetchPage = useCallback(async (p, replace) => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ q, cat, sort, page: String(p), pageSize: "50" });
    try {
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (id !== reqId.current) return; // a newer request superseded this one
      setTotal(data.total);
      setPage(p);
      setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      if (replace) setSelected((cur) => cur || data.items[0] || null);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [q, cat, sort]);

  // Debounced reload whenever the query, category or sort changes.
  useEffect(() => {
    const t = setTimeout(() => fetchPage(1, true), 220);
    return () => clearTimeout(t);
  }, [fetchPage]);

  // Honor a deep-linked ?p=<id> on first load.
  useEffect(() => {
    if (initialId == null) return;
    fetch(`/api/products?id=${encodeURIComponent(initialId)}`)
      .then((r) => r.json())
      .then((d) => d.item && setSelected(d.item))
      .catch(() => {});
  }, [initialId]);

  const hasMore = items.length < total;

  return (
    <div className="max-w-7xl mx-auto w-full px-5 py-8">
      <div>
        <span className="eyebrow">Instrument II · Catalogue</span>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">Products</h1>
        <p className="mt-1 text-slate-600">
          Search the full standardized catalogue — {meta.products?.toLocaleString?.() || ""} products from {meta.listings?.toLocaleString?.() || ""} shelf listings.
        </p>
      </div>

      {/* Search + filters on top */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any product or brand (e.g. rice, nescafe, diapers, shampoo)…"
            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            aria-label="Search products"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 cursor-pointer"
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 cursor-pointer"
          aria-label="Sort"
        >
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-xs font-medium text-slate-500 flex justify-between">
              <span>{total.toLocaleString()} product{total !== 1 ? "s" : ""}{q ? ` for “${q}”` : ""}</span>
              <span className="font-mono">price range</span>
            </div>
            <ul className="max-h-[600px] overflow-y-auto scroll-thin divide-y divide-slate-100">
              {!loading && items.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">No products match “{q}”.</li>
              )}
              {items.map((p) => {
                const active = selected && p.id === selected.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                    >
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? "text-brand-800" : "text-ink"}`}>{p.name}</p>
                        <p className="text-xs text-slate-500 truncate">{p.cat}{p.brand ? ` · ${p.brand}` : ""}{p.unit ? ` · ${p.unit}` : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-semibold">${p.med.toFixed(2)}</p>
                        {p.min !== p.max && <p className="text-xs text-slate-400 font-mono">${p.min.toFixed(2)}–${p.max.toFixed(2)}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
              {loading && (
                <li className="px-4 py-4 text-center text-xs text-slate-400">Loading…</li>
              )}
              {hasMore && !loading && (
                <li className="p-3">
                  <button
                    onClick={() => fetchPage(page + 1, false)}
                    className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                  >
                    Load more ({(total - items.length).toLocaleString()} left)
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? <ProductDetail p={selected} /> : (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              Select a product to see its detail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ p }) {
  const [imgOk, setImgOk] = useState(true);
  // Where the median sits within the observed price range (for the bar marker).
  const span = p.max - p.min;
  const medPos = span > 0 ? ((p.med - p.min) / span) * 100 : 50;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        {p.img && imgOk && (
          <img
            src={p.img}
            alt={p.name}
            onError={() => setImgOk(false)}
            className="w-20 h-20 rounded-xl object-contain bg-slate-50 border border-slate-200 shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{p.cat}</span>
            {p.origin && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Origin · {p.origin}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full ${p.stock ? "bg-brand-50 text-brand-700" : "bg-red-50 text-cedar"}`}>
              {p.stock ? "In stock" : "Out of stock"}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-ink leading-tight">{p.name}</h2>
          <p className="text-sm text-slate-500">
            {p.brand ? p.brand : "Unbranded"}{p.unit ? ` · ${p.unit}` : ""} · tracked across {p.n.toLocaleString()} listing{p.n !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Median (USD)</p>
          <p className="text-lg font-bold font-mono">${p.med.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Range (USD)</p>
          <p className="text-lg font-bold font-mono">{priceLabel(p)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Median (LBP)</p>
          <p className="text-lg font-bold font-mono">{fmtLBP(p.med)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Listings</p>
          <p className="text-lg font-bold font-mono">{p.n.toLocaleString()}</p>
        </div>
      </div>

      {/* Price range bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink">Observed price range</h3>
          <span className="font-mono text-xs text-slate-400">USD across outlets</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200">
          <span
            className="absolute -top-1 w-1 h-4.5 bg-ink rounded"
            style={{ left: `calc(${medPos}% - 2px)`, height: "1.1rem" }}
            title={`Median $${p.med.toFixed(2)}`}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-mono text-slate-500">
          <span>${p.min.toFixed(2)} lowest</span>
          <span className="text-ink font-semibold">median ${p.med.toFixed(2)}</span>
          <span>${p.max.toFixed(2)} highest</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
          Range reflects this product&apos;s prices observed across all monitored outlets in the snapshot. Outlet names are withheld.
        </p>
      </div>
    </div>
  );
}
