"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Ticker from "@/components/Ticker";
import EconomicPulseLogo from "@/components/EconomicPulseLogo";
import LogoutButton from "@/components/LogoutButton";
import { getTicker } from "@/lib/data";

// Lebanese flag — the national mark beside the wordmark.
export function Seal({ className = "w-9 h-9" }) {
  return (
    <span className={`inline-grid place-items-center ${className}`}>
      <svg viewBox="0 0 36 24" className="w-full h-auto rounded-[3px] ring-1 ring-black/10 shadow-sm" preserveAspectRatio="xMidYMid meet">
        {/* red–white–red bands */}
        <rect width="36" height="24" fill="#ffffff" />
        <rect width="36" height="6" fill="#C8102E" />
        <rect y="18" width="36" height="6" fill="#C8102E" />
        {/* green cedar */}
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

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 shrink-0">
      <Seal className="w-11 h-11" />
      <span className="leading-tight">
        <span className="block text-2xl sm:text-[1.65rem] font-bold tracking-tight font-display text-ink">
          Lebanon Prices: <span className="text-slate-600">Intelligence Unit</span>
        </span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 print:hidden">
      {/* State bar */}
      <div className="bg-ink text-paper/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-3 text-[11px] font-mono tracking-wide">
          <span className="truncate">
            <span className="text-amber-400">République Libanaise</span>
            <span className="text-paper/40 mx-2">·</span>
            <span className="hidden sm:inline">Ministry of Economy &amp; Trade</span>
            <span className="sm:hidden">Min. Economy &amp; Trade</span>
          </span>
          <span className="inline-flex items-center gap-2 shrink-0">
            <EconomicPulseLogo imgClassName="h-5 w-auto bg-white rounded px-1 py-0.5" />
            <span className="hidden sm:inline font-bold text-paper normal-case tracking-normal">Powered by AI · Economic Pulse</span>
            <span className="text-paper/25">·</span>
            <LogoutButton />
          </span>
        </div>
      </div>

      {/* Brand + market ribbon + boxed navigation */}
      <div className="border-b border-[rgba(18,32,25,0.12)] bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-[60px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {pathname !== "/" && (
                <Link
                  href="/"
                  aria-label="Back to all instruments"
                  title="Back to all instruments"
                  className="grid place-items-center w-9 h-9 rounded-lg border border-[rgba(18,32,25,0.16)] bg-white text-slate-600 hover:text-brand-700 hover:border-brand-400 hover:bg-brand-50 transition-colors shrink-0 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
                </Link>
              )}
              <Logo />
            </div>
            <span className="hidden lg:block font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Office of the Minister
            </span>
          </div>
        </div>

        {/* Live price ribbon */}
        <Ticker items={getTicker()} />
      </div>
    </header>
  );
}
