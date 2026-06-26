// ─── Price Watch — auto-generated weekly briefing note (EN/AR) ───────────────
// Composes a minister-ready narrative deterministically from the three live
// datasets. No model call — same inputs always produce the same brief, in the
// requested language, so it is safe to server-render, print and share.

import { getCpiSummary } from "@/lib/cpiData";
import { getRetailKPIs, getPriceBands, getRetailHeadlines } from "@/lib/retailData";
import { getTradeTotals, getCriticalDependencies, getBlocs, getChokepoints, getTradeMeta } from "@/lib/tradeData";
import { localizeCpiCategory, localizeOrigin, localizeBloc, localizeChokepoint, localizeCategory } from "@/lib/i18n";

const r1 = (n) => Math.round(n * 10) / 10;
const sign = (n) => (n >= 0 ? "+" : "");

function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export function getPriceWatch(locale = "en") {
  const ar = locale === "ar";
  const cpi = getCpiSummary();
  const k = getRetailKPIs();
  const bands = getPriceBands();
  const h = getRetailHeadlines();
  const trade = getTradeTotals();
  const crit = getCriticalDependencies(3);
  const blocs = getBlocs();
  const choke = getChokepoints();
  const meta = getTradeMeta();

  const under5 = r1(bands.slice(0, 3).reduce((a, b) => a + b.sharePct, 0));
  const above10 = r1(bands.slice(-2).reduce((a, b) => a + b.sharePct, 0));
  const outOfStock = r1(100 - k.inStockRate);
  const topBloc = blocs[0];
  const topChoke = choke[0];

  const asOf = prettyDate(cpi.lastDate);
  const period = `${prettyDate(cpi.firstDate)} – ${prettyDate(cpi.lastDate)}`;

  // Localized names used in the prose.
  const fastest = localizeCpiCategory(locale, cpi.fastestRising.name);
  const highest = localizeCpiCategory(locale, cpi.highest.name);
  const lowest = localizeCpiCategory(locale, cpi.lowest.name);
  const supplier = localizeOrigin(locale, trade.topSupplier);
  const blocName = localizeBloc(locale, topBloc.name);
  const chokeName = localizeChokepoint(locale, topChoke.name);
  const cheapest = h.cheapest ? localizeCategory(locale, h.cheapest.name) : "—";
  const dearest = h.dearest ? localizeCategory(locale, h.dearest.name) : "—";
  const cd = cpi.cpiDoD;

  if (ar) {
    const dir = cd > 0 ? "ارتفعت" : cd < 0 ? "انخفضت" : "ثبتت";
    const summary =
      `${dir} أسعار المستهلك غير الأساسية إلى مؤشّر ${cpi.cpi} (${sign(cd)}${cd}% يومياً)، بقيادة ${fastest} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}%). ` +
      `على الرف، يبلغ السعر الوسيط $${k.medianPrice} مع ${under5}% من السلع دون 5 دولار، لكن التوفّر ضعيف — ${outOfStock}% من المدرجات غير متوفّرة. ` +
      `يظل المصدر معتمداً على الاستيراد: ${trade.tracedPct}% من السلع تُعقّب للخارج، بقيادة ${supplier} (${trade.topSupplierShare}%)، و${trade.concentratedCategories} من ${trade.categories} فئة تعتمد على بلد واحد لأكثر من نصف توريدها. الضغط من التوريد وسعر الصرف، لا الهامش وحده.`;
    const figures = [
      { label: "مؤشّر التضخم غير الأساسي", value: cpi.cpi, sub: `${sign(cd)}${cd}% يومياً` },
      { label: "السعر الوسيط للرف", value: `$${k.medianPrice}`, sub: `${under5}% من السلع دون 5 دولار` },
      { label: "التوفّر على الرفوف", value: `${k.inStockRate}%`, sub: `${outOfStock}% غير متوفّر` },
      { label: "الاعتماد على الاستيراد", value: `${trade.topSupplierShare}%`, sub: `من ${supplier} (المورّد الأول)` },
    ];
    const sections = [
      {
        title: "نبض التضخّم (المؤشّر اليومي غير الأساسي)",
        body: `أغلق مؤشّر التضخم غير الأساسي الأسبوع عند ${cpi.cpi} (أساس 100)، و${dir} ${sign(cd)}${cd}% في اليوم. الغذاء إجمالاً عند ${cpi.foodOverall} (${sign(cpi.foodDoD)}${cpi.foodDoD}% يومياً) ومؤشّر الغاز عند ${cpi.gas} (${sign(cpi.gasDoD)}${cpi.gasDoD}% يومياً).`,
        bullets: [
          `الفئة الأسرع ارتفاعاً: ${fastest} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% يومياً).`,
          `أعلى مستوى مؤشّر: ${highest} (${cpi.highest.value})؛ أدنى: ${lowest} (${cpi.lowest.value}).`,
        ],
      },
      {
        title: "كلفة المعيشة والقدرة الشرائية",
        body: `عبر الكتالوج المرصود، السعر الوسيط للرف $${k.medianPrice} (المتوسّط $${k.meanPrice}، متأثّر بالسلع الفاخرة). نحو ${under5}% من السلع تُباع دون 5 دولار، بينما ${above10}% فوق 10 دولار — و${outOfStock}% من المدرجات غير متوفّرة حالياً، وهي إشارة توريد تهمّ الأسر بقدر السعر.`,
        bullets: [
          `أرخص فئة عريضة: ${cheapest}؛ الأغلى: ${dearest}.`,
          `التوفّر هو القيد الحاكم حيث يتركّز النفاد.`,
        ],
      },
      {
        title: "التعرّض للاستيراد والشحن",
        body: `يظل المصدر معتمداً بشدة على الاستيراد: ${trade.tracedPct}% من السلع تُعقّب إلى ${trade.countries} دولة، بقيادة كتلة ${blocName} (${topBloc.sharePct}%). يستحوذ مورّد واحد، ${supplier}، على ${trade.topSupplierShare}% من الواردات المتعقَّبة، و${trade.concentratedCategories} من ${trade.categories} فئة أحادية المصدر بنسبة >50% — تركّز تنقله صدمة سعرية أو حركة صرف أو اضطراب شحن مباشرةً إلى الرف. التعرّض للمضايق: ${chokeName} ${topChoke.sharePct}%.`,
        bullets: crit.map((c) => `${localizeCategory(locale, c.name)}: ${c.topShare}% من ${localizeOrigin(locale, c.topSource)}.`),
      },
    ];
    const watchItems = [
      `${fastest} — الأسرع تحرّكاً هذا الأسبوع (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% يومياً)؛ تأكّد إن كان بدافع الكلفة أم عابراً.`,
      `النفاد عند ${outOfStock}% — ميّز الفئات حيث يضغط التوفّر، لا السعر، على الأسر.`,
      `الاعتماد الأحادي على ${supplier} والتوجيه عبر ${chokeName} — مرشّحات لمراجعة التنويع / المخزون الاحتياطي.`,
    ];
    return { asOf, period, snapshotDates: meta.snapshotDates, summary, figures, sections, watchItems };
  }

  const dir = cd > 0 ? "edged up" : cd < 0 ? "eased" : "held flat";
  const summary =
    `Non-core consumer prices ${dir} to an index of ${cpi.cpi} (${sign(cd)}${cd}% day-over-day), ` +
    `led by ${fastest} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}%). ` +
    `On the shelf, the median price sits at $${k.medianPrice} with ${under5}% of goods under $5, yet availability is thin — ` +
    `${outOfStock}% of listings are out of stock. Sourcing remains import-bound: ${trade.tracedPct}% of goods trace abroad, ` +
    `led by ${supplier} (${trade.topSupplierShare}%), and ${trade.concentratedCategories} of ${trade.categories} categories ` +
    `depend on a single country for more than half their supply. The pressure is supply and FX, not only margin.`;
  const figures = [
    { label: "Non-core CPI", value: cpi.cpi, sub: `${sign(cd)}${cd}% DoD` },
    { label: "Median shelf price", value: `$${k.medianPrice}`, sub: `${under5}% of goods under $5` },
    { label: "On-shelf availability", value: `${k.inStockRate}%`, sub: `${outOfStock}% out of stock` },
    { label: "Import dependency", value: `${trade.topSupplierShare}%`, sub: `from ${supplier} (top supplier)` },
  ];
  const sections = [
    {
      title: "Inflation pulse (non-core daily CPI)",
      body: `The headline non-core index closed the week at ${cpi.cpi} (base 100), ${dir} ${sign(cd)}${cd}% on the day. ` +
        `Food Overall stands at ${cpi.foodOverall} (${sign(cpi.foodDoD)}${cpi.foodDoD}% DoD) and the gas index at ${cpi.gas} (${sign(cpi.gasDoD)}${cpi.gasDoD}% DoD).`,
      bullets: [
        `Fastest-rising category: ${fastest} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% DoD).`,
        `Highest index level: ${highest} (${cpi.highest.value}); lowest: ${lowest} (${cpi.lowest.value}).`,
      ],
    },
    {
      title: "Cost of living & affordability",
      body: `Across the monitored catalogue the median shelf price is $${k.medianPrice} (mean $${k.meanPrice}, skewed by premium goods). ` +
        `Roughly ${under5}% of items sell under $5, while ${above10}% sit above $10 — and ${outOfStock}% of listings are currently out of stock, ` +
        `a supply signal as relevant to households as price.`,
      bullets: [
        `Cheapest broad category: ${cheapest}; dearest: ${dearest}.`,
        `Availability is the binding constraint where stock-outs cluster.`,
      ],
    },
    {
      title: "Import & shipping exposure",
      body: `Sourcing stays heavily import-bound: ${trade.tracedPct}% of goods trace to ${trade.countries} countries, led by the ${blocName} bloc (${topBloc.sharePct}%). ` +
        `A single supplier, ${supplier}, accounts for ${trade.topSupplierShare}% of traced imports, and ${trade.concentratedCategories} of ${trade.categories} categories are >50% single-source — ` +
        `concentration a price shock, FX move or shipping disruption would transmit straight to the shelf. Chokepoint exposure: ${chokeName} ${topChoke.sharePct}%.`,
      bullets: crit.map((c) => `${localizeCategory(locale, c.name)}: ${c.topShare}% from ${localizeOrigin(locale, c.topSource)}.`),
    },
  ];
  const watchItems = [
    `${fastest} — fastest mover this week (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% DoD); confirm whether cost-driven or transient.`,
    `Stock-outs at ${outOfStock}% — flag categories where availability, not price, is squeezing households.`,
    `Single-source reliance on ${supplier} and ${chokeName} routing — candidates for a diversification / buffer-stock review.`,
  ];
  return { asOf, period, snapshotDates: meta.snapshotDates, summary, figures, sections, watchItems };
}
