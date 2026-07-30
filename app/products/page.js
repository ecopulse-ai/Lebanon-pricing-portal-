import ProductsExplorer from "@/components/ProductsExplorer";
import { getCategories, getCatalogueMeta, getPriceDispersion, getUnitPriceWatch } from "@/lib/products";
import { getLocale } from "@/lib/locale-server";

export const metadata = {
  title: "Lebanon's Price Transparency Model — Prices Intelligence Unit",
  description:
    "A near-zero-cost policy model to cut Lebanon's cost of living: mandate retailers to publish machine-readable shelf prices and let the market do the monitoring — with the live catalogue as proof.",
};

function Stat({ big, label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-3xl sm:text-4xl font-bold font-display text-brand-700 leading-none">{big}</div>
      <div className="mt-2 text-xs text-slate-500 leading-snug">{label}</div>
    </div>
  );
}

function StoryCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{children}</p>
    </div>
  );
}

function TransparencyIntro({ ar }) {
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow">{ar ? "الأداة الرابعة · نموذج سياساتي" : "Instrument IV · Policy Model"}</span>
      <h1 className="mt-2 text-3xl sm:text-5xl font-semibold tracking-tight font-display text-ink">
        {ar ? "نموذج لبنان لشفافية الأسعار" : "Lebanon's Price Transparency Model"}
      </h1>
      <p className="mt-3 text-lg sm:text-xl font-semibold text-brand-700 max-w-3xl leading-snug">
        {ar
          ? "طريقٌ شبه مجاني لخفض كلفة المعيشة — بلا سقوفٍ للأسعار، ولا مفتّشين، ولا غرامات."
          : "A near-zero-cost way to cut the cost of living — no price caps, no inspectors, no fines."}
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat big="4–5%" label={ar ? "انخفاض في الأسعار على مستوى الاقتصاد" : "lower prices, economy-wide"} />
        <Stat big="~$27" label={ar ? "وفورات شهرية لكل أسرة" : "saved per household / month"} />
        <Stat big="$0" label={ar ? "تجمعه الدولة — والسوق يتولّى الرقابة" : "collected by the state — the market monitors"} />
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-5">
        <StoryCard title={ar ? "القانون" : "The law"}>
          {ar
            ? "بعد احتجاجاتٍ واسعة على غلاء المعيشة، أقرّ أحد الاقتصادات قانوناً بارزاً: على كل سلسلة سوبرماركت تتجاوز حجماً معيّناً أن تنشر — لكل فرع — ملفاً قابلاً للقراءة آلياً بسعر كل صنف على مستوى الباركود، مع كل العروض، على موقع عام، يُحدَّث كلما تغيّر سعر."
            : "After nationwide protests over the cost of living, one economy passed a landmark law: every supermarket chain above a size threshold must publish — for every store — a machine-readable file of every item's price at the barcode level, plus all promotions, on a public website, refreshed whenever a price changes."}
        </StoryCard>
        <StoryCard title={ar ? "رخيصٌ على الدولة" : "Cheap for the state"}>
          {ar
            ? "الدولة لا تجمع أي سعر: لا مسّاحين عند الرفوف، ولا بنية مسحية، ولا قاعدة بيانات. تكتفي بإلزام التجّار بنشر بياناتٍ يملكونها أصلاً في أنظمة نقاط البيع — فالكلفة عليهم شبه معدومة — وتترك السوق يتولّى الرقابة: تطبيقات المقارنة والصحافيون والمستهلكون. مهمّة الدولة الوحيدة: التحقّق من وجود الملفات ودقّتها."
            : "The government collects no prices. No enumerators at shelves, no survey infrastructure, no database. It simply requires retailers to publish data they already hold in their point-of-sale systems — trivial for them — and lets the market do the monitoring: comparison apps, journalists, consumers. The state's only job is to check the files exist and are accurate."}
        </StoryCard>
        <StoryCard title={ar ? "وقد نجح فعلاً" : "And it worked"}>
          {ar
            ? "وثّقت دراسة محكّمة بمنهجية الفروق-في-الفروق انخفاضاً حاداً في تشتّت الأسعار وتراجعاً بنسبة 4–5% في الأسعار بعد سريان القاعدة — بوفورات نحو 27$ شهرياً لكل أسرة — إذ توقّفت السلاسل عن تسعير المنتج نفسه بأسعار مختلفة بين الأحياء. خفضٌ للأسعار على مستوى الاقتصاد بلا سقوفٍ أو مفتّشين أو غرامات."
            : "A peer-reviewed difference-in-differences evaluation found a sharp fall in price dispersion and a 4–5% drop in prices after the rule took effect — households saving about $27 a month — as chains stopped charging different prices for the same product in different neighborhoods. An economy-wide price cut with no caps, inspectors, or fines."}
        </StoryCard>
      </div>

      <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
        <p className="text-sm sm:text-[15px] text-ink leading-relaxed">
          <span className="font-semibold">
            {ar
              ? "لبنان يستطيع تبنّي النموذج نفسه — وهذه البوّابة هي إثباتُ الجدوى."
              : "Lebanon can adopt the same model — and this portal is the proof of concept."}
          </span>{" "}
          {ar
            ? "فهي تستوعب يومياً أسعار الرفوف القابلة للقراءة آلياً من السلاسل اللبنانية، وتوحّدها، وتجعل كل منتج قابلاً للبحث في الأسفل. البنية التي يحتاجها النموذج تعمل هنا بالفعل."
            : "It already ingests machine-readable shelf prices from Lebanese chains every day, standardizes them, and makes every product searchable below. The infrastructure the model needs already runs here."}
        </p>
      </div>

      <div className="mt-8 border-t border-slate-200" />
    </div>
  );
}

function PriceDispersion({ ar, data }) {
  const { top, medianSpread, trackedProducts, shareOver25, minListings } = data;
  return (
    <div className="max-w-7xl mx-auto w-full px-5 pt-8">
      <span className="eyebrow">{ar ? "المشكلة بالأرقام" : "The problem, quantified"}</span>
      <h2 className="mt-2 text-2xl sm:text-3xl font-semibold font-display text-ink">
        {ar ? "المنتج نفسه… بسعرٍ مختلف" : "The same product, a different price"}
      </h2>
      <p className="mt-2 text-slate-600 max-w-3xl leading-relaxed">
        {ar
          ? `عبر ${trackedProducts.toLocaleString()} منتجاً متتبَّعاً في ${minListings} منافذ فأكثر، يتقاضى المنفذ الأغلى — للمنتج نفسه — سعراً أعلى بنسبةٍ وسيطة ${medianSpread}% من الأرخص، و${shareOver25}% من المنتجات تتفاوت بأكثر من 25%. هذا التشتّت بالضبط هو ما يقلّصه نموذج الشفافية.`
          : `Across ${trackedProducts.toLocaleString()} products tracked at ${minListings}+ outlets, the dearest shelf charges a median ${medianSpread}% more than the cheapest for the same item — and ${shareOver25}% of products vary by more than 25%. That dispersion is exactly what the transparency model collapses.`}
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
  return (
    <>
      <TransparencyIntro ar={ar} />
      <PriceDispersion ar={ar} data={dispersion} />
      <UnitPriceWatch ar={ar} data={unitWatch} />
      <ProductsExplorer categories={categories} meta={meta} initialId={initialId} locale={locale} />
    </>
  );
}
