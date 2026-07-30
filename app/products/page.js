import ProductsExplorer from "@/components/ProductsExplorer";
import { getCategories, getCatalogueMeta } from "@/lib/products";
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

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams;
  const initialId = typeof sp?.p === "string" ? sp.p : null;
  const [locale, categories, meta] = await Promise.all([getLocale(), getCategories(), getCatalogueMeta()]);
  const ar = locale === "ar";
  return (
    <>
      <TransparencyIntro ar={ar} />
      <ProductsExplorer categories={categories} meta={meta} initialId={initialId} locale={locale} />
    </>
  );
}
