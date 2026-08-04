import ProductsExplorer from "@/components/ProductsExplorer";
import { PriceDispersionRangeChart } from "@/components/Charts";
import { getCategories, getCatalogueMeta, getRetailers } from "@/lib/products";
import { getForensicWatch, getBasketProductDispersion, getBasketDispersionStats } from "@/lib/basketData";
import { getLocale } from "@/lib/locale-server";

// Without this, Next.js's default static-optimization tries to prerender
// this page AT BUILD TIME -- which means the build itself would attempt a
// live call to Azure (Data Lake / SQL). If that call is slow, blocked, or
// unreachable from the build environment, the build can fail or hang with
// no clear error, since the failure happens during page-data collection,
// not at a normal runtime request. force-dynamic defers all data fetching
// to actual request time instead, same as the API routes already do.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lebanon's Price Transparency Model — Prices Intelligence Unit",
  description:
    "Lebanon's Price Transparency Model — live shelf-price analytics: how much the same product varies across outlets, the widest-spread items to flag, and per-unit comparisons across named chains.",
};

function Stat({ big, label, tone = "brand" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`text-3xl sm:text-4xl font-bold font-display leading-none ${tone === "cedar" ? "text-cedar" : "text-brand-700"}`}>{big}</div>
      <div className="mt-2 text-xs text-slate-500 leading-snug">{label}</div>
    </div>
  );
}

