"use client";

import { useMemo, useState } from "react";

// Severity palette keyed to dependency / concentration %.
function tone(v) {
  if (v >= 80) return { fill: "#c2152e", ring: "#ff6b81", label: "Near-monopoly" };   // state red
  if (v >= 50) return { fill: "#9a7b3f", ring: "#e7c989", label: "Concentrated" };     // brass
  if (v >= 25) return { fill: "#1f5c3c", ring: "#5fbf8c", label: "Moderate" };          // cedar
  return { fill: "#3b4a5a", ring: "#8aa0b4", label: "Diversified" };                    // slate
}

const W = 820, H = 620, CX = W / 2, CY = H / 2 - 6;
const GOLDEN = 2.399963229728653; // radians

// Deterministic phyllotaxis (sunflower) layout — stable for a given node order.
function layout(nodes) {
  const sizes = nodes.map((n) => n.size || 1);
  const sMin = Math.min(...sizes), sMax = Math.max(...sizes);
  const spacing = 66;
  return nodes.map((n, i) => {
    const ang = i * GOLDEN;
    const rad = spacing * Math.sqrt(i + 0.5);
    const t = sMax === sMin ? 0.5 : (Math.sqrt(n.size) - Math.sqrt(sMin)) / (Math.sqrt(sMax) - Math.sqrt(sMin));
    return {
      ...n,
      x: CX + rad * Math.cos(ang),
      y: CY + rad * Math.sin(ang),
      r: 15 + t * 30, // node radius 15–45
    };
  });
}

// Each node linked to its two nearest neighbours — the "web".
function edges(pts) {
  const out = [];
  const seen = new Set();
  pts.forEach((a, i) => {
    const near = pts
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    near.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); out.push([i, j]); }
    });
  });
  return out;
}

export default function DependencyNetwork({ nodes, height = 560, onSelect }) {
  const [active, setActive] = useState(null);
  const pts = useMemo(() => layout(nodes), [nodes]);
  const lines = useMemo(() => edges(pts), [pts]);
  const halos = useMemo(() => [...pts].sort((a, b) => b.r - a.r).slice(0, 3), [pts]);

  const pick = (n) => { setActive(n.id); onSelect && onSelect(n); };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <defs>
        <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1f5c3c" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1f5c3c" stopOpacity="0" />
        </radialGradient>
        <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Cluster halos behind the heaviest nodes */}
      {halos.map((h, i) => (
        <circle key={`h${i}`} cx={h.x} cy={h.y} r={h.r * 3.4} fill="url(#haloGrad)" />
      ))}

      {/* Edges */}
      {lines.map(([i, j], k) => {
        const a = pts[i], b = pts[j];
        const on = active === a.id || active === b.id;
        return (
          <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={on ? "#9fb3c8" : "#3a4654"} strokeWidth={on ? 1.4 : 0.8} strokeOpacity={on ? 0.9 : 0.5} />
        );
      })}

      {/* Nodes */}
      {pts.map((n) => {
        const t = tone(n.value);
        const isActive = active === n.id;
        const pct = Math.round(n.value);
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }}
            onMouseEnter={() => pick(n)} onClick={() => pick(n)}>
            <circle r={n.r + (isActive ? 5 : 0)} fill={t.fill} fillOpacity={isActive ? 0.95 : 0.82}
              stroke={t.ring} strokeWidth={isActive ? 3 : 1.6} filter={isActive ? "url(#nodeGlow)" : undefined} />
            <text textAnchor="middle" dy="0.35em" fontSize={Math.max(11, n.r * 0.52)} fontWeight="700"
              fill="#fff" fontFamily="var(--font-mono)" style={{ pointerEvents: "none" }}>{pct}%</text>
            {(n.r >= 24 || isActive) && (
              <text textAnchor="middle" y={n.r + 14} fontSize="11" fill="#c7d2dc"
                fontFamily="var(--font-mono)" style={{ pointerEvents: "none" }}>{n.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
