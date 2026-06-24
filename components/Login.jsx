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

      <div className="w-full max-w-sm">
        {/* Crest */}
        <div className="flex flex-col items-center text-center">
          <Flag className="w-16 h-16" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-400">République Libanaise</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Lebanon Prices Intelligence Unit</h1>
          <p className="mt-1 text-sm text-paper/55">Ministry of Economy &amp; Trade · Office of the Minister</p>
        </div>

        {/* Card */}
        <form onSubmit={submit} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 space-y-4">
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

          <p className="text-center text-[11px] text-paper/35 font-mono">Demo access — minister / lebanon2026</p>
        </form>

        <p className="mt-6 text-center text-[11px] text-paper/35">For official use. Authorized personnel only.</p>
      </div>
    </div>
  );
}
