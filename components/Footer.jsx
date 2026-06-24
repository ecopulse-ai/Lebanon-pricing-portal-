import Link from "next/link";
import { Seal } from "@/components/Navbar";
import EconomicPulseLogo from "@/components/EconomicPulseLogo";

export default function Footer() {
  return (
    <footer className="bg-ink text-paper/80 border-t border-amber-500/20 print:hidden">
      <div className="max-w-7xl mx-auto px-5 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <Seal className="w-10 h-10" />
            <span className="leading-tight">
              <span className="block font-display font-bold text-paper">Lebanon Prices</span>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper/55">Intelligence Unit</span>
            </span>
          </div>
          <p className="mt-4 text-sm text-paper/60 max-w-xs leading-relaxed">
            Prepared for the Office of the Minister of Economy &amp; Trade, Republic of Lebanon.
          </p>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">Instruments</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li><Link href="/cpi" className="hover:text-paper">Non-Core Daily CPI</Link></li>
            <li><Link href="/dashboard" className="hover:text-paper">Retail Analytics</Link></li>
            <li><Link href="/trade" className="hover:text-paper">Trade Map</Link></li>
            <li><Link href="/products" className="hover:text-paper">Products</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">Method</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li>Daily collection</li>
            <li>USD &amp; LBP normalization</li>
            <li>Base index = 100</li>
            <li>Retail &amp; wholesale coverage</li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">Handling</h3>
          <p className="mt-3 text-sm text-paper/60 leading-relaxed">
            For official use. Figures shown are illustrative demo data pending connection to live sources, and should be verified before any decision.
          </p>
        </div>
      </div>
      <div className="border-t border-paper/10 bg-white">
        <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
          <EconomicPulseLogo imgClassName="h-10 w-auto" />
          <span className="font-bold text-slate-800">Powered by AI · Economic Pulse</span>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-paper/45 font-mono">
          <p>© 2026 Ministry of Economy &amp; Trade · Republic of Lebanon</p>
          <p className="uppercase tracking-[0.16em]">Strategic Price Intelligence</p>
        </div>
      </div>
    </footer>
  );
}
