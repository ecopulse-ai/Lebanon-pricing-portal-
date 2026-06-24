"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#1f5c3c", "#c2152e", "#9a7b3f", "#20655f", "#3b5a7a", "#6b3f5b", "#7a6a3a", "#4e7c59", "#8a5a2b", "#445a52"];

const tooltipStyle = {
  background: "#122019", border: "none", borderRadius: 8,
  fontSize: 12, color: "#fff", fontFamily: "var(--font-mono)", padding: "8px 10px",
};
const axisTick = { fill: "#94a3b8", fontSize: 10, fontFamily: "var(--font-mono)" };

function parseCharts(text) {
  const parts = [];
  const re = /\[CHART\]([\s\S]*?)\[\/CHART\]/g;
  let m, last = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    try {
      const cleaned = m[1].trim().replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      parts.push({ type: "chart", content: JSON.parse(cleaned) });
    } catch {
      // ignore malformed/partial chart (e.g. mid-stream)
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts.length ? parts : [{ type: "text", content: text }];
}

function InlineChart({ chart }) {
  const { type, title, data, keys, nameKey } = chart || {};
  if (!Array.isArray(data) || !data.length) return null;
  const nk = nameKey || "name";
  const dk = keys || Object.keys(data[0]).filter((k) => k !== nk);

  return (
    <figure className="my-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {title && <figcaption className="text-xs font-semibold text-ink mb-2 font-mono">{title}</figcaption>}
      <ResponsiveContainer width="100%" height={220}>
        {type === "line" ? (
          <LineChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis dataKey={nk} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            {dk.length > 1 && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />}
            {dk.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />)}
          </LineChart>
        ) : type === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey={dk[0] || "value"} nameKey={nk} cx="50%" cy="50%" outerRadius={78}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        ) : (
          <BarChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis dataKey={nk} tick={axisTick} tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={46} interval={0} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
            {dk.length > 1 && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />}
            {dk.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}

function renderTable(block, key) {
  const rows = block.trim().split("\n").filter((r) => r.includes("|"));
  const parsed = rows.map((r) =>
    r.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim())
  );
  if (!parsed.length) return null;
  const header = parsed[0];
  const body = parsed.slice(1).filter((row) => !row.every((c) => /^[-:\s]*$/.test(c)));
  return (
    <div key={key} className="my-3 overflow-x-auto scroll-thin">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="text-left font-semibold text-brand-700 bg-brand-50 border border-slate-200 px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className={i % 2 ? "bg-slate-50/60" : "bg-white"}>
              {row.map((c, j) => <td key={j} className="border border-slate-200 px-3 py-2 text-slate-700">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function inline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
          .replace(/`([^`]+?)`/g, '<code class="font-mono text-[0.85em] bg-slate-100 px-1 py-0.5 rounded">$1</code>');
}

function formatText(text, baseKey) {
  const segments = [];
  const tableRe = /((?:^|\n)(?:\|.*\|[ \t]*(?:\n|$)){2,})/g;
  let last = 0, tm;
  while ((tm = tableRe.exec(text)) !== null) {
    if (tm.index > last) segments.push({ type: "text", content: text.slice(last, tm.index) });
    segments.push({ type: "table", content: tm[1] });
    last = tm.index + tm[0].length;
  }
  if (last < text.length) segments.push({ type: "text", content: text.slice(last) });

  return segments.map((seg, si) => {
    const k = `${baseKey}-${si}`;
    if (seg.type === "table") return renderTable(seg.content, k);
    return seg.content.split("\n").map((line, i) => {
      const key = `${k}-${i}`;
      if (line.startsWith("### ")) return <h4 key={key} className="text-sm font-semibold text-brand-700 mt-3 mb-1 font-mono">{line.slice(4)}</h4>;
      if (line.startsWith("## ")) return <h3 key={key} className="text-base font-bold text-ink mt-4 mb-1.5">{line.slice(3)}</h3>;
      if (line.startsWith("# ")) return <h2 key={key} className="text-lg font-bold text-ink mt-4 mb-2 font-display">{line.slice(2)}</h2>;
      if (/^\s*[-•]\s+/.test(line)) return (
        <div key={key} className="pl-4 relative mb-1">
          <span className="absolute left-0 text-brand-600">›</span>
          <span dangerouslySetInnerHTML={{ __html: inline(line.replace(/^\s*[-•]\s+/, "")) }} />
        </div>
      );
      if (/^\s*\d+\.\s/.test(line)) return <div key={key} className="pl-1 mb-1" dangerouslySetInnerHTML={{ __html: inline(line) }} />;
      if (line.trim() === "") return <div key={key} className="h-2" />;
      return <p key={key} className="mb-1.5" dangerouslySetInnerHTML={{ __html: inline(line) }} />;
    });
  });
}

export default function MessageContent({ text }) {
  const parts = parseCharts(text);
  return (
    <div className="text-sm text-slate-700 leading-relaxed">
      {parts.map((p, i) =>
        p.type === "chart" ? <InlineChart key={i} chart={p.content} /> : <div key={i}>{formatText(p.content, i)}</div>
      )}
    </div>
  );
}
