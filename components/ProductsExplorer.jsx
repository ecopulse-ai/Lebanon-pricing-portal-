"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { USD_RATE } from "@/lib/data";
import { t, localizeCategory, localizeOrigin } from "@/lib/i18n";

function fmtLBP(usd) {
  return (usd * USD_RATE).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function priceLabel(p) {
  return p.min === p.max ? `$${p.med.toFixed(2)}` : `$${p.min.toFixed(2)}–$${p.max.toFixed(2)}`;
}

export default function ProductsExplorer({ categories = [], meta = {}, initialId = null, locale = "en" }) {
  const tr = (k) => t(locale, k);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("popular");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const reqId = useRef(0);

  const SORTS = [
    ["popular", tr("products.sortPopular")],
    ["price_asc", tr("products.sortPriceAsc")],
    ["price_desc", tr("products.sortPriceDesc")],
    ["name", tr("products.sortName")],
  ];

  const fetchPage = useCallback(async (p, replace) => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ q, cat, sort, page: String(p), pageSize: "50" });
    try {
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (id !== reqId.current) return;
      setTotal(data.total);
      setPage(p);
      setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      if (replace) setSelected((cur) => cur || data.items[0] || null);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [q, cat, sort]);

  useEffect(() => {
    const id = setTimeout(() => fetchPage(1, true), 220);
    return () => clearTimeout(id);
  }, [fetchPage]);

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
        <span className="eyebrow">{tr("products.eyebrow")}</span>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight font-display text-ink">{tr("products.title")}</h1>
        <p className="mt-1 text-slate-600">
          {tr("products.desc1")} {meta.products?.toLocaleString?.() || ""} {tr("products.descProducts")} {meta.listings?.toLocaleString?.() || ""} {tr("products.descListings")}
        </p>
      </div>

      {/* Search + filters on top */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("products.searchPlaceholder")}
            className="w-full rounded-xl border border-slate-300 bg-white ps-10 pe-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            aria-label={tr("products.searchPlaceholder")}
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 cursor-pointer"
          aria-label="Filter by category"
        >
          <option value="All">{locale === "ar" ? "كل الفئات" : "All categories"}</option>
          {categories.map((c) => <option key={c} value={c}>{localizeCategory(locale, c)}</option>)}
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
              <span>{total.toLocaleString()} {total !== 1 ? tr("products.countMany") : tr("products.countOne")}{q ? ` ${tr("products.forQ")} “${q}”` : ""}</span>
              <span className="font-mono">{tr("products.priceRange")}</span>
            </div>
            <ul className="max-h-[600px] overflow-y-auto scroll-thin divide-y divide-slate-100">
              {!loading && items.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">{tr("products.noMatch")} “{q}”.</li>
              )}
              {items.map((p) => {
                const active = selected && p.id === selected.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className={`w-full text-start px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                    >
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? "text-brand-800" : "text-ink"}`}>{p.name}</p>
                        <p className="text-xs text-slate-500 truncate">{localizeCategory(locale, p.cat)}{p.brand ? ` · ${p.brand}` : ""}{p.unit ? ` · ${p.unit}` : ""}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-sm font-mono font-semibold">${p.med.toFixed(2)}</p>
                        {p.min !== p.max && <p className="text-xs text-slate-400 font-mono">${p.min.toFixed(2)}–${p.max.toFixed(2)}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
              {loading && (
                <li className="px-4 py-4 text-center text-xs text-slate-400">{tr("common.loading")}</li>
              )}
              {hasMore && !loading && (
                <li className="p-3">
                  <button
                    onClick={() => fetchPage(page + 1, false)}
                    className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                  >
                    {tr("products.loadMore")} ({(total - items.length).toLocaleString()} {tr("products.left")})
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? <ProductDetail p={selected} locale={locale} /> : (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              {tr("products.selectPrompt")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ p, locale = "en" }) {
  const tr = (k) => t(locale, k);
  const [imgOk, setImgOk] = useState(true);
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
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{localizeCategory(locale, p.cat)}</span>
            {p.origin && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{tr("products.origin")} · {localizeOrigin(locale, p.origin)}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full ${p.stock ? "bg-brand-50 text-brand-700" : "bg-red-50 text-cedar"}`}>
              {p.stock ? tr("products.inStock") : tr("products.outOfStock")}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-ink leading-tight">{p.name}</h2>
          <p className="text-sm text-slate-500">
            {p.brand ? p.brand : tr("products.unbranded")}{p.unit ? ` · ${p.unit}` : ""} · {tr("products.trackedAcross")} {p.n.toLocaleString()} {p.n !== 1 ? tr("products.listings") : tr("products.listing")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">{tr("products.median")} ({tr("common.usd")})</p>
          <p className="text-lg font-bold font-mono">${p.med.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">{tr("products.range")} ({tr("common.usd")})</p>
          <p className="text-lg font-bold font-mono">{priceLabel(p)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">{tr("products.median")} ({tr("common.lbp")})</p>
          <p className="text-lg font-bold font-mono">{fmtLBP(p.med)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500">{tr("products.listingsLabel")}</p>
          <p className="text-lg font-bold font-mono">{p.n.toLocaleString()}</p>
        </div>
      </div>

      {/* Price range bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink">{tr("products.observedRange")}</h3>
          <span className="font-mono text-xs text-slate-400">{tr("products.acrossOutlets")}</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200">
          <span
            className="absolute -top-1 w-1 bg-ink rounded"
            style={{ insetInlineStart: `calc(${medPos}% - 2px)`, height: "1.1rem" }}
            title={`${tr("products.median")} $${p.med.toFixed(2)}`}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-mono text-slate-500">
          <span>${p.min.toFixed(2)} {tr("products.lowest")}</span>
          <span className="text-ink font-semibold">{tr("products.medianLabel")} ${p.med.toFixed(2)}</span>
          <span>${p.max.toFixed(2)} {tr("products.highest")}</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">{tr("products.rangeNote")}</p>
      </div>
    </div>
  );
}
