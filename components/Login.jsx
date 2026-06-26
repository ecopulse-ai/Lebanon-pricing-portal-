"use client";

import { useState } from "react";
import { checkCredentials, setAuthed } from "@/lib/auth";
import { t } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";

function Flag({ className = "w-12 h-12" }) {
  return (
    <span className={`inline-grid place-items-center ${className}`}>
      <svg viewBox="0 0 36 24" className="w-full h-auto rounded-[3px] ring-1 ring-black/10 shadow-sm" preserveAspectRatio="xMidYMid meet">
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

export default function Login({ locale = "en" }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const tr = (k) => t(locale, k);

  const submit = (e) => {
    e.preventDefault();
    if (checkCredentials(user, pass)) {
      setError("");
      setAuthed(true);
    } else {
      setError(tr("login.wrong"));
    }
  };

  const values = [
    [tr("login.v1t"), tr("login.v1d")],
    [tr("login.v2t"), tr("login.v2d")],
    [tr("login.v3t"), tr("login.v3d")],
    [tr("login.v4t"), tr("login.v4d")],
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5 py-10 text-ink relative overflow-hidden bg-paper">
      <div className="absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(circle at 12% -10%, rgba(31,92,60,0.10), transparent 42%), radial-gradient(circle at 95% 0%, rgba(154,123,63,0.10), transparent 40%)" }} />

      <LangToggle locale={locale} className="absolute top-5 end-5 text-slate-600 hover:text-brand-700 text-sm" />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left — what the portal is & why it matters */}
        <div>
          <Flag className="w-14 h-14" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-600">{tr("common.republic")}</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-ink">{tr("login.title")}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{tr("login.subtitle")}</p>

          <p className="mt-5 text-[15px] leading-relaxed text-slate-600 max-w-md">
            {tr("login.lead1")}<span className="text-ink font-medium">{tr("login.leadEmph")}</span>{tr("login.lead2")}
          </p>

          <ul className="mt-6 space-y-3.5 max-w-md">
            {values.map(([title, d]) => (
              <li key={title} className="flex gap-3">
                <svg className="w-5 h-5 mt-0.5 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <span className="text-sm leading-relaxed text-slate-600"><span className="font-semibold text-ink">{title}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — secure access */}
        <div className="w-full max-w-sm mx-auto lg:mx-0 lg:justify-self-end">
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{tr("login.secureAccess")}</p>

            <div>
              <label className="block text-xs text-slate-600 mb-1.5">{tr("login.username")}</label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder={tr("login.username")}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1.5">{tr("login.password")}</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold py-2.5 transition-colors cursor-pointer"
            >
              {tr("login.signIn")}
            </button>

            <p className="text-center text-[11px] text-slate-400 pt-1">{tr("login.officialUse")}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