function TransparencyIntro({ ar, meta, dispStats, activeChains }) {
  const products = (meta?.products || 0).toLocaleString("en-US");
  const listings = (meta?.listings || 0).toLocaleString("en-US");
  const medSpread = dispStats?.medianGapPct ?? 0;
  const share25 = dispStats?.shareOver25Pct ?? 0;
  const chainsLabel = (activeChains || []).join(ar ? "، " : ", ");
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow">{ar ? "الأداة الرابعة · شفافية الأسعار" : "Instrument IV · Price Transparency"}</span>
      <h1 className="mt-2 text-3xl sm:text-5xl font-semibold tracking-tight font-display text-ink">
        {ar ? "نموذج لبنان لشفافية الأسعار" : "Lebanon's Price Transparency Model"}
      </h1>
      <p className="mt-3 text-lg sm:text-xl font-semibold text-brand-700 max-w-3xl leading-snug">
        {ar
          ? `على العيّنة القابلة للمقارنة عبر ${chainsLabel}، السلعة نفسها قد تكلّف أكثر بنسبة ${medSpread}% تبعاً لمكان الشراء — و${share25}% من الأصناف تتفاوت بأكثر من الربع بين المنفذين. نشر الأسعار يُغلق هذه الفجوة.`
          : `Across the items comparable at ${chainsLabel}, the same product can cost ${medSpread}% more depending on where you shop — and ${share25}% of items vary by over a quarter between the chains. Publishing prices closes that gap.`}
      </p>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat big={products} label={ar ? "منتج تُرصد أسعاره يومياً (كتالوج السوق الحيّ)" : "products priced every day (live market catalogue)"} />
        <Stat big={listings} label={ar ? "نقطة سعرٍ تُستوعب يومياً" : "shelf price points ingested daily"} />
        <Stat big={`${medSpread}%`} tone="cedar" label={ar ? "فجوة وسيطة عبر السلة المقارنة" : "median gap across the comparable basket"} />
        <Stat big={`${share25}%`} tone="cedar" label={ar ? "من الأصناف تتفاوت بأكثر من 25%" : "of items vary by more than 25%"} />
      </div>

      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

function ChainFlagCard({ ar, c, topName }) {
  const flagged = c.name === topName;
  const hasComparison = c.avgPremiumPct != null && c.itemsCompared > 0;
  const dearestSharePct = hasComparison ? Math.round((c.dearestItems / c.itemsCompared) * 100) : null;

  return (
    <div className={`rounded-2xl border p-5 ${flagged ? "border-cedar/40 bg-cedar/5" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">{c.name}</span>
        {flagged && (
          <span className="text-[10px] uppercase tracking-wide font-mono text-cedar border border-cedar/40 rounded-full px-2 py-0.5">
            {ar ? "الأبرز" : "Top flag"}
          </span>
        )}
      </div>

      {/* ── Cross-chain comparison ── how this chain stacks up against the others */}
      {hasComparison ? (
        <>
          <div className={`mt-2 text-2xl font-bold font-mono ${dearestSharePct >= 50 ? "text-cedar" : "text-ink"}`}>
            {dearestSharePct}%
          </div>
          <div className="text-xs text-slate-500">
            {ar
              ? `الأغلى في ${c.dearestItems} من ${c.itemsCompared} صنفاً قابلاً للمقارنة`
              : `dearest on ${c.dearestItems} of ${c.itemsCompared} comparable items`}
          </div>
          <div className="mt-2 text-sm font-mono text-ink">
            {c.avgPremiumPct > 0 ? "+" : ""}{c.avgPremiumPct}%
            <span className="text-xs text-slate-500 font-sans"> {ar ? "متوسط فرق السعر على تلك الأصناف" : "average price gap, on those items"}</span>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 text-sm font-medium text-slate-400">
            {ar ? "لا أصناف قابلة للمقارنة بعد" : "No comparable items yet"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {ar ? "لا يتقاطع مع المنفذين الآخرين على أي صنف من صنوف السلة حالياً" : "Doesn't currently overlap with the other chains on any basket item"}
          </div>
        </>
      )}

      {c.productsCompared > 0 && (
        <div className="mt-2 text-xs text-slate-500 flex justify-between">
          <span>{ar ? "منتجات مطابَقة" : "products matched"}</span>
          <span className="font-mono text-ink">
            {c.productsCompared}
            <span className="text-slate-400 font-sans"> ({c.catalogMatched} {ar ? "من قائمة موثّقة" : "confirmed"}{c.clusteringMatched > 0 ? `, ${c.clusteringMatched} ${ar ? "بتشابه الاسم" : "inferred"}` : ""})</span>
          </span>
        </div>
      )}

      {/* ── This chain's own basket ── size/coverage stats, independent of any comparison */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
          {ar ? "سلّة هذا المنفذ" : "This chain's basket"}
        </div>
        <div className="text-xs text-slate-500 flex justify-between">
          <span>{ar ? "أصناف مرصودة" : "items tracked"}</span>
          <span className="font-mono text-ink">{c.items}</span>
        </div>
        <div className="text-xs text-slate-500 flex justify-between mt-1">
          <span>{ar ? "السعر الوسيط" : "median price"}</span>
          <span className="font-mono text-ink">${c.medianPrice?.toFixed(2)}</span>
        </div>
        <div className="text-xs text-slate-500 flex justify-between mt-1">
          <span>{ar ? "نسبة التوفر" : "in stock"}</span>
          <span className="font-mono text-ink">{c.inStockRate}%</span>
        </div>
      </div>
    </div>
  );
}

function AllCategoriesTable({ ar, rows }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-ink">{ar ? "كل الفئات" : "All Categories"}</h3>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          {ar
            ? "متوسط مرجّح لفجوات الأصناف (الوزن = وزن السلعة في مؤشر أسعار المستهلك) · الفئات المعلَّمة تستحق مراجعة"
            : "Weighted average of item gaps (weight = each item's CPI importance weight) · flagged categories are worth reviewing"}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((c) => (
          <div key={c.category} className="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Category name — its own line, wraps freely */}
            <div className="min-w-[220px] flex-1 basis-64">
              <div className="font-medium text-ink leading-snug">{c.category}</div>
            </div>

            {/* Dearest -> cheapest, compact, own line on narrow screens */}
            <div className="text-sm min-w-[180px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-cedar">{c.dearest}</span>
                <span className="text-slate-300">{ar ? "←" : "→"}</span>
                <span className="text-emerald-600">{c.cheapest}</span>
              </div>
            </div>

            {/* Gap */}
            <div className="w-20 text-right rtl:text-left font-mono font-semibold text-ink shrink-0">
              +{c.gapPct}%
            </div>

            {/* Status badge — fixed min-width so badges line up instead of ragging */}
            <div className="shrink-0 min-w-[124px] text-right rtl:text-left">
              {c.needsReview ? (
                <span className="inline-block text-[10px] uppercase tracking-wide font-mono text-cedar border border-cedar/40 rounded-full px-2 py-0.5 whitespace-nowrap">
                  {ar ? "تحتاج مراجعة" : "needs review"}
                </span>
              ) : (
                <span className="inline-block text-[10px] uppercase tracking-wide font-mono text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                  {ar ? "ضمن الطبيعي" : "within normal range"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// function FlagTable({ ar, title, sub, cols, rows }) {
//   return (
//     <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
//       <div className="px-5 py-4 border-b border-slate-100">
//         <h3 className="font-semibold text-ink">{title}</h3>
//         <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
//       </div>
//       <div className="overflow-x-auto scroll-thin">
//         <table className="w-full text-sm">
//           <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
//             <tr>
//               <th className="px-4 py-3 font-medium">{cols[0]}</th>
//               <th className="px-4 py-3 font-medium">{cols[1]}</th>
//               <th className="px-4 py-3 font-medium text-right rtl:text-left">{cols[2]}</th>
//               <th className="px-4 py-3 font-medium text-right rtl:text-left">{cols[3]}</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-slate-100">{rows}</tbody>
//         </table>
//       </div>
//     </div>
//   );
// }

function InspectionWatch({ ar, data, dispersion }) {
  const { chains, categoryGaps, items, comparedItems, usingEqualWeights, chainDates, activeChains } = data;
  if (!chains || chains.length === 0) return null;
  const nActive = activeChains?.length || chains.length;
  const activeChainsLabel = (activeChains || chains.map((c) => c.name)).join(ar ? "، " : ", ");

  const ranked = [...chains].filter((c) => c.avgPremiumPct != null).sort((a, b) => b.avgPremiumPct - a.avgPremiumPct);
  const top = ranked[0] || null;
  const topCat = categoryGaps.find((c) => !c.insufficientData) || null;
  const it0 = items[0];

  const advice = !top
    ? (ar
        ? `لا توجد بعد أصناف قابلة للمقارنة عبر المنافذ النشطة معاً (${activeChainsLabel}) — التوصيات أدناه ستُستكمل حال توسّع تقاطع السلة.`
        : `No items are yet comparable across the active chains together (${activeChainsLabel}) — recommendations below will fill in as basket overlap grows.`)
    : ar
    ? `بمقارنة كل صنف موجود لدى المنافذ النشطة معاً (${activeChainsLabel}) على وحدته الفعلية، ${top.name} هي الأغلى — علاوة وسطية +${top.avgPremiumPct}% فوق أسعار المنافذ الأخرى، والأعلى في ${top.dearestItems} من ${top.itemsCompared} صنفاً. أولوية للمراجعة: ${topCat?.category} (الأغلى ${topCat?.dearest} مقابل ${topCat?.cheapest}، فجوة مرجّحة +${topCat?.gapPct}%)${it0 ? `، وحالات شاذّة مثل ${it0.item} (+${it0.gap}% لكل ${it0.unit} لدى ${it0.dearCh})` : ""}. التوصية: نشر أسعار مرجعية للأصناف الأوسع فجوةً، وتفتيش مستهدف حيث يرتفع منفذ واحد كثيراً — الشفافية والمراجعة المستهدفة بدل سقوف الأسعار.${usingEqualWeights ? " ملاحظة: الفجوات على مستوى الفئة أعلاه غير مرجّحة حالياً (أوزان متساوية) لحين توفّر أوزان كتالوج المنتجات (data/item_product_catalog.json)." : ""}`
    : `Comparing every item present at the active chains together (${activeChainsLabel}) on its actual pack unit, ${top.name} is the dearest — an average +${top.avgPremiumPct}% above prices at the other chain, and dearest on ${top.dearestItems} of ${top.itemsCompared} items. Priority for review: ${topCat?.category} (dearest ${topCat?.dearest} vs ${topCat?.cheapest}, weighted +${topCat?.gapPct}%)${it0 ? `, and outliers such as ${it0.item} (+${it0.gap}% per ${it0.unit} at ${it0.dearCh})` : ""}. Recommendation: publish reference prices for the widest-gap items and prioritise targeted inspection where a single chain sits far above peers — transparency and targeted review over blanket price caps.${usingEqualWeights ? " Note: the category-level gaps above are currently UNWEIGHTED (equal weights) pending the item catalog weights being available (data/item_product_catalog.json)." : ""}`;

  const dateNote = chainDates && Object.values(chainDates).some((d, _, arr) => d !== arr[0])
    ? (ar
        ? `المنافذ مسحت في تواريخ مختلفة (${Object.entries(chainDates).map(([c, d]) => `${c} ${d}`).join("، ")}) — هذه مقارنة عبر لحظات مختلفة، وليست مقارنة ليوم واحد.`
        : `Chains were scraped on different dates (${Object.entries(chainDates).map(([c, d]) => `${c} ${d}`).join(", ")}) — this is a cross-sectional comparison, not a same-day one.`)
    : null;

  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow text-cedar">{ar ? "وحدة استخبارات الأسعار · رصد تدقيقي" : "Price Intelligence Unit · Forensic Watch"}</span>
      <h2 className="mt-2 text-2xl sm:text-3xl font-semibold font-display text-ink">
        {ar ? "رصد التفتيش — منافذ وأصناف تستحقّ تدقيقاً" : "Inspection Watch — chains & items worth a closer look"}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {ar
          ? `${comparedItems} صنفاً قابلاً للمقارنة عبر المنافذ النشطة (${activeChainsLabel})`
          : `${comparedItems} items comparable across the active chains (${activeChainsLabel})`}
        {dateNote ? ` · ${dateNote}` : ""}
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {chains.map((c) => <ChainFlagCard key={c.name} ar={ar} c={c} topName={top?.name} />)}
      </div>

      <div className="mt-4 rounded-2xl border border-cedar/30 bg-white px-5 py-4">
        <div className="eyebrow text-cedar mb-1">{ar ? "توصية لوحدة حماية الأسعار" : "Advice to the Price Protection Unit"}</div>
        <p className="text-sm sm:text-[15px] text-ink leading-relaxed">{advice}</p>
      </div>

      <div className="mt-5 grid lg:grid-cols-2 gap-5 items-start">
        <AllCategoriesTable ar={ar} rows={categoryGaps} />

        {items?.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-ink">{ar ? "فجوات الأصناف" : "Item gaps"}</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {ar
                  ? `${items.length} صنفاً قابلاً للمقارنة عبر ${activeChainsLabel} · أسماء المنافذ ظاهرة بالكامل`
                  : `${items.length} items comparable across ${activeChainsLabel} · chain names shown in full`}
              </p>
            </div>
            <div className="overflow-x-auto scroll-thin max-h-[520px]">
              <table className="w-full text-sm">
                <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">{ar ? "الصنف" : "Item"}</th>
                    {[...new Set(items.flatMap((r) => Object.keys(r.unitByChain || {})))].sort().map((ch) => (
                      <th key={ch} className="px-4 py-3 font-medium text-right rtl:text-left">{ch}</th>
                    ))}
                    <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الفجوة" : "Gap"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...items].sort((a, b) => b.gapPct - a.gapPct).map((r) => {
                    const allChains = [...new Set(items.flatMap((x) => Object.keys(x.unitByChain || {})))].sort();
                    return (
                      <tr key={r.code} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-ink">{r.cpi_item}</div>
                          <div className="text-xs text-slate-500">
                            {r.category} · {ar ? "لكل" : "per"} {r.unit}
                          </div>
                        </td>
                        {allChains.map((ch) => {
                          const price = r.unitByChain[ch];
                          const isDear = ch === r.dearChain, isCheap = ch === r.cheapChain;
                          return (
                            <td key={ch} className={`px-4 py-2.5 text-right rtl:text-left font-mono ${isDear ? "text-cedar font-semibold" : isCheap ? "text-emerald-600" : "text-slate-400"}`}>
                              {price != null ? `$${price}` : "—"}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-right rtl:text-left font-mono font-semibold text-ink">+{r.gapPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {dispersion?.top?.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold text-ink mb-1">{ar ? "فجوات المنتجات — أوسع الحالات الفردية" : "Product gaps — the widest individual cases"}</h3>
          <p className="text-xs text-slate-500 mb-3 max-w-3xl leading-relaxed">
            {ar
              ? `أوسع ${dispersion.top.length} فجوة على مستوى منتج فردي محدد (وليس متوسط الصنف)، من أصل ${dispersion.comparedProducts.toLocaleString()} منتجاً مسعّراً. كل شريط يقارن سعر هذا المنتج الفعلي بمتوسط سعر نفس الصنف لدى المنفذ الآخر.`
              : `The widest ${dispersion.top.length} gaps at the level of a specific, individual product (not the item average). Each bar compares that product's real price to the other chain's average price for the same item.`}
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden p-4">
            <PriceDispersionRangeChart rows={dispersion.top} height={Math.max(280, dispersion.top.length * 42)} />
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams;
  const initialId = typeof sp?.p === "string" ? sp.p : null;

  let locale, categories, retailers, meta, forensic, basketDispersion, dispStats;
  try {
    [locale, categories, retailers, meta] = await Promise.all([
      getLocale(),
      getCategories(),
      getRetailers(),
      getCatalogueMeta(),
    ]);
  } catch (err) {
    console.error("[app/products/page] failed to load live catalogue data:", err);
    throw err; // let the route's error boundary handle it — no silent fallback
  }

  try {
    forensic = getForensicWatch({ topItems: 200 }); // effectively "all" credible items --
      // the item-gap table now shows the full comparable set, not just a top-10 slice
    basketDispersion = getBasketProductDispersion(25);
    dispStats = getBasketDispersionStats();
  } catch (err) {
    console.error("[app/products/page] failed to load basket data:", err);
    throw err;
  }

  const ar = locale === "ar";
  return (
    <>
      <TransparencyIntro ar={ar} meta={meta} dispStats={dispStats} activeChains={forensic?.activeChains} />
      <InspectionWatch ar={ar} data={forensic} dispersion={basketDispersion} />
      <ProductsExplorer categories={categories} retailers={retailers} meta={meta} initialId={initialId} locale={locale} />
    </>
  );
}
