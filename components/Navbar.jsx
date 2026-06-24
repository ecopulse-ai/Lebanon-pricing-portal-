"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Ticker from "@/components/Ticker";
import EconomicPulseLogo from "@/components/EconomicPulseLogo";
import { getTicker } from "@/lib/data";

// Each destination gets a distinct icon.
const ICONS = {
  home: ["M3 11.5 12 4l9 7.5", "M5 10v10h14V10"],
  cpi: ["M3 12h3l2.5-7 4 14 3-9 2 4h3.5"], // pulse / daily index line
  retail: ["M3 3v18h18", "M7 15l3-4 3 3 4-6"], // analytics bars
  trade: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M3 12h18", "M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"], // globe / routes
  products: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"], // search
  advisor: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"], // chat
};

const LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/cpi", label: "Daily CPI", icon: "cpi" },
  { href: "/dashboard", label: "Retail Analytics", icon: "retail" },
  { href: "/trade", label: "Trade Map", icon: "trade" },
  { href: "/products", label: "Products", icon: "products" },
];

function Icon({ name, className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// Cedar seal — the unit's mark.
export function Seal({ className = "w-9 h-9" }) {
  return (
    <span className={`grid place-items-center rounded-full bg-ink text-amber-400 ring-1 ring-amber-500/40 ${className}`}>
      <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" />
        <path d="M12 7c-2.2-2.4-5-2.6-7-2.2 1.6 1.2 2 2.6 1.4 3.8 1.8-.4 4 .2 5.6 1.6" />
        <path d="M12 7c2.2-2.4 5-2.6 7-2.2-1.6 1.2-2 2.6-1.4 3.8-1.8-.4-4 .2-5.6 1.6" />
        <path d="M12 12c-2.6-2.6-6-2.8-8.5-2.2 2 1.4 2.5 3 1.8 4.4 2.2-.5 4.9.2 6.7 2" />
        <path d="M12 12c2.6-2.6 6-2.8 8.5-2.2-2 1.4-2.5 3-1.8 4.4-2.2-.5-4.9.2-6.7 2" />
      </svg>
    </span>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 shrink-0">
      <Seal className="w-11 h-11" />
      <span className="leading-tight">
        <span className="block text-xl font-bold tracking-tight font-display text-ink">Lebanon Prices</span>
        <span className="block text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-500">Intelligence Unit</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50">
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
            <span className="font-bold text-paper normal-case tracking-normal">Powered by AI · Economic Pulse</span>
          </span>
        </div>
      </div>

      {/* Brand + market ribbon + boxed navigation */}
      <div className="border-b border-[rgba(18,32,25,0.12)] bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-[60px] flex items-center justify-between gap-4">
            <Logo />
            <span className="hidden lg:block font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Office of the Minister
            </span>
          </div>
        </div>

        {/* Live price ribbon — full width, right above the nav */}
        <Ticker items={getTicker()} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Big boxed nav — wraps on small screens, no hamburger needed */}
          <nav aria-label="Primary" className="py-3 flex flex-wrap gap-2.5">
            {LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`group inline-flex flex-1 sm:flex-none items-center justify-center gap-2.5 rounded-lg border px-4 sm:px-5 py-3 text-[15px] font-semibold transition-all cursor-pointer ${
                    active
                      ? "border-brand-600 bg-brand-50 text-brand-700 shadow-sm"
                      : "border-[rgba(18,32,25,0.16)] bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <Icon name={l.icon} className={`w-5 h-5 ${active ? "" : "text-slate-400 group-hover:text-brand-600"} transition-colors`} />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
