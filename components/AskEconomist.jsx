"use client";

// Opens the page-specialized AI Price Economist dock (right side) instead of
// navigating anywhere — the dock listens for the "economist:open" event.
export default function AskEconomist({ label = "Ask the economist", className = "", variant = "solid" }) {
  const styles =
    variant === "ghost"
      ? "bg-white/10 hover:bg-white/20 border border-white/20 text-paper"
      : variant === "outline"
      ? "border border-[rgba(18,32,25,0.2)] bg-white hover:bg-brand-50/50 text-ink"
      : "bg-brand-700 hover:bg-brand-800 text-white";
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("economist:open"))}
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium px-4 py-2.5 transition-colors cursor-pointer ${styles} ${className}`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      {label}
    </button>
  );
}
