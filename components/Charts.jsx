"use client";

import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

const BLUE = "#1f5c3c";  // cedar green (primary)
const AMBER = "#9a7b3f"; // brass
const CEDAR = "#c2152e"; // state red (alert)
const GRID = "#e7e8e1";

const tooltipStyle = {
  background: "#122019",
  border: "none",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
  fontFamily: "var(--font-mono)",
  padding: "8px 10px",
};
const axisTick = { fill: "#94a3b8", fontSize: 11, fontFamily: "var(--font-mono)" };

export function BasketAreaChart({ data, height = 180 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="basketFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CEDAR} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CEDAR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={34} domain={["dataMin - 4", "dataMax + 4"]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="index" stroke={CEDAR} strokeWidth={2.5} fill="url(#basketFill)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryTrendChart({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-mono)" }} />
        <Line type="monotone" dataKey="Food" stroke={BLUE} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="Fuel" stroke={AMBER} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="Hygiene" stroke={CEDAR} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MarkupBarChart({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={72} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Markup"]} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
        <Bar dataKey="markup" radius={[0, 5, 5, 0]} barSize={18}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 ? AMBER : BLUE} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InflationBarChart({ data, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={48} interval={0} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={34} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "MoM"]} cursor={{ fill: "rgba(200,16,46,0.06)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={26}>
          {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? CEDAR : "#10b981"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CpiDeviationChart({ data, height = 360 }) {
  // data: [{ name, dev }] — deviation from base 100
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v > 0 ? "+" : ""}${v} vs 100`, "Deviation"]} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
        <Bar dataKey="dev" radius={[0, 4, 4, 0]} barSize={14}>
          {data.map((d, i) => <Cell key={i} fill={d.dev >= 0 ? CEDAR : "#10b981"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Real-snapshot charts ─────────────────────────────────────────────────────

// Horizontal bars, median shelf price (USD) by chain — cheapest at top.
export function RetailerPriceChart({ data, height = 220 }) {
  const rows = [...data].sort((a, b) => a.medianPrice - b.medianPrice);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={88} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}`, "Median price"]} cursor={{ fill: "rgba(31,92,60,0.06)" }} />
        <Bar dataKey="medianPrice" radius={[0, 5, 5, 0]} barSize={20} label={{ position: "right", formatter: (v) => `$${v}`, fill: "#64748b", fontSize: 11, fontFamily: "var(--font-mono)" }}>
          {rows.map((_, i) => <Cell key={i} fill={i === 0 ? BLUE : i === rows.length - 1 ? CEDAR : AMBER} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// In-stock availability rate (%) by chain.
export function AvailabilityChart({ data, height = 220 }) {
  const rows = [...data].sort((a, b) => b.inStockRate - a.inStockRate);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "In stock"]} cursor={{ fill: "rgba(31,92,60,0.06)" }} />
        <Bar dataKey="inStockRate" radius={[4, 4, 0, 0]} barSize={40}>
          {rows.map((d, i) => <Cell key={i} fill={d.inStockRate >= 75 ? BLUE : d.inStockRate >= 60 ? AMBER : CEDAR} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Import dependency — share (%) of traced items by source country.
export function OriginShareChart({ data, height = 360 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${v}% · ${p.payload.products.toLocaleString()} items`, "Share"]} cursor={{ fill: "rgba(154,123,63,0.08)" }} />
        <Bar dataKey="sharePct" radius={[0, 5, 5, 0]} barSize={16}>
          {data.map((d, i) => <Cell key={i} fill={d.name === "Other countries" ? "#94a3b8" : i === 0 ? CEDAR : AMBER} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Affordability — count of items by price band.
export function PriceBandChart({ data, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${v.toLocaleString()} items · ${p.payload.sharePct}%`, "Count"]} cursor={{ fill: "rgba(31,92,60,0.06)" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={38}>
          {data.map((_, i) => <Cell key={i} fill={i < 3 ? BLUE : AMBER} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Category mix — share of catalogue (%) by canonical group.
export function CategoryShareChart({ data, height = 420 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} width={132} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${v}% · median $${p.payload.medianPrice}`, "Share"]} cursor={{ fill: "rgba(31,92,60,0.06)" }} />
        <Bar dataKey="sharePct" radius={[0, 5, 5, 0]} barSize={13}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 ? AMBER : BLUE} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProductHistoryChart({ data, height = 260, color = BLUE }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${v}`} domain={["dataMin - 0.3", "dataMax + 0.3"]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}`, "Price"]} />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2.5} fill="url(#prodFill)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
