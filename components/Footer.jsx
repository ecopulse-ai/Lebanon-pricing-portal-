import Link from "next/link";
import { Seal } from "@/components/Navbar";
import EconomicPulseLogo from "@/components/EconomicPulseLogo";
import { t } from "@/lib/i18n";

export default function Footer({ locale = "en" }) {
  const tr = (k) => t(locale, k);
  return (
    <footer className="bg-ink text-paper/80 border-t border-amber-500/20 print:hidden">
      <div className="max-w-7xl mx-auto px-5 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <Seal className="w-10 h-10" />
            <span className="leading-tight">
              <span className="block font-display font-bold text-paper">{tr("common.appName")}</span>
            </span>
          </div>
          <p className="mt-4 text-sm text-paper/60 max-w-xs leading-relaxed">{tr("footer.blurb")}</p>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">{tr("footer.instruments")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li><Link href="/cpi" className="hover:text-paper">{tr("instruments.cpi.title")}</Link></li>
            <li><Link href="/dashboard" className="hover:text-paper">{tr("instruments.dashboard.title")}</Link></li>
            <li><Link href="/trade" className="hover:text-paper">{tr("instruments.trade.title")}</Link></li>
            <li><Link href="/products" className="hover:text-paper">{tr("instruments.products.title")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">{tr("footer.method")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li>{tr("footer.mDaily")}</li>
            <li>{tr("footer.mNorm")}</li>
            <li>{tr("footer.mBase")}</li>
            <li>{tr("footer.mCoverage")}</li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">{tr("footer.handling")}</h3>
          <p className="mt-3 text-sm text-paper/60 leading-relaxed">{tr("footer.handlingText")}</p>
        </div>
      </div>
      <div className="border-t border-paper/10 bg-white">
        <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
          <EconomicPulseLogo imgClassName="h-10 w-auto" />
          <span className="font-bold text-slate-800">{tr("common.poweredBy")}</span>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-paper/45 font-mono">
          <p>{tr("footer.copyright")}</p>
          <p className="uppercase tracking-[0.16em]">{tr("footer.strap")}</p>
        </div>
      </div>
    </footer>
  );
}
