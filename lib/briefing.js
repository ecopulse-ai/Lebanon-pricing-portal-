// ─── Price Watch — auto-generated weekly briefing note (EN/AR) ───────────────
// Composes a minister-ready narrative deterministically across the portal's four
// instruments — Daily CPI, Price Transparency, Trade Map and the Customs Gap.
// No model call — same inputs always produce the same brief, in the requested
// language, so it is safe to server-render, print and share.

import { getCpiSummary, getCpiHeadline, getCpiMovers } from "@/lib/cpiData";
import { getTradeTotals, getCriticalDependencies, getBlocs, getChokepoints, getTradeMeta } from "@/lib/tradeData";
import { getForensicWatch } from "@/lib/basketData";
import { localizeCpiCategory, localizeOrigin, localizeBloc, localizeChokepoint, localizeCategory } from "@/lib/i18n";
import mirror from "@/public/trade-demo/data/mirror_gaps.json";

const sign = (n) => (n >= 0 ? "+" : "");

const money = (v) => {
  v = Number(v) || 0;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export async function getPriceWatch(locale = "en") {
  const ar = locale === "ar";
  const [cpi, trade, crit, blocs, choke, meta] = await Promise.all([
    getCpiSummary(),
    getTradeTotals(),
    getCriticalDependencies(3),
    getBlocs(),
    getChokepoints(),
    getTradeMeta(),
  ]);

  // Price Transparency (instrument 02) — size-normalized cross-chain forensic.
  const fw = getForensicWatch({ topCats: 3, topItems: 5 });
  const topChain = fw.chains[0] || { name: "—", avgPremiumPct: 0, dearestItems: 0, itemsCompared: 0 };
  const topItem = fw.items[0] || null;
  const topCat = fw.categories[0] || null;

  // The Customs Gap (instrument 04) — mirror trade-integrity module.
  const cg = mirror?.totals || {};
  const sc = mirror?.sig_counts || {};
  const cgDemo = !!mirror?.meta?.demo;

  const topBloc = blocs[0];
  const topChoke = choke[0];
  const asOf = prettyDate(cpi.lastDate);
  const period = `${prettyDate(cpi.firstDate)} – ${prettyDate(cpi.lastDate)}`;

  const fastest = localizeCpiCategory(locale, cpi.fastestRising.name);
  const highest = localizeCpiCategory(locale, cpi.highest.name);
  const lowest = localizeCpiCategory(locale, cpi.lowest.name);
  const supplier = localizeOrigin(locale, trade.topSupplier);
  const blocName = localizeBloc(locale, topBloc.name);
  const chokeName = localizeChokepoint(locale, topChoke.name);
  const cd = cpi.cpiDoD;

  if (ar) {
    const dir = cd > 0 ? "ارتفعت" : cd < 0 ? "انخفضت" : "ثبتت";
    const summary =
      `${dir} أسعار المستهلك غير الأساسية إلى مؤشّر ${cpi.cpi} (${sign(cd)}${cd}% يومياً)، بقيادة ${fastest}. ` +
      `على الرف، ${topChain.name} هي الأغلى — +${topChain.avgPremiumPct}% لكل وحدة فوق أرخص منافس` +
      (topItem ? `، مع ${topItem.item} (+${topItem.gap}% لدى ${topItem.dearCh}) مرشّحاً للتفتيش. ` : ". ") +
      `يظلّ المصدر معتمداً على الاستيراد: ${trade.tracedPct}% تُعقّب للخارج بقيادة ${supplier} (${trade.topSupplierShare}%). ` +
      `ويكشف التحليل المرآتي ${money(cg.vat_floor)} من إيرادات ضريبة القيمة المضافة${cgDemo ? " (توضيحي)" : ""} كامنةً في الفجوة الجمركية. ` +
      `أربع عدسات وقراءة واحدة: حماية الأسر، وصون المنافسة، وتأمين التوريد.`;
    const figures = [
      { label: "المؤشّر غير الأساسي", value: cpi.cpi, sub: `${sign(cd)}${cd}% يومياً` },
      { label: "الأغلى لكل وحدة", value: `+${topChain.avgPremiumPct}%`, sub: `${topChain.name} مقابل الأرخص` },
      { label: "الاعتماد على الاستيراد", value: `${trade.topSupplierShare}%`, sub: `من ${supplier} (المورّد الأول)` },
      { label: "الفجوة الجمركية · حد ض.ق.م", value: money(cg.vat_floor), sub: cgDemo ? "توضيحي · وحدة تجريبية" : "على الفجوات المُعلَّمة" },
    ];
    const sections = [
      {
        title: "١ · نبض التضخّم (المؤشّر اليومي)",
        body: `أغلق المؤشّر غير الأساسي الأسبوع عند ${cpi.cpi} (أساس 100)، و${dir} ${sign(cd)}${cd}% في اليوم. الغذاء إجمالاً ${cpi.foodOverall} (${sign(cpi.foodDoD)}${cpi.foodDoD}% يومياً) ومؤشّر الغاز ${cpi.gas} (${sign(cpi.gasDoD)}${cpi.gasDoD}% يومياً).`,
        bullets: [
          `الأسرع ارتفاعاً: ${fastest} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% يومياً).`,
          `أعلى مؤشّر: ${highest} (${cpi.highest.value})؛ أدنى: ${lowest} (${cpi.lowest.value}).`,
        ],
      },
      {
        title: "٢ · شفافية الأسعار والمنافسة",
        body: `بمقارنة الصنف نفسه بين المتاجر على وحدة موحّدة ($/100غ·مل·حبة؛ ${fw.comparedItems} صنفاً قابلاً للمقارنة)، ${topChain.name} هي الأغلى — علاوة وسطية +${topChain.avgPremiumPct}% لكل وحدة فوق أرخص منافس، والأعلى في ${topChain.dearestItems} من ${topChain.itemsCompared} صنفاً.`,
        bullets: [
          topItem ? `أوسع فجوة لكل وحدة: ${topItem.item} — ${topItem.dearCh} $${topItem.dearP}/${topItem.unit} مقابل ${topItem.cheapCh} $${topItem.cheapP} (+${topItem.gap}%).` : "لا فجوات أصناف قابلة للمقارنة هذا الأسبوع.",
          topCat ? `فئة للمراجعة: ${topCat.category} — الأغلى ${topCat.dearest} مقابل ${topCat.cheapest} (وسيط +${topCat.gap}% لكل وحدة).` : "—",
        ],
      },
      {
        title: "٣ · التعرّض للتجارة والشحن",
        body: `يظلّ المصدر معتمداً بشدة على الاستيراد: ${trade.tracedPct}% تُعقّب إلى ${trade.countries} دولة بقيادة كتلة ${blocName} (${topBloc.sharePct}%). مورّد واحد، ${supplier}، يستحوذ على ${trade.topSupplierShare}% من الواردات المتعقَّبة، و${trade.concentratedCategories} من ${trade.categories} فئة أحادية المصدر بنسبة >50%. التعرُّض للمضايق: ${chokeName} ${topChoke.sharePct}%.`,
        bullets: crit.map((c) => `${localizeCategory(locale, c.name)}: ${c.topShare}% من ${localizeOrigin(locale, c.topSource)}.`),
      },
      {
        title: "٤ · الفجوة الجمركية (نزاهة التجارة)",
        body: `يكشف التحليل المرآتي لتجارة لبنان 2024${cgDemo ? " — وحدة تجريبية توضيحية، جانب الشركاء اصطناعي" : ""} فائضاً قدره ${money(cg.gap_pos)} بين ما يُصرّح الشركاء بشحنه (مُعدّلاً على CIF) وما يسجّله لبنان استيراداً — بحدٍّ متحفّظ لإيراد ض.ق.م قدره ${money(cg.vat_floor)}.`,
        bullets: [
          `التوقيعات: ${sc.under_invoicing || 0} تبخيس فوترة، ${sc.smuggling_risk || 0} تهريب/عدم تصريح، ${sc.over_invoicing || 0} تضخيم فوترة.`,
          "مؤشّرات مخاطر لترتيب أولويات المراجعة الجمركية — لا إثبات مخالفة.",
        ],
      },
    ];
    const watchItems = [
      `${fastest} — الأسرع تحرّكاً في المؤشّر (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% يومياً)؛ تأكّد إن كان بدافع الكلفة أم عابراً.`,
      topItem ? `${topItem.item}: ${topItem.dearCh} +${topItem.gap}% لكل وحدة مقابل ${topItem.cheapCh} — مرشّح للتفتيش.` : "انشر أسعاراً مرجعية لكل وحدة للسلع الأوسع فجوةً.",
      `الاعتماد الأحادي على ${supplier} والتوجيه عبر ${chokeName} — مراجعة تنويع/مخزون احتياطي.`,
      `الفجوة الجمركية: حد ض.ق.م ${money(cg.vat_floor)}${cgDemo ? " (تجريبي)" : ""} — أعطِ الأولوية للممرّات المُعلَّمة.`,
    ];
    return { asOf, period, snapshotDates: meta.snapshotDates, summary, figures, sections, watchItems };
  }

  const dir = cd > 0 ? "edged up" : cd < 0 ? "eased" : "held flat";
  const summary =
    `Non-core consumer prices ${dir} to an index of ${cpi.cpi} (${sign(cd)}${cd}% day-over-day), led by ${fastest}. ` +
    `On the shelf, ${topChain.name} is the dearest chain — +${topChain.avgPremiumPct}% per unit above the cheapest peer` +
    (topItem ? `, with ${topItem.item} (+${topItem.gap}% at ${topItem.dearCh}) a candidate to inspect. ` : ". ") +
    `Sourcing stays import-bound: ${trade.tracedPct}% of goods trace abroad, led by ${supplier} (${trade.topSupplierShare}%). ` +
    `And mirror analysis flags ${money(cg.vat_floor)} of VAT revenue${cgDemo ? " (illustrative)" : ""} hiding in the customs gap. ` +
    `Four lenses, one read: protect households, keep competition honest, secure supply.`;
  const figures = [
    { label: "Non-core CPI", value: cpi.cpi, sub: `${sign(cd)}${cd}% DoD` },
    { label: "Dearest chain (per unit)", value: `+${topChain.avgPremiumPct}%`, sub: `${topChain.name} vs cheapest peer` },
    { label: "Import dependency", value: `${trade.topSupplierShare}%`, sub: `from ${supplier} (top supplier)` },
    { label: "Customs gap · VAT floor", value: money(cg.vat_floor), sub: cgDemo ? "illustrative · demo module" : "on flagged gaps" },
  ];
  const sections = [
    {
      title: "1 · Inflation pulse (Daily CPI)",
      body: `The non-core index closed the week at ${cpi.cpi} (base 100), ${dir} ${sign(cd)}${cd}% on the day. ` +
        `Food Overall stands at ${cpi.foodOverall} (${sign(cpi.foodDoD)}${cpi.foodDoD}% DoD) and the gas index at ${cpi.gas} (${sign(cpi.gasDoD)}${cpi.gasDoD}% DoD).`,
      bullets: [
        `Fastest-rising category: ${fastest} (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% DoD).`,
        `Highest index level: ${highest} (${cpi.highest.value}); lowest: ${lowest} (${cpi.lowest.value}).`,
      ],
    },
    {
      title: "2 · Price transparency & competition",
      body: `Comparing the same item across supermarkets on a common unit ($/100g·ml·piece; ${fw.comparedItems} comparable items), ` +
        `${topChain.name} runs the dearest — an average +${topChain.avgPremiumPct}% per unit above the cheapest peer, and dearest on ${topChain.dearestItems} of ${topChain.itemsCompared} items.`,
      bullets: [
        topItem ? `Widest per-unit gap: ${topItem.item} — ${topItem.dearCh} $${topItem.dearP}/${topItem.unit} vs ${topItem.cheapCh} $${topItem.cheapP} (+${topItem.gap}%).` : "No size-comparable item gaps this week.",
        topCat ? `Category to review: ${topCat.category} — dearest ${topCat.dearest} vs ${topCat.cheapest} (median +${topCat.gap}% per unit).` : "—",
      ],
    },
    {
      title: "3 · Trade & shipping exposure",
      body: `Sourcing stays heavily import-bound: ${trade.tracedPct}% of goods trace to ${trade.countries} countries, led by the ${blocName} bloc (${topBloc.sharePct}%). ` +
        `A single supplier, ${supplier}, accounts for ${trade.topSupplierShare}% of traced imports, and ${trade.concentratedCategories} of ${trade.categories} categories are >50% single-source. ` +
        `Chokepoint exposure: ${chokeName} ${topChoke.sharePct}%.`,
      bullets: crit.map((c) => `${localizeCategory(locale, c.name)}: ${c.topShare}% from ${localizeOrigin(locale, c.topSource)}.`),
    },
    {
      title: "4 · The Customs Gap (trade integrity)",
      body: `Mirror analysis of Lebanon's 2024 trade${cgDemo ? " — illustrative demo module, partner side synthetic" : ""} flags ${money(cg.gap_pos)} of excess ` +
        `between what partners report shipping (CIF-adjusted) and what Lebanon declares importing — a conservative ${money(cg.vat_floor)} VAT revenue floor.`,
      bullets: [
        `Signatures: ${sc.under_invoicing || 0} under-invoicing, ${sc.smuggling_risk || 0} smuggling / non-declaration, ${sc.over_invoicing || 0} over-invoicing corridors.`,
        "Risk indicators to prioritise customs review — not findings of wrongdoing.",
      ],
    },
  ];
  const watchItems = [
    `${fastest} — fastest CPI mover (${sign(cpi.fastestRising.value)}${cpi.fastestRising.value}% DoD); confirm cost-driven or transient.`,
    topItem ? `${topItem.item}: ${topItem.dearCh} +${topItem.gap}% per unit vs ${topItem.cheapCh} — candidate to inspect.` : "Publish per-unit reference prices for the widest-gap staples.",
    `Single-source reliance on ${supplier} and ${chokeName} routing — diversification / buffer-stock review.`,
    `Customs gap: ${money(cg.vat_floor)} VAT floor${cgDemo ? " (demo)" : ""} — prioritise the flagged corridors.`,
  ];
  return { asOf, period, snapshotDates: meta.snapshotDates, summary, figures, sections, watchItems };
}

// Compact 3-line daily brief for the CPI page — words first, numbers as
// evidence below. Deterministic (no model call), safe to server-render & cache.
export async function getCpiBrief(locale = "en") {
  const ar = locale === "ar";
  const [h, movers] = await Promise.all([getCpiHeadline(), getCpiMovers()]);
  const top = movers[0];
  const topName = localizeCpiCategory(locale, top.name);
  const s = (n) => (n >= 0 ? "+" : "");
  const asOf = prettyDate(h.lastDate);
  const lines = ar
    ? [
        `المؤشّر غير الأساسي عند ${h.cpi.value} (أساس 100)، ${s(h.cpi.wow)}${h.cpi.wow}% أسبوعياً و${s(h.cpi.m30)}${h.cpi.m30}% خلال 30 يوماً.`,
        `الغذاء ${h.food.value} (${s(h.food.wow)}${h.food.wow}% أسبوعياً)؛ الغاز ${h.gas.value} (${s(h.gas.wow)}${h.gas.wow}% أسبوعياً).`,
        `أبرز تحرّك هذا الأسبوع: ${topName} ${s(top.wow)}${top.wow}% (المؤشّر ${top.value}).`,
      ]
    : [
        `Non-core CPI at ${h.cpi.value} (base 100), ${s(h.cpi.wow)}${h.cpi.wow}% week-over-week and ${s(h.cpi.m30)}${h.cpi.m30}% over 30 days.`,
        `Food ${h.food.value} (${s(h.food.wow)}${h.food.wow}% WoW); Gas ${h.gas.value} (${s(h.gas.wow)}${h.gas.wow}% WoW).`,
        `Biggest mover this week: ${topName} ${s(top.wow)}${top.wow}% (index ${top.value}).`,
      ];
  return { asOf, lines };
}
