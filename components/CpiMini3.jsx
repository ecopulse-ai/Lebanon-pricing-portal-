"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

// Default policymaker chart: just the three series that matter — CPI, Food, Gas.
// The full 15-series toggle chart lives in the Analyst view.
const SERIES = [
  { key: "CPI", label: "CPI", color: "#122019" },
  { key: "FoodOverall", label: "Food", color: "#184a31" },
  { key: "GasCPI", label: "Gas", color: "#8a6a20" },
];

export default function CpiMini3({ data, height = 240, labels }) {
  const L = labels || { CPI: "CPI", FoodOverall: "Food", GasCPI: "Gas" };
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#eef1ee" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={24} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} domain={["auto", "auto"]} width={40} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={L[s.key] || s.label} stroke={s.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
