"use client";

import { useState } from "react";
import { checkCredentials, setAuthed } from "@/lib/auth";

function Flag({ className = "w-12 h-12" }) {
  return (
    <span className={`inline-grid place-items-center ${className}`}>
      <svg viewBox="0 0 36 24" className="w-full h-auto rounded-[3px] ring-1 ring-white/20 shadow" preserveAspectRatio="xMidYMid meet">
        <rect width="36" height="24" fill="#ffffff" />
        <rect width="36" height="6" fill="#C8102E" />
        <rect y="18" width="36" height="6" fill="#C8102E" />
        <g fill="#007A3D">
          <rect x="17.2" y="14.8" width="1.6" height="1.8" />
          <polygon points="9.5,16 26.5,16 18,11.2" />
          <polygon points="11.4,13.6 24.6,13.6 18,9.2" />
          <polygon points="13.3,11.2 22.7,11.2 18,7.2" />
        </g>
      </svg>
    </span>
  );
}

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (checkCredentials(user, pass)) {
      setError("");
      setAuthed(true); // gate re-renders into the portal
    } else {
      setError("Incorrect username or password.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5 py-10 text-paper relative overflow-hidden" style={{ background: "#0c130f" }}>
      <div className="absolute inset-0 -z-10 opacity-[0.14]" style={{ backgroundImage: "radial-gradient(circle at 18% 15%, #9a7b3f, transparent 40%), radial-gradient(circle at 82% 80%, #1f5c3c, transparent 44%)" }} />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left — what the portal is & why it matters */}
        <div>
          <Flag className="w-14 h-14" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-400">République Libanaise</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Lebanon Prices Intelligence Unit</h1>
          <p className="mt-1.5 text-sm text-paper/55">Ministry of Economy &amp; Trade · Office of the Minister</p>

          <p className="mt-5 text-[15px] leading-relaxed text-paper/80 max-w-md">
            A strategic price-intelligence portal that turns daily signals from Lebanon&apos;s retail and wholesale
            markets into one dependable read on <span className="text-paper">inflation, affordability and import
            dependency</span> — so the Ministry sees where prices are heading before the monthly statistics confirm it.
          </p>

          <ul className="mt-6 space-y-3.5 max-w-md">
            {[
              ["Read inflation early", "A non-core daily CPI by category, indexed to 100 — ahead of the official monthly figures."],
              ["Protect households", "See affordability, which goods squeeze budgets, and whether cost or margin drives the shelf price."],
              ["De-risk supply", "Map import dependence, single-source concentration and maritime chokepoint exposure."],
              ["Brief on demand", "An AI Price Economist on every page, plus a one-click weekly Price Watch for meetings."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <span className="text-sm leading-relaxed text-paper/70"><span className="font-semibold text-paper">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — secure access */}
        <div className="w-full max-w-sm mx-auto lg:mx-0 lg:justify-self-end">
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/45">Secure access</p>

            <div>
              <label className="block text-xs text-paper/60 mb-1.5">Username</label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper/30 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                placeholder="username"
              />
            </div>

            <div>
              <label className="block text-xs text-paper/60 mb-1.5">Password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper/30 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-300">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-ink font-semibold py-2.5 transition-colors cursor-pointer"
            >
              Sign in
            </button>

            <p className="text-center text-[11px] text-paper/35 pt-1">For official use. Authorized personnel only.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
