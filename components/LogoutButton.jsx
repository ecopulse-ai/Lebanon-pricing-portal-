"use client";

import { logout } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default function LogoutButton({ locale = "en" }) {
  return (
    <button
      type="button"
      onClick={logout}
      className="inline-flex items-center gap-1.5 rounded border border-white/20 px-2 py-0.5 text-paper/70 hover:text-paper hover:border-white/40 transition-colors cursor-pointer"
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
      {t(locale, "common.logout")}
    </button>
  );
}
