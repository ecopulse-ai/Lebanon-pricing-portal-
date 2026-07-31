import ProductsExplorer from "@/components/ProductsExplorer";
import { getCategories, getCatalogueMeta, getPriceDispersion, getUnitPriceWatch } from "@/lib/products";
import { getForensicWatch } from "@/lib/basketData";
import { getLocale } from "@/lib/locale-server";

export const metadata = {
  title: "Lebanon's Price Transparency Model — Prices Intelligence Unit",
  description:
    "Lebanon's Price Transparency Model — live shelf-price analytics: how much the same product varies across outlets, the widest-spread items to flag, and per-standard-unit comparisons across brands and pack sizes.",
};

function Stat({ big, label, tone = "brand" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`text-3xl sm:text-4xl font-bold font-display leading-none ${tone === "cedar" ? "text-cedar" : "text-brand-700"}`}>{big}</div>
      <div className="mt-2 text-xs text-slate-500 leading-snug">{label}</div>
    </div>
  );
}

function TransparencyIntro({ ar, meta, dispersion }) {
  const products = (meta?.products || 0).toLocaleString("en-US");
  const listings = (meta?.listings || 0).toLocaleString("en-US");
  const medSpread = dispersion?.medianSpread ?? 0;
  const share25 = dispersion?.shareOver25 ?? 0;
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow">{ar ? "الأداة الرابعة · شفافية الأسعار" : "Instrument IV · Price Transparency"}</span>
      <h1 className="mt-2 text-3xl sm:text-5xl font-semibold tracking-tight font-display text-ink">
        {ar ? "نموذج لبنان لشفافية الأسعار" : "Lebanon's Price Transparency Model"}
      </h1>
      <p className="mt-3 text-lg sm:text-xl font-semibold text-brand-700 max-w-3xl leading-snug">
        {ar
          ? `اليوم، المنتج نفسه قد يكلّف أكثر بنسبة ${medSpread}% تبعاً لمكان الشراء — و${share25}% من السلع اليومية تتفاوت بأكثر من الربع. نشر الأسعار يُغلق هذه الفجوة.`
          : `Today, the same product can cost ${medSpread}% more depending on where you shop — and ${share25}% of everyday items vary by over a quarter. Publishing prices closes that gap.`}
      </p>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat big={products} label={ar ? "منتج تُرصد أسعاره يومياً" : "products priced every day"} />
        <Stat big={listings} label={ar ? "نقطة سعرٍ تُستوعب يومياً" : "shelf price points ingested daily"} />
        <Stat big={`${medSpread}%`} tone="cedar" label={ar ? "فجوة وسيطة: الأرخص مقابل الأغلى للسلعة نفسها" : "median gap · cheapest vs dearest, same item"} />
        <Stat big={`${share25}%`} tone="cedar" label={ar ? "من السلع تتفاوت بأكثر من 25% بين المنافذ" : "of items vary >25% across outlets"} />
      </div>

      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

function PriceDispersion({ ar, data }) {
  const { top } = data;
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow">{ar ? "المشكلة بالأرقام" : "The problem, quantified"}</span>
      <h2 className="mt-2 text-2xl sm:text-3xl font-semibold font-display text-ink">
        {ar ? "المنتج نفسه… بسعرٍ مختلف" : "The same product, a different price"}
      </h2>
      <p className="mt-2 text-slate-600 max-w-3xl leading-relaxed">
        {ar
          ? "هذه السلع تُظهر أوسع الفجوات — حيث يتأرجح سعر المنتج نفسه أكثر ما يكون بين المنافذ. هذا التشتّت بالضبط هو ما يقلّصه نموذج الشفافية."
          : "These items show the widest gaps — where the same product's price swings most between outlets. This is exactly the dispersion a transparency mandate collapses."}
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-ink">
            {ar ? "أعلى 10 سلع للمراقبة — الأوسع تفاوتاً" : "Top 10 items to flag — widest price spread"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {ar
              ? "الفارق بين السعر المنخفض والمرتفع المعتاد عبر المنافذ للمنتج نفسه (بعد استبعاد الإدراجات الشاذة أو المختلفة الوحدة) · أسماء المنافذ محجوبة"
              : "Typical low-to-high across outlets for the same product (lone mispriced / odd-unit listings excluded) · outlet names withheld"}
          </p>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">{ar ? "المنتج" : "Product"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الأرخص" : "Cheapest"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الوسيط" : "Median"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الأغلى" : "Dearest"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الفارق" : "Spread"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {[p.brand, p.cat].filter(Boolean).join(" · ")} · {p.n} {ar ? "إدراج" : "listings"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono text-emerald-600">${p.min.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono text-slate-600">${p.med.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono text-cedar">${p.max.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono font-semibold text-ink">+{p.spreadPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

function UnitPriceWatch({ ar, data }) {
  const { top, goods } = data;
  if (!top || top.length === 0) return null;
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-2">
      <span className="eyebrow">{ar ? "لكل وحدة قياسية" : "Per standard unit"}</span>
      <h2 className="mt-2 text-2xl sm:text-3xl font-semibold font-display text-ink">
        {ar ? "السلعة نفسها — لكن أغلى لكل 100غ / 100مل / حبة" : "The same good — but dearer per 100g / 100ml / piece"}
      </h2>
      <p className="mt-2 text-slate-600 max-w-3xl leading-relaxed">
        {ar
          ? `بعد تحويل كل منتج إلى سعرٍ لكل وحدة قياسية عبر ${goods.toLocaleString()} سلعة قابلة للمقارنة، إليك السلع التي يتفاوت سعرها لكل وحدة أكثر من غيرها بين العلامات والأحجام — حيث يخفي الحجم الأكبر أحياناً سعراً أعلى للوحدة.`
          : `Normalizing every product to a price per standard unit across ${goods.toLocaleString()} comparable goods, here are the goods whose per-unit price varies most across brands and pack sizes — where a bigger pack can quietly cost more per unit.`}
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-ink">
            {ar ? "أوسع تفاوت في السعر لكل وحدة" : "Widest per-unit price gap, by good"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {ar
              ? "مقارنة على أساس السعر لكل وحدة قياسية عبر العلامات والأحجام · أسماء المنافذ محجوبة"
              : "Compared on price per standard unit across brands & pack sizes · outlet names withheld"}
          </p>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">{ar ? "السلعة" : "Good"}</th>
                <th className="px-4 py-3 font-medium">{ar ? "لكل" : "Per"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الأرخص" : "Cheapest"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الوسيط" : "Median"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الأغلى" : "Dearest"}</th>
                <th className="px-4 py-3 font-medium text-right rtl:text-left">{ar ? "الفارق" : "Spread"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top.map((g, i) => (
                <tr key={`${g.cat}-${g.good}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{g.good}</div>
                    <div className="text-xs text-slate-500">
                      {g.cat} · {g.variants} {ar ? "خيارات" : "variants"} · {g.listings} {ar ? "إدراج" : "listings"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{g.unit}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono text-emerald-600">${g.lo.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono text-slate-600">${g.med.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono text-cedar">${g.hi.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right rtl:text-left font-mono font-semibold text-ink">+{g.spreadPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

function ChainFlagCard({ ar, c, top, totalCats }) {
  const flagged = c.name === top.name;
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
      <div className="mt-2 text-2xl font-bold font-mono text-ink">${c.medianPrice}</div>
      <div className="text-xs text-slate-500">{ar ? "الوسيط للسلعة" : "median item"}</div>
      <div className="mt-2 text-xs">
        <span className={c.premiumVsCheapest > 0 ? "text-cedar font-medium" : "text-slate-400"}>
          {c.premiumVsCheapest > 0 ? "+" : ""}{c.premiumVsCheapest}% {ar ? "فوق الأرخص" : "vs cheapest"}
        </span>
        <span className="text-slate-400"> · {ar ? "الأغلى في" : "dearest in"} {c.dearestInCats}/{totalCats}</span>
      </div>
    </div>
  );
}

function FlagTable({ ar, title, sub, cols, rows }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead className="text-left rtl:text-right text-slate-500 bg-slate-50/60">
            <tr>
              <th className="px-4 py-3 font-medium">{cols[0]}</th>
              <th className="px-4 py-3 font-medium">{cols[1]}</th>
              <th className="px-4 py-3 font-medium text-right rtl:text-left">{cols[2]}</th>
              <th className="px-4 py-3 font-medium text-right rtl:text-left">{cols[3]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

function InspectionWatch({ ar, data }) {
  const { asOf, chainDates, totalCats, chains, categories, items } = data;
  if (!chains || chains.length === 0) return null;
  const top = chains[0];
  const cd = chainDates ? Object.entries(chainDates).map(([c, d]) => `${c} ${d}`).join(" · ") : "";
  const cat0 = categories[0];
  const it0 = items[0];
  const advice = ar
    ? `${top.name} هي الأغلى إجمالاً (الوسيط $${top.medianPrice}، +${top.premiumVsCheapest}% فوق أرخص منافس) والأعلى سعراً في ${top.dearestInCats} من ${totalCats} فئة. أولوية للمراجعة: ${cat0?.category} (الأغلى ${cat0?.dearest}، +${cat0?.gap}% مقابل ${cat0?.cheapest})${it0 ? `، وحالات شاذّة على مستوى الصنف مثل ${it0.item} (+${it0.gap}% لدى ${it0.dearCh})` : ""}. التوصية: نشر أسعار مرجعية للأصناف الأوسع فجوةً، وإعطاء الأولوية للتفتيش المستهدف حيث يرتفع منفذ واحد كثيراً فوق أقرانه على السلع الأساسية — الشفافية والمراجعة المستهدفة بدل سقوف الأسعار.`
    : `${top.name} is the dearest chain overall (median $${top.medianPrice}, +${top.premiumVsCheapest}% above the cheapest peer) and the most expensive in ${top.dearestInCats} of ${totalCats} categories. Priority for review: ${cat0?.category} (dearest ${cat0?.dearest}, +${cat0?.gap}% vs ${cat0?.cheapest})${it0 ? `, and item-level outliers such as ${it0.item} (+${it0.gap}% at ${it0.dearCh})` : ""}. Recommendation: publish reference prices for the widest-gap items, and prioritise targeted inspection where a single chain sits far above peers on staples — transparency and targeted review over blanket price caps.`;

  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow text-cedar">{ar ? "وحدة استخبارات الأسعار · رصد تدقيقي" : "Price Intelligence Unit · Forensic Watch"}</span>
      <h2 className="mt-2 text-2xl sm:text-3xl font-semibold font-display text-ink">
        {ar ? "رصد التفتيش — منافذ وأصناف تستحقّ تدقيقاً" : "Inspection Watch — chains & items worth a closer look"}
      </h2>

      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-50/60 px-4 py-2.5 text-xs text-ink leading-relaxed">
        {ar
          ? `مؤشّرات إحصائية لترتيب أولويات المراجعة — وليست إثباتاً لمخالفة. قد يكون المنفذ أغلى لأسبابٍ مشروعة؛ الإشارة الأقوى صنفٌ يرتفع كثيراً فوق أقرانه. بيانات مقطعية (${cd || asOf}) — قارِن المستويات لا يوماً بعينه.`
          : `Statistical flags to prioritise review — not findings of wrongdoing. A chain may be dearer for legitimate reasons; the stronger signal is a single item far above peers. Cross-sectional data (${cd || asOf}) — compare levels, not a single day.`}
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {chains.map((c) => <ChainFlagCard key={c.name} ar={ar} c={c} top={top} totalCats={totalCats} />)}
      </div>

      <div className="mt-4 rounded-2xl border border-cedar/30 bg-white px-5 py-4">
        <div className="eyebrow text-cedar mb-1">{ar ? "توصية لنائب الوزير" : "Advice to the Deputy Minister"}</div>
        <p className="text-sm sm:text-[15px] text-ink leading-relaxed">{advice}</p>
      </div>

      <div className="mt-5 grid lg:grid-cols-2 gap-5">
        <FlagTable
          ar={ar}
          title={ar ? "فئات للمراجعة" : "Categories to review"}
          sub={ar ? "أوسع فجوة بين المنافذ · المنفذ الأغلى مُسمّى" : "Widest chain gap · dearest chain named"}
          cols={[ar ? "الفئة" : "Category", ar ? "الأغلى" : "Dearest", ar ? "الأرخص" : "Cheapest", ar ? "الفجوة" : "Gap"]}
          rows={categories.map((c) => (
            <tr key={c.category} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2.5 text-ink">{c.category}</td>
              <td className="px-4 py-2.5"><span className="font-medium text-cedar">{c.dearest}</span> <span className="font-mono text-xs text-slate-500">${c.dearestPrice}</span></td>
              <td className="px-4 py-2.5 text-right rtl:text-left"><span className="text-emerald-600">{c.cheapest}</span> <span className="font-mono text-xs text-slate-500">${c.cheapestPrice}</span></td>
              <td className="px-4 py-2.5 text-right rtl:text-left font-mono font-semibold text-ink">+{c.gap}%</td>
            </tr>
          ))}
        />
        <FlagTable
          ar={ar}
          title={ar ? "أصناف شاذّة للتفتيش" : "Outlier items to inspect"}
          sub={ar ? "نفس الصنف · أغلى منفذ مقابل أرخص منفذ" : "Same item · dearest vs cheapest chain"}
          cols={[ar ? "الصنف" : "Item", ar ? "الأغلى" : "Dearest", ar ? "الأرخص" : "Cheapest", ar ? "الفجوة" : "Gap"]}
          rows={items.map((r) => (
            <tr key={r.item} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2.5"><div className="text-ink">{r.item}</div><div className="text-xs text-slate-400">{r.category}{r.nChains < 3 ? ` · ${r.nChains}/3` : ""}</div></td>
              <td className="px-4 py-2.5"><span className="font-medium text-cedar">{r.dearCh}</span> <span className="font-mono text-xs text-slate-500">${r.dearP}</span></td>
              <td className="px-4 py-2.5 text-right rtl:text-left"><span className="text-emerald-600">{r.cheapCh}</span> <span className="font-mono text-xs text-slate-500">${r.cheapP}</span></td>
              <td className="px-4 py-2.5 text-right rtl:text-left font-mono font-semibold text-ink">+{r.gap}%</td>
            </tr>
          ))}
        />
      </div>

      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams;
  const initialId = typeof sp?.p === "string" ? sp.p : null;
  const [locale, categories, meta, dispersion, unitWatch] = await Promise.all([
    getLocale(),
    getCategories(),
    getCatalogueMeta(),
    getPriceDispersion({ topN: 10 }),
    getUnitPriceWatch({ topN: 10 }),
  ]);
  const ar = locale === "ar";
  const forensic = getForensicWatch();
  return (
    <>
      <TransparencyIntro ar={ar} meta={meta} dispersion={dispersion} />
      <InspectionWatch ar={ar} data={forensic} />
      <PriceDispersion ar={ar} data={dispersion} />
      <UnitPriceWatch ar={ar} data={unitWatch} />
      <ProductsExplorer categories={categories} meta={meta} initialId={initialId} locale={locale} />
    </>
  );
}
