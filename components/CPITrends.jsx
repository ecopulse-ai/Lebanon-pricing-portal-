"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  FOOD_CATS, AGG_CATS, CATEGORY_LABELS, CATEGORY_COLORS,
  getChartData, getCpiSummary, getSparkline,
} from "@/lib/cpiData";
import { localizeCpiCategory } from "@/lib/i18n";

const tooltipStyle = {
  background: "#122019", border: "none", borderRadius: 8,
  fontSize: 12, color: "#fff", fontFamily: "var(--font-mono)", padding: "8px 10px",
};

function Spark({ values, color, h = 28 }) {
  const vals = values.filter((v) => v != null);
  if (vals.length < 2) return <div style={{ height: h }} />;
  const w = 100;
  const min = Math.min(...vals), max = Math.max(...vals);
  const ny = (v) => (max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6));
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${ny(v).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={w - 1} cy={ny(vals[vals.length - 1])} r="2" fill={color} />
    </svg>
  );
}

function Change({ v, unit }) {
  const up = parseFloat(v) > 0;
  const flat = parseFloat(v) === 0;
  return (
    <span className={`font-mono text-xs font-semibold ${flat ? "text-slate-400" : up ? "text-cedar" : "text-emerald-600"}`}>
      {flat ? "•" : up ? "▲" : "▼"} {Math.abs(parseFloat(v))}{unit}
    </span>
  );
}

function CpiTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle}>
      <div className="font-semibold mb-1.5 text-amber-400">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-5">
          <span style={{ color: p.color }}>{localizeCpiCategory(locale, CATEGORY_LABELS[p.dataKey] || p.dataKey)}</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Reading({ label, value, color, sub, spark, date }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase truncate">{label}</span>
      </div>
      <div className="font-mono text-3xl font-semibold leading-none" style={{ color }}>{value}</div>
      <div className="min-h-[18px]">{sub}</div>
      {spark}
      <div className="font-mono text-[10px] text-slate-400">{date}</div>
    </div>
  );
}

export default function CPITrends({ locale = "en" }) {
  const s = getCpiSummary();
  const ar = locale === "ar";
  const L = (cat) => localizeCpiCategory(locale, CATEGORY_LABELS[cat]);
  const chartData = useMemo(() => getChartData(), []);
  const [selected, setSelected] = useState([
    "FruitAndNuts", "BreadAndCereals", "MeatAndPoultry", "FishAndSeafood", "CPI",
  ]);

  const toggle = (cat) =>
    setSelected((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  const tailCPI = useMemo(() => getSparkline("CPI"), []);
  const tailFood = useMemo(() => getSparkline("FoodOverall"), []);
  const tailGas = useMemo(() => getSparkline("GasCPI"), []);

  const C = { cpi: "#122019", food: "#184a31", state: "#c2152e", gas: "#8a6a20" };
  const unit = ar ? "٪ يومي" : "% DoD";
  const asOf = `${ar ? "حتى" : "as of"} ${s.lastDate}`;

  return (
    <div className="space-y-6">
      {/* Summary readings */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reading label={ar ? "المؤشّر العام" : "CPI overall"} value={s.cpi} color={C.cpi} date={asOf}
          sub={<Change v={s.cpiDoD} unit={unit} />} spark={<Spark values={tailCPI} color={C.cpi} />} />
        <Reading label={ar ? "الغذاء إجمالاً" : "Food overall"} value={s.foodOverall} color={C.food} date={asOf}
          sub={<Change v={s.foodDoD} unit={unit} />} spark={<Spark values={tailFood} color={C.food} />} />
        <Reading label={ar ? "أعلى فئة" : "Highest category"} value={s.highest.value} color={C.state} date={asOf}
          sub={<span className="text-xs text-slate-500">{localizeCpiCategory(locale, s.highest.name)}</span>} />
        <Reading label={ar ? "مؤشّر الغاز" : "Gas CPI"} value={s.gas} color={C.gas} date={asOf}
          sub={<Change v={s.gasDoD} unit={unit} />} spark={<Spark values={tailGas} color={C.gas} />} />
      </div>

      {/* Category selector */}
      <div>
        <div className="flex items-baseline gap-2.5 mb-2.5">
          <span className="text-[11px] font-semibold tracking-widest text-brand-700 uppercase">{ar ? "محدّد الفئات" : "Category selector"}</span>
          <span className="font-mono text-[10px] text-slate-400">{ar ? "بدّل السلاسل · أساس المؤشّر = 100" : "toggle series · base index = 100"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[...FOOD_CATS, ...AGG_CATS].map((cat) => {
            const on = selected.includes(cat);
            const c = CATEGORY_COLORS[cat];
            const headline = cat === "CPI" || cat === "FoodOverall";
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className="rounded-md font-mono font-semibold transition-colors cursor-pointer border"
                style={{
                  padding: headline ? "6px 13px" : "5px 10px",
                  fontSize: headline ? 11 : 10,
                  background: on ? c + "1f" : "transparent",
                  color: on ? c : "#94a3b8",
                  borderColor: on ? c + "59" : "#e2e8f0",
                }}
              >
                {L(cat)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <h2 className="text-xl font-bold text-ink font-display">{ar ? "مؤشّر التضخم غير الأساسي — اتجاهات الفئات اليومية" : "Non-Core CPI — Daily Category Trends"}</h2>
          <span className="w-5 h-px bg-amber-500 opacity-60 self-center" />
          <span className="font-mono text-[11px] text-slate-400">{s.firstDate} — {s.lastDate} · {ar ? "أساس المؤشّر = 100" : "base index = 100"}</span>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 6, right: 18, left: -4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={{ stroke: "#eef2f7" }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "var(--font-mono)" }} domain={["dataMin - 2", "dataMax + 2"]} axisLine={false} tickLine={false} width={38} />
            <Tooltip content={<CpiTooltip locale={locale} />} />
            <ReferenceLine y={100} stroke="#9a7b3f" strokeOpacity={0.7} strokeDasharray="5 4"
              label={{ value: ar ? "أساس 100" : "base 100", fill: "#806733", fontSize: 10, fontFamily: "var(--font-mono)", position: "insideTopLeft" }} />
            {selected.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat]}
                strokeWidth={cat === "CPI" ? 2.6 : 1.8}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                strokeDasharray={cat === "CPI" ? "7 4" : undefined}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex gap-x-4 gap-y-2 flex-wrap mt-3">
          {selected.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <span className="w-3 h-0.5 rounded-sm inline-block" style={{ background: CATEGORY_COLORS[cat] }} />
              {L(cat)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
