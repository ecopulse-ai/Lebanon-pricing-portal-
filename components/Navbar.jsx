"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Ticker from "@/components/Ticker";
import EconomicPulseLogo from "@/components/EconomicPulseLogo";
import LogoutButton from "@/components/LogoutButton";
import LangToggle from "@/components/LangToggle";
import { getTicker } from "@/lib/data";
import { t, isRTL } from "@/lib/i18n";

// Lebanese flag — the national mark beside the wordmark.
export function Seal({ className = "w-9 h-9" }) {
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

function Logo({ locale }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
      <Seal className="w-9 h-9 sm:w-11 sm:h-11 shrink-0" />
      <span className="leading-tight min-w-0">
        <span className="block text-base sm:text-2xl lg:text-[1.65rem] font-bold tracking-tight font-display text-ink">
          {locale === "ar"
            ? t("ar", "common.appName")
            : <>Prices <span className="text-slate-600">Intelligence Unit</span></>}
        </span>
      </span>
    </Link>
  );
}

export default function Navbar({ locale = "en" }) {
  const pathname = usePathname();
  const tr = (k) => t(locale, k);
  const rtl = isRTL(locale);

  return (
    <header className="sticky top-0 z-50 print:hidden">
      {/* State bar */}
      <div className="bg-ink text-paper/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-3 text-[11px] font-mono tracking-wide">
          <span className="truncate">
            <span className="text-amber-400">{tr("common.republic")}</span>
            <span className="text-paper/40 mx-2">·</span>
            <span className="hidden sm:inline">{tr("common.ministry")}</span>
            <span className="sm:hidden">{tr("common.ministryShort")}</span>
          </span>
          <span className="inline-flex items-center gap-2 shrink-0">
            <EconomicPulseLogo imgClassName="h-5 w-auto bg-white rounded px-1 py-0.5" />
            <span className="hidden md:inline font-bold text-paper normal-case tracking-normal">{tr("common.poweredBy")}</span>
            <span className="text-paper/25">·</span>
            <LangToggle locale={locale} className="text-paper/70 hover:text-paper" />
            <span className="text-paper/25">·</span>
            <LogoutButton locale={locale} />
          </span>
        </div>
      </div>

      {/* Brand + market ribbon */}
      <div className="border-b border-[rgba(18,32,25,0.12)] bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="min-h-[60px] py-2 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {pathname !== "/" && (
                <Link
                  href="/"
                  aria-label={tr("common.goBack")}
                  title={tr("common.goBack")}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-[rgba(18,32,25,0.16)] bg-white text-slate-700 hover:text-brand-700 hover:border-brand-400 hover:bg-brand-50 transition-colors shrink-0 cursor-pointer px-2.5 py-2"
                >
                  <svg className={`w-6 h-6 sm:w-7 sm:h-7 ${rtl ? "scale-x-[-1]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
                  <span className="hidden sm:inline font-bold text-lg">{tr("common.goBack")}</span>
                </Link>
              )}
              <Logo locale={locale} />
            </div>
            <span className="hidden lg:block font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {tr("common.office")}
            </span>
          </div>
        </div>

        {/* Live price ribbon */}
        <Ticker items={getTicker()} />
      </div>
    </header>
  );
}
